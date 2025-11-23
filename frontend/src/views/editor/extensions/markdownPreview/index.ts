import { EditorView, ViewUpdate, ViewPlugin } from "@codemirror/view";
import { Extension } from "@codemirror/state";
import { useDocumentStore } from "@/stores/documentStore";
import { getActiveNoteBlock } from "../codeblock/state";
import { markdownPreviewManager } from "./manager";

/**
 * 切换预览面板的命令
 */
export function toggleMarkdownPreview(view: EditorView): boolean {
  const documentStore = useDocumentStore();
  const activeBlock = getActiveNoteBlock(view.state as any);
  
  // 如果当前没有激活的 Markdown 块，不执行操作
  if (!activeBlock || activeBlock.language.name.toLowerCase() !== 'md') {
    return false;
  }
  
  // 获取当前文档ID
  const currentDocumentId = documentStore.currentDocumentId;
  if (currentDocumentId === null) {
    return false;
  }
  
  // 切换预览状态
  if (markdownPreviewManager.isVisible()) {
    markdownPreviewManager.hide();
  } else {
    markdownPreviewManager.show(
      view,
      currentDocumentId,
      activeBlock.content.from,
      activeBlock.content.to
    );
  }

  return true;
}

/**
 * 预览同步插件
 */
const previewSyncPlugin = ViewPlugin.fromClass(
  class {
    constructor(private view: EditorView) {}

    update(update: ViewUpdate) {
      // 只在预览可见时处理
      if (!markdownPreviewManager.isVisible()) {
        return;
      }

      const documentStore = useDocumentStore();
      const currentDocumentId = documentStore.currentDocumentId;
      const previewDocId = markdownPreviewManager.getCurrentDocumentId();

      // 如果切换了文档，关闭预览
      if (currentDocumentId !== previewDocId) {
        markdownPreviewManager.hide();
        return;
      }

      // 文档内容改变时，更新预览
      if (update.docChanged) {
        const activeBlock = getActiveNoteBlock(update.state as any);
        
        // 如果不再是 Markdown 块，关闭预览
        if (!activeBlock || activeBlock.language.name.toLowerCase() !== 'md') {
          markdownPreviewManager.hide();
          return;
        }

        const range = markdownPreviewManager.getCurrentBlockRange();
        
        // 如果切换到其他块，关闭预览
        if (range && activeBlock.content.from !== range.from) {
          markdownPreviewManager.hide();
          return;
        }

        // 更新预览内容
        const newContent = update.state.doc.sliceString(
          activeBlock.content.from,
          activeBlock.content.to
        );
        markdownPreviewManager.updateContent(
          newContent,
          activeBlock.content.from,
          activeBlock.content.to
        );
      }
    }

    destroy() {
      markdownPreviewManager.destroy();
    }
  }
);

/**
 * 导出 Markdown 预览扩展
 */
export function markdownPreviewExtension(): Extension {
  return [previewSyncPlugin];
}
