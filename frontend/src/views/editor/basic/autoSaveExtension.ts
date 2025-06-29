import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { useDocumentStore } from '@/stores/documentStore';

// 自动保存配置选项
export interface AutoSaveOptions {
  // 防抖延迟（毫秒）
  debounceDelay?: number;
  // 保存状态回调
  onSaveStart?: () => void;
  onSaveSuccess?: () => void;
  onSaveError?: () => void;
}

/**
 * 简单防抖函数
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T & { cancel: () => void } {
  let timeoutId: number | null = null;
  
  const debounced = ((...args: Parameters<T>) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = window.setTimeout(() => {
      timeoutId = null;
      func(...args);
    }, delay);
  }) as T & { cancel: () => void };
  
  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
  
  return debounced;
}

/**
 * 创建自动保存插件
 */
export function createAutoSavePlugin(options: AutoSaveOptions = {}) {
  const {
    debounceDelay = 2000,
    onSaveStart = () => {},
    onSaveSuccess = () => {},
    onSaveError = () => {}
  } = options;

  return ViewPlugin.fromClass(
    class AutoSavePlugin {
      private documentStore = useDocumentStore();
      private debouncedSave: ((content: string) => void) & { cancel: () => void };
      private isDestroyed = false;
      private lastContent = '';

      constructor(private view: EditorView) {
        this.lastContent = view.state.doc.toString();
        this.debouncedSave = debounce(
          (content: string) => this.performSave(content),
          debounceDelay
        );
      }

      private async performSave(content: string): Promise<void> {
        if (this.isDestroyed) return;

        try {
          onSaveStart();
          const success = await this.documentStore.saveDocumentContent(content);
          
          if (success) {
            this.lastContent = content;
            onSaveSuccess();
          } else {
            onSaveError();
          }
        } catch (error) {
          onSaveError();
        }
      }

      update(update: ViewUpdate) {
        if (!update.docChanged || this.isDestroyed) return;

        const newContent = this.view.state.doc.toString();
        if (newContent === this.lastContent) return;

        this.debouncedSave(newContent);
      }

      destroy() {
        this.isDestroyed = true;
        this.debouncedSave.cancel();
        
        // 如果内容有变化，立即保存
        const currentContent = this.view.state.doc.toString();
        if (currentContent !== this.lastContent) {
          this.documentStore.saveDocumentContent(currentContent).catch(() => {});
        }
      }
    }
  );
}