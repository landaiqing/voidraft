/**
 * 字符转置功能
 * 交换光标前后的字符
 */

import { EditorSelection, findClusterBreak } from "@codemirror/state";
import { getNoteBlockFromPos } from "./state";

/**
 * 交换光标前后的字符
 */
export const transposeChars = ({ state, dispatch }: { state: any; dispatch: any }): boolean => {
  if (state.readOnly) {
    return false;
  }
  
  let changes = state.changeByRange((range: any) => {
    // 防止在代码块的开始或结束位置进行字符转置，因为这会破坏块语法
    const block = getNoteBlockFromPos(state, range.from);
    if (block && (range.from === block.content.from || range.from === block.content.to)) {
      return { range };
    }

    if (!range.empty || range.from == 0 || range.from == state.doc.length) {
      return { range };
    }
    
    let pos = range.from;
    let line = state.doc.lineAt(pos);
    let from = pos == line.from ? pos - 1 : findClusterBreak(line.text, pos - line.from, false) + line.from;
    let to = pos == line.to ? pos + 1 : findClusterBreak(line.text, pos - line.from, true) + line.from;
    
    return { 
      changes: { 
        from, 
        to, 
        insert: state.doc.slice(pos, to).append(state.doc.slice(from, pos)) 
      },
      range: EditorSelection.cursor(to) 
    };
  });
  
  if (changes.changes.empty) {
    return false;
  }
  
  dispatch(state.update(changes, { 
    scrollIntoView: true, 
    userEvent: "move.character" 
  }));
  
  return true;
}; 