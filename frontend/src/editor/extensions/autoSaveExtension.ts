import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { DocumentService } from '@/../bindings/voidraft/internal/services';
import { useDebounceFn } from '@vueuse/core';

// 定义自动保存配置选项
export interface AutoSaveOptions {
  // 保存回调
  onSave?: (success: boolean) => void;
  // 内容变更延迟传递（毫秒）- 输入时不会立即发送，有一个小延迟，避免频繁调用后端
  debounceDelay?: number;
}

/**
 * 创建自动保存插件
 * @param options 配置选项
 * @returns EditorView.Plugin
 */
export function createAutoSavePlugin(options: AutoSaveOptions = {}) {
  const { 
    onSave = () => {},
    debounceDelay = 1000  // 默认1000ms延迟，原为300ms
  } = options;

  return ViewPlugin.fromClass(
    class {
      private isActive: boolean = true;
      private isSaving: boolean = false;
      private contentUpdateFn: (view: EditorView) => void;

      constructor(private view: EditorView) {
        // 创建内容更新函数
        this.contentUpdateFn = this.createDebouncedUpdateFn(debounceDelay);
      }

      /**
       * 创建防抖的内容更新函数
       */
      private createDebouncedUpdateFn(delay: number): (view: EditorView) => void {
        // 使用VueUse的防抖函数创建一个新函数
        return useDebounceFn(async (view: EditorView) => {
          // 如果插件已不活跃或正在保存中，不发送
          if (!this.isActive || this.isSaving) return;
          
          this.isSaving = true;
          const content = view.state.doc.toString();
          
          try {
            await DocumentService.UpdateActiveDocumentContent(content);
            onSave(true);
          } catch (err) {
            console.error('Failed to update document content:', err);
            onSave(false);
          } finally {
            this.isSaving = false;
          }
        }, delay);
      }

      update(update: ViewUpdate) {
        // 如果内容没有变化，直接返回
        if (!update.docChanged) return;

        // 调用防抖函数
        this.contentUpdateFn(this.view);
      }

      destroy() {
        // 标记插件不再活跃
        this.isActive = false;
        
        // 直接发送最终内容
        const content = this.view.state.doc.toString();
        DocumentService.UpdateActiveDocumentContent(content)
          .then(() => console.log('Successfully sent final content on destroy'))
          .catch(err => console.error('Failed to send content on destroy:', err));
      }
    }
  );
}

/**
 * 创建处理保存快捷键的插件
 * @param onSave 保存回调
 * @returns EditorView.Plugin
 */
export function createSaveShortcutPlugin(onSave: () => void) {
  return EditorView.domEventHandlers({
    keydown: (event) => {
      // Ctrl+S / Cmd+S
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        onSave();
        return true;
      }
      return false;
    }
  });
}

/**
 * 手动触发文档保存
 * @param view 编辑器视图
 * @returns Promise<boolean>
 */
export async function saveDocument(view: EditorView): Promise<boolean> {
  try {
    const content = view.state.doc.toString();
    // 更新内容
    await DocumentService.UpdateActiveDocumentContent(content);
    // 强制保存到磁盘
    await DocumentService.ForceSave();
    return true;
  } catch (err) {
    console.error('Failed to save document:', err);
    return false;
  }
} 