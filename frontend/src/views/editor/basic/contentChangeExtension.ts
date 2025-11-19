import {EditorView, ViewPlugin, ViewUpdate} from '@codemirror/view';
import type {Text} from '@codemirror/state';
import {useEditorStore} from '@/stores/editorStore';

/**
 */
export function createContentChangePlugin() {
  return ViewPlugin.fromClass(
    class ContentChangePlugin {
      private readonly editorStore = useEditorStore();
      private lastDoc: Text;
      private rafId: number | null = null;
      private pendingNotification = false;

      constructor(private view: EditorView) {
        this.lastDoc = view.state.doc;
      }

      update(update: ViewUpdate) {
        if (!update.docChanged || update.state.doc === this.lastDoc) {
          return;
        }

        this.lastDoc = update.state.doc;
        this.scheduleNotification();
      }

      destroy() {
        if (this.rafId !== null) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
        this.pendingNotification = false;
      }

      private scheduleNotification() {
        if (this.pendingNotification) return;

        this.pendingNotification = true;
        this.rafId = requestAnimationFrame(() => {
          this.pendingNotification = false;
          this.rafId = null;
          this.editorStore.onContentChange();
        });
      }
    }
  );
}
