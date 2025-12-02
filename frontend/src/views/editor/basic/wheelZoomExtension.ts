import {EditorView} from '@codemirror/view';
import type {Extension} from '@codemirror/state';
import {createDebounce} from '@/common/utils/debounce';

type FontAdjuster = () => void;
type SaveCallback = () => Promise<void> | void;

export interface WheelZoomOptions {
  /** 增加字体大小的回调（立即执行） */
  increaseFontSize: FontAdjuster;
  /** 减少字体大小的回调（立即执行） */
  decreaseFontSize: FontAdjuster;
  /** 保存回调（防抖执行），在滚动结束后调用 */
  onSave?: SaveCallback;
  /** 保存防抖延迟（毫秒），默认 300ms */
  saveDelay?: number;
}

export const createWheelZoomExtension = (options: WheelZoomOptions): Extension => {
  const {increaseFontSize, decreaseFontSize, onSave, saveDelay = 300} = options;

  // 如果有 onSave 回调，创建防抖版本
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

  return EditorView.domEventHandlers({
    wheel(event) {
      if (!event.ctrlKey) {
        return false;
      }

      event.preventDefault();

      // 立即更新字体大小
      if (event.deltaY < 0) {
        increaseFontSize();
      } else if (event.deltaY > 0) {
        decreaseFontSize();
      }

      // 防抖保存
      if (debouncedSave) {
        debouncedSave();
      }

      return true;
    }
  });
};
