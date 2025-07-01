import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { useDocumentStore } from '@/stores/documentStore';
import { useEditorStore } from '@/stores/editorStore';

/**
 * 内容变化监听插件 - 集成文档和编辑器管理
 */
export function createContentChangePlugin() {
  return ViewPlugin.fromClass(
    class ContentChangePlugin {
      private documentStore = useDocumentStore();
      private editorStore = useEditorStore();
      private lastContent = '';

      constructor(private view: EditorView) {
        this.lastContent = view.state.doc.toString();
      }

      update(update: ViewUpdate) {
        if (!update.docChanged) return;

        const newContent = this.view.state.doc.toString();
        if (newContent === this.lastContent) return;

        this.lastContent = newContent;
        
        // 通知编辑器管理器内容已变化
        const currentDocId = this.documentStore.currentDocumentId;
        if (currentDocId) {
          this.editorStore.onContentChange(currentDocId);
        }
      }

      destroy() {

      }
    }
  );
} 