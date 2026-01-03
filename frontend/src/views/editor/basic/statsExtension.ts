import {Extension} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import {DocumentStats} from '@/stores/editorStateStore';
import {getActiveNoteBlock} from '@/views/editor/extensions/codeblock/state';

// 更新编辑器文档统计信息
export const updateStats = (
  view: EditorView, 
  updateDocumentStats: (stats: DocumentStats) => void
) => {
  if (!view) return;
  
  const state = view.state;
  
  // 获取当前光标所在的代码块
  const activeBlock = getActiveNoteBlock(state as any);
  
  if (!activeBlock) {
    // 如果没有活动块，显示空统计
    updateDocumentStats({
      lines: 0,
      characters: 0,
      selectedCharacters: 0
    });
    return;
  }
  
  // 获取当前块的内容范围
  const blockContent = state.doc.sliceString(activeBlock.content.from, activeBlock.content.to);
  
  // 计算块内容的行数
  const blockLines = blockContent.split('\n').length;
  
  // 计算选中的字符数（只统计在当前块内的选中内容）
  let selectedChars = 0;
  const selections = state.selection;
  if (selections) {
    for (let i = 0; i < selections.ranges.length; i++) {
      const range = selections.ranges[i];
      // 计算选中范围与当前块内容范围的交集
      const selectionStart = Math.max(range.from, activeBlock.content.from);
      const selectionEnd = Math.min(range.to, activeBlock.content.to);
      if (selectionStart < selectionEnd) {
        selectedChars += selectionEnd - selectionStart;
      }
    }
  }
  
  updateDocumentStats({
    lines: blockLines,
    characters: blockContent.length,
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