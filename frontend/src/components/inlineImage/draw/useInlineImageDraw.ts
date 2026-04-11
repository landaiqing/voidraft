import {Canvas, FabricImage, PencilBrush, type FabricObject} from 'fabric';
import {computed, nextTick, onUnmounted, ref, shallowRef, watch} from 'vue';
import {useI18n} from 'vue-i18n';
import {useConfigStore} from '@/stores/configStore';
import {
  buildVersionedInlineImageUrl,
  canvasToPngBlob,
  deleteImageAsset,
  importImageBlob,
} from '@/views/editor/extensions/inlineImage/clipboard';
import {inlineImageDrawManager} from '@/views/editor/extensions/inlineImage/manager';
import {updateInlineImageData} from '@/views/editor/extensions/inlineImage/inlineImageParsing';
import type {ToolMode} from './types';

type CanvasSnapshot = string | Record<string, any>;
type InlineCanvasObject = FabricObject & {name?: string};

const INLINE_IMAGE_BACKGROUND_NAME = 'inline-image-background';
const MIN_DIALOG_WIDTH = 640;
const MIN_DIALOG_HEIGHT = 440;

export function useInlineImageDraw() {
  const state = inlineImageDrawManager.useState();
  const configStore = useConfigStore();
  const {t} = useI18n();

  const dialogRef = ref<HTMLDivElement | null>(null);
  const headerRef = ref<HTMLDivElement | null>(null);
  const contentRef = ref<HTMLDivElement | null>(null);
  const footerRef = ref<HTMLDivElement | null>(null);
  const stageRef = ref<HTMLDivElement | null>(null);
  const canvasRef = ref<HTMLCanvasElement | null>(null);

  const fabricCanvas = shallowRef<Canvas | null>(null);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const errorMessage = ref('');
  const toolMode = ref<ToolMode>('pen');
  const brushColor = ref('#f42525');
  const brushWidth = ref(3);
  const brushWidthOptions = [1, 3, 5, 7, 10, 15, 24];
  const zoom = ref(1);
  const baseScale = ref(1);
  const imageWidth = ref(1);
  const imageHeight = ref(1);
  const scaledWidth = ref(1);
  const scaledHeight = ref(1);
  const stagePaddingX = ref(0);
  const stagePaddingY = ref(0);
  const stageOverflow = ref<'hidden' | 'auto'>('hidden');
  const canvasOffsetX = ref(0);
  const canvasOffsetY = ref(0);
  const isStagePanning = ref(false);
  const history = ref<CanvasSnapshot[]>([]);
  const historyIndex = ref(-1);
  const isRestoring = ref(false);
  const viewportObserver = shallowRef<ResizeObserver | null>(null);
  const dialogWidth = ref(980);
  const dialogHeight = ref(720);
  const chromeWidth = ref(0);
  const chromeHeight = ref(0);
  let viewportResizeFrame: number | null = null;

  const stagePanState = {
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  };

  const isVisible = computed(() => state.value.visible);
  const currentTagId = computed(() => state.value.tagId);
  const currentAssetRef = computed(() => state.value.assetRef);
  const currentImageUrl = computed(() => state.value.imageUrl);
  const currentView = computed(() => state.value.view);
  const zoomLabel = computed(() => `${Math.round(baseScale.value * zoom.value * 100)}%`);
  const canUndo = computed(() => historyIndex.value > 0);
  const canRedo = computed(() => historyIndex.value >= 0 && historyIndex.value < history.value.length - 1);
  const stageCursor = computed(() => {
    if (isStagePanning.value) {
      return 'grabbing';
    }
    if (toolMode.value === 'pan') {
      return 'grab';
    }
    if (toolMode.value === 'select') {
      return 'default';
    }
    return 'crosshair';
  });

  const dialogStyle = computed(() => ({
    width: `${dialogWidth.value}px`,
    height: `${dialogHeight.value}px`,
    '--inline-image-draw-font-family': configStore.config.editing.fontFamily || 'var(--voidraft-font-mono, system-ui, -apple-system, sans-serif)',
    '--inline-image-draw-font-weight': configStore.config.editing.fontWeight || '400',
    '--inline-image-draw-line-height': String(configStore.config.editing.lineHeight || 1.5),
  }));

  watch(isVisible, async visible => {
    if (visible) {
      window.addEventListener('keydown', handleKeyDown);
      await nextTick();
      startViewportObserver();
      await initCanvas();
      return;
    }

    window.removeEventListener('keydown', handleKeyDown);
    stopViewportObserver();
    disposeCanvas();
    errorMessage.value = '';
  });

  watch(currentImageUrl, async imageUrl => {
    if (isVisible.value && imageUrl) {
      await initCanvas();
    }
  });

  watch([brushColor, brushWidth], () => {
    configureBrush();
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
    stopViewportObserver();
    stopStagePan();
    disposeCanvas();
  });

  function asCanvasObject(object: unknown): InlineCanvasObject | null {
    if (!object || typeof object !== 'object' || !('set' in object)) {
      return null;
    }

    return object as InlineCanvasObject;
  }

  function isBackgroundObject(object: unknown): boolean {
    return asCanvasObject(object)?.name === INLINE_IMAGE_BACKGROUND_NAME;
  }

  function lockCanvasObject(object: InlineCanvasObject): void {
    object.selectable = false;
    object.evented = false;
    object.hasControls = false;
    object.lockMovementX = true;
    object.lockMovementY = true;
    object.lockScalingFlip = true;
  }

  function normalizeBrushWidth(value: number): number {
    return brushWidthOptions.reduce((closest, option) => (
      Math.abs(option - value) < Math.abs(closest - value) ? option : closest
    ), brushWidthOptions[0]);
  }

  function createBrush(): PencilBrush | null {
    if (!fabricCanvas.value) {
      return null;
    }

    const brush = new PencilBrush(fabricCanvas.value);
    brush.color = brushColor.value;
    brush.width = brushWidth.value;
    brush.decimate = 0;
    brush.strokeLineCap = 'round';
    brush.strokeLineJoin = 'round';
    return brush;
  }

  function configureBrush(): void {
    if (!fabricCanvas.value) {
      return;
    }

    if (!fabricCanvas.value.freeDrawingBrush) {
      fabricCanvas.value.freeDrawingBrush = createBrush() ?? undefined;
    }

    const brush = fabricCanvas.value.freeDrawingBrush;
    if (brush) {
      brush.color = brushColor.value;
      brush.width = brushWidth.value;
      brush.strokeLineCap = 'round';
      brush.strokeLineJoin = 'round';

      if (brush instanceof PencilBrush) {
        brush.decimate = 0;
      }
    }
  }

  function currentAccentColor(): string {
    return getComputedStyle(document.documentElement)
      .getPropertyValue('--search-focus-border')
      .trim() || '#4a9eff';
  }

  function applyControlStyles(target?: unknown): void {
    const canvas = fabricCanvas.value;
    if (!canvas) {
      return;
    }

    const accent = currentAccentColor();
    const applyTo = (object: unknown) => {
      const canvasObject = asCanvasObject(object);
      if (!canvasObject || isBackgroundObject(canvasObject)) {
        return;
      }

      canvasObject.cornerColor = accent;
      canvasObject.borderColor = accent;
      canvasObject.cornerStrokeColor = accent;
      canvasObject.cornerDashArray = [4, 4];
      canvasObject.borderDashArray = [4, 4];
      canvasObject.borderScaleFactor = 2;
      canvasObject.transparentCorners = false;
      canvasObject.cornerStyle = 'rect';
    };

    if (target) {
      applyTo(target);
      return;
    }

    canvas.getObjects().forEach(applyTo);
  }

  function setTool(nextTool: ToolMode): void {
    toolMode.value = nextTool;

    const canvas = fabricCanvas.value;
    if (!canvas) {
      return;
    }

    canvas.discardActiveObject();
    canvas.isDrawingMode = nextTool === 'pen';
    canvas.selection = nextTool === 'select';
    canvas.defaultCursor = nextTool === 'pan'
      ? 'grab'
      : nextTool === 'select'
        ? 'default'
        : 'crosshair';

    canvas.getObjects().forEach(object => {
      const canvasObject = asCanvasObject(object);
      if (!canvasObject) {
        return;
      }

      if (isBackgroundObject(canvasObject)) {
        lockCanvasObject(canvasObject);
        canvasObject.hasBorders = false;
        return;
      }

      const selectable = nextTool === 'select';
      canvasObject.selectable = selectable;
      canvasObject.evented = selectable;
      applyControlStyles(canvasObject);
    });

    configureBrush();
    canvas.requestRenderAll();
  }

  function resetHistory(): void {
    history.value = [];
    historyIndex.value = -1;
  }

  function captureHistory(force = false): void {
    const canvas = fabricCanvas.value;
    if (!canvas) {
      return;
    }
    if (!force && isRestoring.value) {
      return;
    }

    const snapshot: CanvasSnapshot = canvas.toJSON();
    const nextHistory = historyIndex.value < history.value.length - 1
      ? history.value.slice(0, historyIndex.value + 1)
      : history.value.slice();

    nextHistory.push(snapshot);
    history.value = nextHistory;
    historyIndex.value = nextHistory.length - 1;
  }

  async function restoreHistory(index: number): Promise<void> {
    const canvas = fabricCanvas.value;
    if (!canvas || index < 0 || index >= history.value.length) {
      return;
    }

    isRestoring.value = true;
    const snapshot = history.value[index];

    await canvas.loadFromJSON(snapshot, (_serialized, object) => {
      const canvasObject = asCanvasObject(object);
      if (canvasObject && (isBackgroundObject(canvasObject) || canvasObject.type === 'image')) {
        lockCanvasObject(canvasObject);
        canvasObject.hasBorders = false;
      }
      applyControlStyles(canvasObject);
    });

    setTool(toolMode.value);
    configureBrush();
    canvas.requestRenderAll();
    historyIndex.value = index;
    isRestoring.value = false;
  }

  function undo(): void {
    if (canUndo.value) {
      void restoreHistory(historyIndex.value - 1);
    }
  }

  function redo(): void {
    if (canRedo.value) {
      void restoreHistory(historyIndex.value + 1);
    }
  }

  function deleteSelection(): boolean {
    const canvas = fabricCanvas.value;
    if (!canvas || isLoading.value) {
      return false;
    }

    const activeObjects = (canvas.getActiveObjects?.() || []).filter(object => !isBackgroundObject(object));
    if (activeObjects.length === 0) {
      return false;
    }

    activeObjects.forEach(object => {
      canvas.remove(object);
    });

    canvas.discardActiveObject();
    canvas.requestRenderAll();
    captureHistory();
    return true;
  }

  function onPathCreated(): void {
    if (!isRestoring.value) {
      captureHistory();
    }
  }

  function onObjectModified(): void {
    if (!isRestoring.value) {
      captureHistory();
    }
  }

  function onObjectAdded(event: {target?: unknown}): void {
    if (!isRestoring.value && event?.target) {
      applyControlStyles(event.target);
    }
  }

  function measureChrome(): void {
    const headerHeight = headerRef.value?.offsetHeight || 0;
    const footerHeight = footerRef.value?.offsetHeight || 0;
    const contentHorizontalPadding = contentRef.value
      ? contentRef.value.offsetWidth - contentRef.value.clientWidth
      : 0;
    const contentVerticalPadding = contentRef.value
      ? contentRef.value.offsetHeight - contentRef.value.clientHeight
      : 0;

    chromeWidth.value = contentHorizontalPadding;
    chromeHeight.value = headerHeight + footerHeight + contentVerticalPadding;
  }

  function getOverlayViewport(): {width: number; height: number} {
    const overlay = dialogRef.value?.parentElement;
    if (!overlay) {
      return {
        width: Math.max(320, window.innerWidth - 56),
        height: Math.max(260, window.innerHeight - 56),
      };
    }

    const style = getComputedStyle(overlay);
    const horizontalPadding = (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0);
    const verticalPadding = (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0);

    return {
      width: Math.max(320, overlay.clientWidth - horizontalPadding),
      height: Math.max(260, overlay.clientHeight - verticalPadding),
    };
  }

  function updateDialogSize(): void {
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = imageWidth.value / dpr;
    const logicalHeight = imageHeight.value / dpr;
    const viewport = getOverlayViewport();

    measureChrome();

    const maxWidth = Math.max(Math.min(MIN_DIALOG_WIDTH, viewport.width), viewport.width);
    const maxHeight = Math.max(Math.min(MIN_DIALOG_HEIGHT, viewport.height), viewport.height);
    const proportionalWidth = Math.round(viewport.width * 0.84);
    const proportionalHeight = Math.round(viewport.height * 0.84);
    const desiredWidth = Math.max(
      Math.min(MIN_DIALOG_WIDTH, viewport.width),
      proportionalWidth,
      Math.round(logicalWidth + chromeWidth.value + 32),
    );
    const desiredHeight = Math.max(
      Math.min(MIN_DIALOG_HEIGHT, viewport.height),
      proportionalHeight,
      Math.round(logicalHeight + chromeHeight.value + 32),
    );

    dialogWidth.value = Math.min(desiredWidth, maxWidth);
    dialogHeight.value = Math.min(desiredHeight, maxHeight);
  }

  function queueViewportResize(): void {
    if (!isVisible.value) {
      return;
    }

    if (viewportResizeFrame !== null) {
      cancelAnimationFrame(viewportResizeFrame);
    }

    viewportResizeFrame = requestAnimationFrame(() => {
      viewportResizeFrame = null;
      void nextTick(() => {
        updateDialogSize();
        updateCanvasScale();
      });
    });
  }

  function startViewportObserver(): void {
    stopViewportObserver();

    const overlay = dialogRef.value?.parentElement;
    if (!overlay || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => {
      queueViewportResize();
    });
    observer.observe(overlay);
    viewportObserver.value = observer;
  }

  function stopViewportObserver(): void {
    viewportObserver.value?.disconnect();
    viewportObserver.value = null;
    if (viewportResizeFrame !== null) {
      cancelAnimationFrame(viewportResizeFrame);
      viewportResizeFrame = null;
    }
  }

  function syncCanvasViewport(): void {
    const canvas = fabricCanvas.value;
    const wrapper = canvas?.wrapperEl;
    if (!canvas || !wrapper) {
      return;
    }

    wrapper.style.transform = canvasOffsetX.value || canvasOffsetY.value
      ? `translate(${canvasOffsetX.value}px, ${canvasOffsetY.value}px)`
      : 'translate(0px, 0px)';
    wrapper.style.transformOrigin = 'top left';
    wrapper.style.willChange = isStagePanning.value ? 'transform' : '';
    canvas.calcOffset();
  }

  function setCanvasOffset(offsetX: number, offsetY: number, sync = true): void {
    canvasOffsetX.value = offsetX;
    canvasOffsetY.value = offsetY;
    if (sync) {
      syncCanvasViewport();
    }
  }

  function clampCanvasOffset(offsetX: number, offsetY: number): {x: number; y: number} {
    const stage = stageRef.value;
    if (!stage || stageOverflow.value === 'auto') {
      return {x: 0, y: 0};
    }

    const stageWidth = stage.clientWidth || scaledWidth.value;
    const stageHeight = stage.clientHeight || scaledHeight.value;
    const minVisibleX = Math.min(140, Math.max(48, scaledWidth.value * 0.24));
    const minVisibleY = Math.min(120, Math.max(48, scaledHeight.value * 0.24));
    const centeredLeft = stagePaddingX.value;
    const centeredTop = stagePaddingY.value;

    const minOffsetX = minVisibleX - scaledWidth.value - centeredLeft;
    const maxOffsetX = stageWidth - minVisibleX - centeredLeft;
    const minOffsetY = minVisibleY - scaledHeight.value - centeredTop;
    const maxOffsetY = stageHeight - minVisibleY - centeredTop;

    return {
      x: Math.min(maxOffsetX, Math.max(minOffsetX, offsetX)),
      y: Math.min(maxOffsetY, Math.max(minOffsetY, offsetY)),
    };
  }

  function updateCanvasScale(anchor?: {x: number; y: number}): void {
    const canvas = fabricCanvas.value;
    if (!canvas) {
      return;
    }

    const stage = stageRef.value;
    const stageWidth = stage?.clientWidth || imageWidth.value;
    const stageHeight = stage?.clientHeight || imageHeight.value;
    const previousScrollLeft = stage?.scrollLeft || 0;
    const previousScrollTop = stage?.scrollTop || 0;
    const previousScaledWidth = scaledWidth.value || stageWidth;
    const previousScaledHeight = scaledHeight.value || stageHeight;
    const previousPaddingX = stagePaddingX.value;
    const previousPaddingY = stagePaddingY.value;
    const previousAnchor = anchor || {x: stageWidth / 2, y: stageHeight / 2};
    const previousViewportAnchor = {
      x: previousScrollLeft + previousAnchor.x - previousPaddingX,
      y: previousScrollTop + previousAnchor.y - previousPaddingY,
    };

    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = imageWidth.value / dpr;
    const logicalHeight = imageHeight.value / dpr;

    baseScale.value = Math.min(stageWidth / logicalWidth, stageHeight / logicalHeight, 1);
    const scale = baseScale.value * zoom.value;
    const nextScaledWidth = Math.round(logicalWidth * scale);
    const nextScaledHeight = Math.round(logicalHeight * scale);

    canvas.setDimensions({width: `${nextScaledWidth}px`, height: `${nextScaledHeight}px`}, {cssOnly: true});
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

    stageOverflow.value = nextScaledWidth > stageWidth || nextScaledHeight > stageHeight ? 'auto' : 'hidden';
    scaledWidth.value = nextScaledWidth;
    scaledHeight.value = nextScaledHeight;
    stagePaddingX.value = nextScaledWidth < stageWidth ? Math.floor((stageWidth - nextScaledWidth) / 2) : 0;
    stagePaddingY.value = nextScaledHeight < stageHeight ? Math.floor((stageHeight - nextScaledHeight) / 2) : 0;

    if (stageOverflow.value === 'auto') {
      setCanvasOffset(0, 0, false);
    } else {
      const clamped = clampCanvasOffset(canvasOffsetX.value, canvasOffsetY.value);
      setCanvasOffset(clamped.x, clamped.y, false);
    }

    if (stage) {
      const anchorRatioX = previousViewportAnchor.x / Math.max(previousScaledWidth, 1);
      const anchorRatioY = previousViewportAnchor.y / Math.max(previousScaledHeight, 1);
      const nextAnchor = {
        x: anchorRatioX * nextScaledWidth,
        y: anchorRatioY * nextScaledHeight,
      };

      void nextTick(() => {
        const maxScrollLeft = Math.max(0, nextScaledWidth + stagePaddingX.value * 2 - stageWidth);
        const maxScrollTop = Math.max(0, nextScaledHeight + stagePaddingY.value * 2 - stageHeight);
        stage.scrollLeft = Math.min(maxScrollLeft, Math.max(0, nextAnchor.x + stagePaddingX.value - previousAnchor.x));
        stage.scrollTop = Math.min(maxScrollTop, Math.max(0, nextAnchor.y + stagePaddingY.value - previousAnchor.y));
        fabricCanvas.value?.calcOffset();
      });
    }

    syncCanvasViewport();
  }

  function setZoom(nextZoom: number, anchor?: {x: number; y: number}): void {
    zoom.value = Math.min(Math.max(nextZoom, 0.2), 4);
    updateCanvasScale(anchor);
  }

  function zoomIn(): void {
    if (!isLoading.value) {
      setZoom(zoom.value + 0.2);
    }
  }

  function zoomOut(): void {
    if (!isLoading.value) {
      setZoom(zoom.value - 0.2);
    }
  }

  function resetZoom(): void {
    zoom.value = 1;
    updateCanvasScale();
  }

  function handleWheel(event: WheelEvent): void {
    if (isLoading.value) {
      return;
    }

    event.preventDefault();

    const stage = stageRef.value;
    if (!stage) {
      return;
    }

    const rect = stage.getBoundingClientRect();
    setZoom(
      zoom.value * (event.deltaY < 0 ? 1.05 : 0.95),
      {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      },
    );
  }

  function handleStagePan(event: MouseEvent): void {
    if (!isStagePanning.value || !stageRef.value) {
      return;
    }

    if (stageOverflow.value === 'auto') {
      stageRef.value.scrollLeft = stagePanState.scrollLeft - (event.clientX - stagePanState.startX);
      stageRef.value.scrollTop = stagePanState.scrollTop - (event.clientY - stagePanState.startY);
      fabricCanvas.value?.calcOffset();
      return;
    }

    const clamped = clampCanvasOffset(
      stagePanState.scrollLeft + (event.clientX - stagePanState.startX),
      stagePanState.scrollTop + (event.clientY - stagePanState.startY),
    );
    setCanvasOffset(clamped.x, clamped.y);
  }

  function shouldStartPan(event: MouseEvent): boolean {
    if (!stageRef.value) {
      return false;
    }

    if (event.button === 1) {
      return true;
    }

    return event.button === 0 && toolMode.value === 'pan';
  }

  function stopStagePan(): void {
    isStagePanning.value = false;
    window.removeEventListener('mousemove', handleStagePan);
    window.removeEventListener('mouseup', stopStagePan);
    syncCanvasViewport();
  }

  function onStageMouseDown(event: MouseEvent): void {
    if (isStagePanning.value || !stageRef.value || !shouldStartPan(event)) {
      return;
    }

    event.preventDefault();
    isStagePanning.value = true;
    stagePanState.startX = event.clientX;
    stagePanState.startY = event.clientY;
    stagePanState.scrollLeft = stageOverflow.value === 'auto' ? stageRef.value.scrollLeft : canvasOffsetX.value;
    stagePanState.scrollTop = stageOverflow.value === 'auto' ? stageRef.value.scrollTop : canvasOffsetY.value;

    window.addEventListener('mousemove', handleStagePan);
    window.addEventListener('mouseup', stopStagePan);
  }

  function onStageScroll(): void {
    fabricCanvas.value?.calcOffset();
  }

  function bindCanvasPan(canvas: Canvas): void {
    canvas.upperCanvasEl?.addEventListener('mousedown', onStageMouseDown);
    canvas.lowerCanvasEl?.addEventListener('mousedown', onStageMouseDown);
  }

  function unbindCanvasPan(canvas: Canvas): void {
    canvas.upperCanvasEl?.removeEventListener('mousedown', onStageMouseDown);
    canvas.lowerCanvasEl?.removeEventListener('mousedown', onStageMouseDown);
  }

  async function loadImage(): Promise<void> {
    const canvas = fabricCanvas.value;
    if (!canvas || !currentImageUrl.value) {
      return;
    }

    isLoading.value = true;
    errorMessage.value = '';

    try {
      const image = await FabricImage.fromURL(currentImageUrl.value);
      image.set({
        left: 0,
        top: 0,
        originX: 'left',
        originY: 'top',
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
        lockMovementX: true,
        lockMovementY: true,
        name: INLINE_IMAGE_BACKGROUND_NAME,
        hoverCursor: 'default',
      });

      canvas.clear();
      imageWidth.value = image.width || 1;
      imageHeight.value = image.height || 1;
      canvas.setDimensions({width: imageWidth.value, height: imageHeight.value});
      zoom.value = 1;
      setCanvasOffset(0, 0);
      updateDialogSize();
      await nextTick();
      updateCanvasScale();
      canvas.add(image);
      canvas.sendObjectToBack(image);
      canvas.requestRenderAll();
      resetHistory();
      captureHistory(true);

      const suggestedWidth = Math.round(Math.max(3, Math.min(15, imageWidth.value / 300)));
      brushWidth.value = normalizeBrushWidth(suggestedWidth);
      setTool(toolMode.value);
    } catch (error) {
      console.error('[inlineImage] Failed to load draw image:', error);
      errorMessage.value = t('inlineImage.drawDialog.loadFailed');
    } finally {
      isLoading.value = false;
    }
  }

  async function initCanvas(): Promise<void> {
    disposeCanvas();
    errorMessage.value = '';

    if (!canvasRef.value) {
      return;
    }

    const canvas = new Canvas(canvasRef.value, {
      selection: false,
      preserveObjectStacking: true,
    });

    fabricCanvas.value = canvas;
    bindCanvasPan(canvas);
    canvas.on('path:created', onPathCreated);
    canvas.on('object:modified', onObjectModified);
    canvas.on('object:added', onObjectAdded);
    canvas.freeDrawingBrush = createBrush() ?? undefined;
    if (canvas.upperCanvasEl) {
      canvas.upperCanvasEl.style.touchAction = 'none';
    }
    if (canvas.lowerCanvasEl) {
      canvas.lowerCanvasEl.style.touchAction = 'none';
    }

    updateDialogSize();
    await loadImage();
  }

  function disposeCanvas(): void {
    if (!fabricCanvas.value) {
      return;
    }

    unbindCanvasPan(fabricCanvas.value);
    fabricCanvas.value.off('path:created', onPathCreated);
    fabricCanvas.value.off('object:modified', onObjectModified);
    fabricCanvas.value.off('object:added', onObjectAdded);
    fabricCanvas.value.dispose();
    fabricCanvas.value = null;
  }

  async function saveImage(): Promise<void> {
    if (!currentView.value || !currentTagId.value || !currentAssetRef.value || !canvasRef.value || isLoading.value || isSaving.value) {
      return;
    }

    isSaving.value = true;
    errorMessage.value = '';

    try {
      const previousAssetRef = currentAssetRef.value;
      const previousImageUrl = currentImageUrl.value;
      const previousWidth = imageWidth.value;
      const previousHeight = imageHeight.value;
      const blob = await canvasToPngBlob(canvasRef.value);
      const updatedAsset = await importImageBlob(blob, 'inline-image-drawn.png');
      const updatedImageUrl = buildVersionedInlineImageUrl(updatedAsset);

      try {
        updateInlineImageData(currentView.value, currentTagId.value, {
          assetRef: updatedAsset.id,
          file: updatedImageUrl,
          width: updatedAsset.width,
          height: updatedAsset.height,
        });
        await deleteImageAsset(previousAssetRef);
      } catch (error) {
        updateInlineImageData(currentView.value, currentTagId.value, {
          assetRef: previousAssetRef,
          file: previousImageUrl,
          width: previousWidth,
          height: previousHeight,
        });
        try {
          await deleteImageAsset(updatedAsset.id);
        } catch (cleanupError) {
          console.error('[inlineImage] Failed to cleanup imported draw image:', cleanupError);
        }
        throw error;
      }

      inlineImageDrawManager.hide();
    } catch (error) {
      console.error('[inlineImage] Failed to save draw image:', error);
      errorMessage.value = t('inlineImage.drawDialog.saveFailed');
    } finally {
      isSaving.value = false;
    }
  }

  function closeDialog(): void {
    inlineImageDrawManager.hide();
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (!isVisible.value) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeDialog();
      return;
    }

    const target = event.target as HTMLElement | null;
    const tagName = target?.tagName?.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target?.isContentEditable) {
      return;
    }

    const isMod = event.metaKey || event.ctrlKey;
    if (isMod && event.key === 'Enter') {
      event.preventDefault();
      void saveImage();
      return;
    }

    if (event.key === 'Backspace' || event.key === 'Delete') {
      if (deleteSelection()) {
        event.preventDefault();
      }
      return;
    }

    if (!isMod) {
      return;
    }

    const lowerKey = event.key.toLowerCase();
    if (lowerKey === 'z' && !event.shiftKey) {
      event.preventDefault();
      undo();
      return;
    }
    if ((lowerKey === 'z' && event.shiftKey) || lowerKey === 'y') {
      event.preventDefault();
      redo();
    }
  }

  return {
    dialogRef,
    headerRef,
    contentRef,
    footerRef,
    stageRef,
    canvasRef,
    dialogWidth,
    dialogHeight,
    dialogStyle,
    isVisible,
    isLoading,
    isSaving,
    errorMessage,
    toolMode,
    brushColor,
    brushWidth,
    brushWidthOptions,
    zoomLabel,
    imageWidth,
    imageHeight,
    canUndo,
    canRedo,
    stagePaddingX,
    stagePaddingY,
    stageOverflow,
    stageCursor,
    setTool,
    undo,
    redo,
    zoomOut,
    zoomIn,
    resetZoom,
    handleWheel,
    onStageMouseDown,
    onStageScroll,
    saveImage,
    closeDialog,
    isStagePanning,
  };
}
