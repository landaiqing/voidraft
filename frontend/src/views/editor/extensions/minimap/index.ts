/**
 * Minimap Extension Entry
 * Uses block rendering for visible area only
 */

import { Facet } from '@codemirror/state';
import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { Overlay } from './overlay';
import { Config, Options, Scale } from './config';
import { DiagnosticState, diagnostics } from './diagnostics';
import { SelectionState, selections } from './selections';
import { LinesState, foldsChanged } from './linesState';
import { BlockManager } from './blockManager';
import crelt from 'crelt';
import { GUTTER_WIDTH, drawLineGutter } from './gutters';
import { createDebounce } from '@/common/utils/debounce';

const Theme = EditorView.theme({
  '&': {
    height: '100%',
    overflowY: 'auto',
  },
  '& .cm-minimap-gutter': {
    borderRight: 0,
    flexShrink: 0,
    left: 'unset',
    position: 'sticky',
    right: 0,
    top: 0,
  },
  // 初始化时隐藏，避免宽度未设置时闪烁
  '& .cm-minimap-initializing': {
    opacity: 0,
  },
  '& .cm-minimap-autohide': {
    opacity: 0.0,
    transition: 'opacity 0.3s',
  },
  '& .cm-minimap-autohide:hover': {
    opacity: 1.0,
  },
  '& .cm-minimap-inner': {
    height: '100%',
    position: 'absolute',
    right: 0,
    top: 0,
    overflowY: 'hidden',
    '& canvas': {
      display: 'block',
      willChange: 'transform, opacity',
    },
  },
  '& .cm-minimap-box-shadow': {
    boxShadow: '12px 0px 20px 5px #6c6c6c',
  },
});

const WIDTH_RATIO = 6;
type RenderReason = 'scroll' | 'data';

// 渲染类型：blocks=块内容变化需要重渲染, overlays=只需重绘选区等覆盖层
type RenderType = 'blocks' | 'overlays';

const minimapClass = ViewPlugin.fromClass(
  class {
    private dom: HTMLElement | undefined;
    private inner: HTMLElement | undefined;
    private canvas: HTMLCanvasElement | undefined;
    private renderHandle: number | ReturnType<typeof setTimeout> | null = null;
    private cancelRender: (() => void) | null = null;
    private pendingScrollTop: number | null = null;
    private lastRenderedScrollTop: number = -1;
    private pendingRenderReason: RenderReason | null = null;
    private pendingRenderType: RenderType | null = null;

    // 块管理器（Worker 渲染）
    private blockManager: BlockManager;
    public selection: SelectionState;
    public diagnostic: DiagnosticState;

    // 等待滚动位置稳定
    private initialRenderDelay: ReturnType<typeof setTimeout> | null = null;
    private isInitialized = false;
    private hasRenderedOnce = false; // 是否已首次渲染
    private lastScrollTop = -1;
    private scrollStableCount = 0;

    // 块渲染防抖（500ms）
    private debouncedBlockRender: ReturnType<typeof createDebounce>['debouncedFn'];
    private cancelDebounce: () => void;

    public constructor(private view: EditorView) {
      this.blockManager = new BlockManager(view);
      this.selection = selections(view);
      this.diagnostic = diagnostics(view);

      // 创建防抖的块渲染函数
      const { debouncedFn, cancel } = createDebounce(() => {
        this.requestRender('data', 'blocks');
      }, { delay: 1000 });
      this.debouncedBlockRender = debouncedFn;
      this.cancelDebounce = cancel;
      
      // 当块渲染完成时，请求重新渲染（只渲染 overlays）
      this.blockManager.setOnBlockReady(() => {
        if (this.isInitialized) {
          this.requestRender('data', 'overlays');
        }
      });

      if (view.state.facet(showMinimapFacet)) {
        this.create(view);
        this.waitForScrollStable();
      }
    }

    // 等待滚动位置稳定后再渲染
    private waitForScrollStable(): void {
      const check = () => {
        const scrollTop = this.view.scrollDOM.scrollTop;
        
        if (scrollTop === this.lastScrollTop) {
          this.scrollStableCount++;
          // 连续 3 次检测位置不变，认为稳定
          if (this.scrollStableCount >= 3) {
            this.isInitialized = true;
            this.initialRenderDelay = null;
            this.requestRender('data', 'blocks');
            return;
          }
        } else {
          this.scrollStableCount = 0;
          this.lastScrollTop = scrollTop;
        }
        
        // 每 20ms 检测一次，最多等待 200ms
        if (this.scrollStableCount < 10) {
          this.initialRenderDelay = setTimeout(check, 20);
        } else {
          this.isInitialized = true;
          this.initialRenderDelay = null;
          this.requestRender('data', 'blocks');
        }
      };
      
      this.initialRenderDelay = setTimeout(check, 20);
    }

    private create(view: EditorView) {
      const config = view.state.facet(showMinimapFacet);
      if (!config) {
        throw Error('Expected nonnull');
      }

      this.inner = crelt('div', { class: 'cm-minimap-inner' });
      this.canvas = crelt('canvas') as HTMLCanvasElement;

      this.dom = config.create(view).dom;
      this.dom.classList.add('cm-gutters');
      this.dom.classList.add('cm-minimap-gutter');
      this.dom.classList.add('cm-minimap-initializing'); // 初始隐藏

      this.inner.appendChild(this.canvas);
      this.dom.appendChild(this.inner);

      this.view.scrollDOM.insertBefore(
        this.dom,
        this.view.contentDOM.nextSibling
      );

      for (const key in this.view.state.facet(Config).eventHandlers) {
        const handler = this.view.state.facet(Config).eventHandlers[key];
        if (handler) {
          this.dom.addEventListener(key, (e) => handler(e, this.view));
        }
      }

      if (config.autohide) {
        this.dom.classList.add('cm-minimap-autohide');
      }

      // 设置显示模式
      this.blockManager.setDisplayText(view.state.facet(Config).displayText);
    }

    private remove() {
      this.cancelRenderRequest();
      if (this.dom) {
        this.dom.remove();
      }
      this.dom = undefined;
      this.inner = undefined;
      this.canvas = undefined;
      this.hasRenderedOnce = false; // 重置首次渲染标记
    }

    update(update: ViewUpdate) {
      const prev = update.startState.facet(showMinimapFacet);
      const now = update.state.facet(showMinimapFacet);

      if (prev && !now) {
        this.remove();
        return;
      }

      if (!prev && now) {
        this.create(update.view);
      }

      if (now) {
        let needBlockRender = false;
        let needOverlayRender = false;
        
        if (prev && this.dom && prev.autohide !== now.autohide) {
          if (now.autohide) {
            this.dom.classList.add('cm-minimap-autohide');
          } else {
            this.dom.classList.remove('cm-minimap-autohide');
          }
        }

        // Check theme change
        if (this.blockManager.checkThemeChange()) {
          needBlockRender = true;
        }

        // Check config change
        const prevConfig = update.startState.facet(Config);
        const nowConfig = update.state.facet(Config);
        if (prevConfig.displayText !== nowConfig.displayText) {
          this.blockManager.setDisplayText(nowConfig.displayText);
          needBlockRender = true;
        }

        // Check doc change
        if (update.docChanged) {
          const oldLineCount = update.startState.doc.lines;
          this.blockManager.handleDocChange(update.state, update.changes, oldLineCount);
          needBlockRender = true;
        }

        // Check fold change
        if (foldsChanged(update.transactions)) {
          this.blockManager.markAllDirty();
          needBlockRender = true;
        }

        // Update selection and diagnostics
        this.selection.update(update);
        this.diagnostic.update(update);
        if (update.selectionSet) {
          needOverlayRender = true;
        }

        // 根据变化类型决定渲染方式
        if (needBlockRender) {
          this.debouncedBlockRender();
        } else if (needOverlayRender) {
          this.requestRender('data', 'overlays');
        }
      }
    }

    getWidth(): number {
      const editorWidth = this.view.dom.clientWidth;
      if (editorWidth <= Scale.MaxWidth * WIDTH_RATIO) {
        const ratio = editorWidth / (Scale.MaxWidth * WIDTH_RATIO);
        return Scale.MaxWidth * ratio;
      }
      return Scale.MaxWidth;
    }

    render() {
      if (!this.dom || !this.canvas || !this.inner) {
        return;
      }

      const effectiveScrollTop = this.pendingScrollTop ?? this.view.scrollDOM.scrollTop;
      const renderType = this.pendingRenderType ?? 'blocks';
      this.pendingScrollTop = null;
      this.pendingRenderReason = null;
      this.pendingRenderType = null;
      this.lastRenderedScrollTop = effectiveScrollTop;

      this.updateBoxShadow();

      // Set canvas size
      const width = this.getWidth();
      this.dom.style.width = width + 'px';
      this.canvas.style.maxWidth = width + 'px';
      this.canvas.width = width * Scale.PixelMultiplier;

      const domHeight = this.view.dom.getBoundingClientRect().height;
      this.inner.style.minHeight = domHeight + 'px';
      this.canvas.height = domHeight * Scale.PixelMultiplier;
      this.canvas.style.height = domHeight + 'px';

      const context = this.canvas.getContext('2d');
      if (!context) {
        return;
      }

      // Get scroll info
      const scrollInfo = {
        scrollTop: effectiveScrollTop,
        clientHeight: this.view.scrollDOM.clientHeight,
        scrollHeight: this.view.scrollDOM.scrollHeight,
      };

      // 渲染块
      if (renderType === 'blocks') {
        this.blockManager.render(this.canvas, context, scrollInfo);
      } else {
        this.blockManager.drawCachedBlocks(this.canvas, context, scrollInfo);
      }

      // Render overlays (gutters, selections, diagnostics)
      const gutters = this.view.state.facet(Config).gutters;
      this.renderOverlays(context, effectiveScrollTop, gutters);

      // 首次渲染完成后显示 minimap
      if (!this.hasRenderedOnce && this.dom) {
        this.hasRenderedOnce = true;
        this.dom.classList.remove('cm-minimap-initializing');
      }
    }

    /**
     * 渲染覆盖层（gutters、选区、诊断）
     */
    private renderOverlays(
      context: CanvasRenderingContext2D,
      scrollTop: number,
      gutters: Required<Options>['gutters']
    ) {
      const { charWidth, lineHeight } = this.blockManager.measure(context);
      const { startIndex, endIndex, offsetY: initialOffsetY } = this.canvasStartAndEndIndex(
        context,
        lineHeight,
        scrollTop
      );

      const lines = this.view.state.field(LinesState);
      let offsetY = initialOffsetY;

      for (let i = startIndex; i < endIndex; i++) {
        if (i >= lines.length) break;

        let offsetX = 0;
        const lineNumber = i + 1;

        // 渲染 gutters
        if (gutters.length) {
          offsetX += 2;
          for (const gutter of gutters) {
            drawLineGutter(gutter, { offsetX, offsetY, context, lineHeight, charWidth }, lineNumber);
            offsetX += GUTTER_WIDTH;
          }
          offsetX += 2;
        }

        // 渲染选区
        this.selection.drawLine({ offsetX, offsetY, context, lineHeight, charWidth }, lineNumber);

        // 渲染诊断
        if (this.diagnostic.has(lineNumber)) {
          this.diagnostic.drawLine({ offsetX, offsetY, context, lineHeight, charWidth }, lineNumber);
        }

        offsetY += lineHeight;
      }
    }

    requestRender(reason: RenderReason = 'data', type: RenderType = 'blocks') {
      if (!this.isInitialized) {
        return;
      }

      if (reason === 'scroll') {
        const scrollTop = this.view.scrollDOM.scrollTop;
        if (this.lastRenderedScrollTop === scrollTop && !this.pendingRenderReason) {
          return;
        }
        if (
          this.pendingRenderReason === 'scroll' &&
          this.pendingScrollTop === scrollTop
        ) {
          return;
        }
        this.pendingScrollTop = scrollTop;
      } else {
        this.pendingScrollTop = null;
      }

      if (reason === 'data' || this.pendingRenderReason === null) {
        this.pendingRenderReason = reason;
      }

      // 合并渲染类型：blocks > overlays
      if (this.pendingRenderType === null || type === 'blocks') {
        this.pendingRenderType = type;
      }

      if (this.renderHandle !== null) {
        return;
      }

      if (typeof requestAnimationFrame === 'function') {
        const handle = requestAnimationFrame(() => {
          this.renderHandle = null;
          this.cancelRender = null;
          this.render();
        });
        this.renderHandle = handle;
        this.cancelRender = () => cancelAnimationFrame(handle);
        return;
      }

      const handle = setTimeout(() => {
        this.renderHandle = null;
        this.cancelRender = null;
        this.render();
      }, 16);
      this.renderHandle = handle;
      this.cancelRender = () => clearTimeout(handle);
    }

    cancelRenderRequest() {
      if (!this.cancelRender) {
        return;
      }
      this.cancelRender();
      this.renderHandle = null;
      this.cancelRender = null;
      this.pendingScrollTop = null;
      this.pendingRenderReason = null;
    }

    private canvasStartAndEndIndex(
      context: CanvasRenderingContext2D,
      lineHeight: number,
      scrollTopOverride?: number
    ) {
      let { top: pTop, bottom: pBottom } = this.view.documentPadding;
      (pTop /= Scale.SizeRatio), (pBottom /= Scale.SizeRatio);

      const canvasHeight = context.canvas.height;
      const { clientHeight, scrollHeight } = this.view.scrollDOM;
      const scrollTop = scrollTopOverride ?? this.view.scrollDOM.scrollTop;
      let scrollPercent = scrollTop / (scrollHeight - clientHeight);
      if (isNaN(scrollPercent)) {
        scrollPercent = 0;
      }

      const lineCount = this.view.state.field(LinesState).length;
      const totalHeight = pTop + pBottom + lineCount * lineHeight;

      const canvasTop = Math.max(
        0,
        scrollPercent * (totalHeight - canvasHeight)
      );
      const offsetY = Math.max(0, pTop - canvasTop);

      const startIndex = Math.round(Math.max(0, canvasTop - pTop) / lineHeight);
      const spaceForLines = Math.round((canvasHeight - offsetY) / lineHeight);

      return {
        startIndex,
        endIndex: startIndex + spaceForLines,
        offsetY,
      };
    }

    private updateBoxShadow() {
      if (!this.canvas) {
        return;
      }

      const { clientWidth, scrollWidth, scrollLeft } = this.view.scrollDOM;

      if (clientWidth + scrollLeft < scrollWidth) {
        this.canvas.classList.add('cm-minimap-box-shadow');
      } else {
        this.canvas.classList.remove('cm-minimap-box-shadow');
      }
    }

    destroy() {
      if (this.initialRenderDelay) {
        clearTimeout(this.initialRenderDelay);
        this.initialRenderDelay = null;
      }
      this.cancelDebounce();
      this.blockManager.destroy();
      this.remove();
    }
  },
  {
    eventHandlers: {
      scroll() {
        this.requestRender('scroll', 'blocks');
      },
    },
    provide: (plugin) => {
      return EditorView.scrollMargins.of((view) => {
        const width = view.plugin(plugin)?.getWidth();
        if (!width) {
          return null;
        }

        return { right: width };
      });
    },
  }
);

export type MinimapConfig = Omit<Options, 'enabled'> & {
  /**
   * A function that creates the element that contains the minimap
   */
  create: (view: EditorView) => { dom: HTMLElement };
};

/**
 * Facet used to show a minimap in the right gutter of the editor using the
 * provided configuration.
 */
const showMinimapFacet = Facet.define<MinimapConfig | null, MinimapConfig | null>({
  combine: (c) => c.find((o) => o !== null) ?? null,
});

/**
 * 创建默认的 minimap DOM 元素
 */
const defaultCreateFn = (_view: EditorView) => {
  const dom = document.createElement('div');
  return { dom };
};

/**
 * 添加 minimap 到编辑器
 * @param options Minimap 配置项
 */
export function minimap(options: Partial<Omit<MinimapConfig, 'create'>> = {}) {
  const config: MinimapConfig = {
    create: defaultCreateFn,
    ...options,
  };

  return [
    showMinimapFacet.of(config),
    Config.compute([showMinimapFacet], (s) => s.facet(showMinimapFacet)),
    Theme,
    LinesState,
    minimapClass,
    Overlay,
  ];
}
