import {Extension} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import {DocumentStats} from '@/stores/editorStore';
// 更新编辑器文档统计信息
export const updateStats = (
  view: EditorView, 
  updateDocumentStats: (stats: DocumentStats) => void
) => {
  if (!view) return;
  
  const state = view.state;
  const doc = state.doc;
  const text = doc.toString();
  
  // 计算选中的字符数
  let selectedChars = 0;
  const selections = state.selection;
  if (selections) {
    for (let i = 0; i < selections.ranges.length; i++) {
      const range = selections.ranges[i];
      selectedChars += range.to - range.from;
    }
  }
  
  updateDocumentStats({
    lines: doc.lines,
    characters: text.length,
    selectedCharacters: selectedChars
  });
};

// 创建统计信息更新监听器扩展
export const createStatsUpdateExtension = (
  updateDocumentStats: (stats: DocumentStats) => void
): Extension => {
  return EditorView.updateListener.of(update => {
    if (update.docChanged || update.selectionSet) {
      updateStats(update.view, updateDocumentStats);
    }
  });
}; 