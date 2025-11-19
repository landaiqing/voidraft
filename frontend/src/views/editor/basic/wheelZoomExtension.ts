import {EditorView} from '@codemirror/view';
import type {Extension} from '@codemirror/state';

type FontAdjuster = () => Promise<void> | void;

const runAdjuster = (adjuster: FontAdjuster) => {
  try {
    const result = adjuster();
    if (result && typeof (result as Promise<void>).then === 'function') {
      (result as Promise<void>).catch((error) => {
        console.error('Failed to adjust font size:', error);
      });
    }
  } catch (error) {
    console.error('Failed to adjust font size:', error);
  }
};

export const createWheelZoomExtension = (
  increaseFontSize: FontAdjuster,
  decreaseFontSize: FontAdjuster
): Extension => {
  return EditorView.domEventHandlers({
    wheel(event) {
      if (!event.ctrlKey) {
        return false;
      }

      event.preventDefault();

      if (event.deltaY < 0) {
        runAdjuster(increaseFontSize);
      } else if (event.deltaY > 0) {
        runAdjuster(decreaseFontSize);
      }

      return true;
    }
  });
};
