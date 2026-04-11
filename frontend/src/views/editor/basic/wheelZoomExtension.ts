import type {Extension} from '@codemirror/state';
import {EditorView, ViewPlugin} from '@codemirror/view';
import {createDebounce} from '@/common/utils/debounce';

type FontAdjuster = () => void;
type FontDeltaAdjuster = (delta: number) => void;
type SaveCallback = () => Promise<void> | void;

export interface WheelZoomOptions {
  increaseFontSize?: FontAdjuster;
  decreaseFontSize?: FontAdjuster;
  adjustFontSize?: FontDeltaAdjuster;
  onSave?: SaveCallback;
  saveDelay?: number;
}

export const createWheelZoomExtension = (options: WheelZoomOptions): Extension => {
  const {increaseFontSize, decreaseFontSize, adjustFontSize, onSave, saveDelay = 300} = options;

  const {debouncedFn: debouncedSave} = onSave
    ? createDebounce(() => {
        try {
          const result = onSave();
          if (result && typeof (result as Promise<void>).then === 'function') {
            (result as Promise<void>).catch((error) => {
              console.error('Failed to save font size:', error);
            });
          }
        } catch (error) {
          console.error('Failed to save font size:', error);
        }
      }, {delay: saveDelay})
    : {debouncedFn: null};

  return ViewPlugin.fromClass(class {
    private pendingDelta = 0;
    private frameId: number | null = null;
    private readonly domWindow: Window;
    private readonly onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (event.deltaY < 0) {
        this.pendingDelta += 1;
      } else if (event.deltaY > 0) {
        this.pendingDelta -= 1;
      }

      if (this.pendingDelta !== 0 && this.frameId === null) {
        this.frameId = this.domWindow.requestAnimationFrame(this.flushPendingDelta);
      }

      if (debouncedSave) {
        debouncedSave();
      }
    };

    constructor(private readonly view: EditorView) {
      this.domWindow = this.view.dom.ownerDocument.defaultView ?? window;
      this.view.dom.addEventListener('wheel', this.onWheel, {
        capture: true,
        passive: false,
      });
    }

    destroy() {
      this.view.dom.removeEventListener('wheel', this.onWheel, true);

      if (this.frameId !== null) {
        this.domWindow.cancelAnimationFrame(this.frameId);
      }
    }

    private readonly flushPendingDelta = () => {
      this.frameId = null;

      if (this.pendingDelta === 0) {
        return;
      }

      const delta = this.pendingDelta;
      this.pendingDelta = 0;

      if (adjustFontSize) {
        adjustFontSize(delta);
        return;
      }

      const applyStep = delta > 0 ? increaseFontSize : decreaseFontSize;
      if (!applyStep) {
        return;
      }

      for (let index = 0; index < Math.abs(delta); index++) {
        applyStep();
      }
    };
  });
};
