import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { useEditorStore } from '@/stores/editorStore';

/**
 * 内容变化监听插件 - 集成文档和编辑器管理
 */
export function createContentChangePlugin() {
  return ViewPlugin.fromClass(
    class ContentChangePlugin {
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
        
        this.editorStore.onContentChange();
        
      }

      destroy() {

      }
    }
  );
} 