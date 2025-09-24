/**
 * 删除行功能
 * 处理代码块边界
 */

import { EditorSelection, SelectionRange } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { getNoteBlockFromPos } from "./state";

interface LineBlock {
  from: number;
  to: number;
  ranges: SelectionRange[];
}

/**
 * 更新选择范围
 */
function updateSel(sel: EditorSelection, by: (range: SelectionRange) => SelectionRange): EditorSelection {
  return EditorSelection.create(sel.ranges.map(by), sel.mainIndex);
}

/**
 * 获取选中的行块
 */
function selectedLineBlocks(state: any): LineBlock[] {
  const blocks: LineBlock[] = [];
  let upto = -1;
  
  for (const range of state.selection.ranges) {
    const startLine = state.doc.lineAt(range.from);
    let endLine = state.doc.lineAt(range.to);
    
    if (!range.empty && range.to == endLine.from) {
      endLine = state.doc.lineAt(range.to - 1);
    }
    
    if (upto >= startLine.number) {
      const prev = blocks[blocks.length - 1];
      prev.to = endLine.to;
      prev.ranges.push(range);
    } else {
      blocks.push({ 
        from: startLine.from, 
        to: endLine.to, 
        ranges: [range] 
      });
    }
    upto = endLine.number + 1;
  }
  
  return blocks;
}

/**
 * 删除行命令
 */
export const deleteLine = (view: EditorView): boolean => {
  if (view.state.readOnly) {
    return false;
  }

  const { state } = view;
  const selectedLines = selectedLineBlocks(state);

  const changes = state.changes(selectedLines.map(({ from, to }) => {
    const block = getNoteBlockFromPos(state, from);
    
    // 如果不是删除整个代码块，需要调整删除范围
    if (block && (from !== block.content.from || to !== block.content.to)) {
      if (from > 0) {
        from--;
      } else if (to < state.doc.length) {
        to++;
      }
    }
    
    return { from, to };
  }));

  const selection = updateSel(
    state.selection, 
    range => view.moveVertically(range, true)
  ).map(changes);
  
  view.dispatch({ 
    changes, 
    selection, 
    scrollIntoView: true, 
    userEvent: "delete.line" 
  });

  return true;
};

/**
 * 删除行命令函数，用于键盘映射
 */
export const deleteLineCommand = ({ state, dispatch }: { state: any; dispatch: any }) => {
  if (state.readOnly) {
    return false;
  }

  const selectedLines = selectedLineBlocks(state);

  const changes = state.changes(selectedLines.map(({ from, to }: LineBlock) => {
    const block = getNoteBlockFromPos(state, from);
    
    // 如果不是删除整个代码块，需要调整删除范围
    if (block && (from !== block.content.from || to !== block.content.to)) {
      if (from > 0) {
        from--;
      } else if (to < state.doc.length) {
        to++;
      }
    }
    
    return { from, to };
  }));

  const selection = updateSel(
    state.selection, 
    range => EditorSelection.cursor(range.from)
  ).map(changes);
  
  dispatch(state.update({ 
    changes, 
    selection, 
    scrollIntoView: true, 
    userEvent: "delete.line" 
  }));

  return true;
}; 