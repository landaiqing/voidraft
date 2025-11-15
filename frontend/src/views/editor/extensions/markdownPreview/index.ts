/**
 * Markdown 预览扩展主入口
 */
import { EditorView } from "@codemirror/view";
import { useThemeStore } from "@/stores/themeStore";
import { usePanelStore } from "@/stores/panelStore";
import { useDocumentStore } from "@/stores/documentStore";
import { getActiveNoteBlock } from "../codeblock/state";
import { createMarkdownPreviewTheme } from "./styles";
import { previewPanelState, previewPanelPlugin, togglePreview, closePreviewWithAnimation } from "./state";

/**
 * 切换预览面板的命令
 */
export function toggleMarkdownPreview(view: EditorView): boolean {
  const panelStore = usePanelStore();
  const documentStore = useDocumentStore();
  const currentState = view.state.field(previewPanelState, false);
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
  
  // 如果预览面板已打开（无论预览的是不是当前块），关闭预览
  if (panelStore.markdownPreview.isOpen && !panelStore.markdownPreview.isClosing) {
    // 使用带动画的关闭函数
    closePreviewWithAnimation(view);
  } else {
    // 否则，打开当前块的预览
    view.dispatch({
      effects: togglePreview.of({
        documentId: currentDocumentId,
        blockFrom: activeBlock.content.from,
        blockTo: activeBlock.content.to
      })
    });
    
    // 注意：store 状态由 ViewPlugin 在面板创建成功后更新
  }

  return true;
}

/**
 * 导出 Markdown 预览扩展
 */
export function markdownPreviewExtension() {
  const themeStore = useThemeStore();
  const colors = themeStore.currentColors;
  
  const theme = colors ? createMarkdownPreviewTheme(colors) : EditorView.baseTheme({});
  
  return [previewPanelState, previewPanelPlugin, theme];
}
