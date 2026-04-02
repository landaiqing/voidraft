import type {Extension} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
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

  let pendingDelta = 0;
  let frameId: number | null = null;

  const flushPendingDelta = () => {
    frameId = null;

    if (pendingDelta === 0) {
      return;
    }

    const delta = pendingDelta;
    pendingDelta = 0;

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

  return EditorView.domEventHandlers({
    wheel(event) {
      if (!event.ctrlKey) {
        return false;
      }

      event.preventDefault();

      if (event.deltaY < 0) {
        pendingDelta += 1;
      } else if (event.deltaY > 0) {
        pendingDelta -= 1;
      }

      if (pendingDelta !== 0 && frameId === null) {
        frameId = requestAnimationFrame(flushPendingDelta);
      }

      if (debouncedSave) {
        debouncedSave();
      }

      return true;
    }
  });
};
