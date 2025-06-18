/**
 * 移动行功能
 * 处理代码块分隔符
 */

import { EditorSelection, SelectionRange } from "@codemirror/state";
import { blockState } from "./state";
import { SUPPORTED_LANGUAGES } from "./types";

interface LineBlock {
  from: number;
  to: number;
  ranges: SelectionRange[];
}

// 创建语言标记的正则表达式
const languageTokensMatcher = SUPPORTED_LANGUAGES.join("|");
const tokenRegEx = new RegExp(`^∞∞∞(${languageTokensMatcher})(-a)?$`, "g");

/**
 * 获取选中的行块
 */
function selectedLineBlocks(state: any): LineBlock[] {
  let blocks: LineBlock[] = [];
  let upto = -1;
  
  for (let range of state.selection.ranges) {
    let startLine = state.doc.lineAt(range.from);
    let endLine = state.doc.lineAt(range.to);
    
    if (!range.empty && range.to == endLine.from) {
      endLine = state.doc.lineAt(range.to - 1);
    }
    
    if (upto >= startLine.number) {
      let prev = blocks[blocks.length - 1];
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
 * 移动行的核心逻辑
 */
function moveLine(state: any, dispatch: any, forward: boolean): boolean {
  if (state.readOnly) {
    return false;
  }
  
  let changes: any[] = [];
  let ranges: SelectionRange[] = [];
  
  for (let block of selectedLineBlocks(state)) {
    if (forward ? block.to == state.doc.length : block.from == 0) {
      continue;
    }
    
    let nextLine = state.doc.lineAt(forward ? block.to + 1 : block.from - 1);
    let previousLine;
    
    if (!forward ? block.to == state.doc.length : block.from == 0) {
      previousLine = null;
    } else {
      previousLine = state.doc.lineAt(forward ? block.from - 1 : block.to + 1);
    }
    
    // 如果整个选择是一个被分隔符包围的块，我们需要在分隔符之间添加额外的换行符
    // 以避免创建两个只有单个换行符的分隔符，这会导致语法解析器无法解析
    let nextLineIsSeparator = nextLine.text.match(tokenRegEx);
    let blockSurroundedBySeparators = previousLine !== null && 
      previousLine.text.match(tokenRegEx) && nextLineIsSeparator;
    
    let size = nextLine.length + 1;
    
    if (forward) {
      if (blockSurroundedBySeparators) {
        size += 1;
        changes.push(
          { from: block.to, to: nextLine.to }, 
          { from: block.from, insert: state.lineBreak + nextLine.text + state.lineBreak }
        );
      } else {
        changes.push(
          { from: block.to, to: nextLine.to }, 
          { from: block.from, insert: nextLine.text + state.lineBreak }
        );
      }
      
      for (let r of block.ranges) {
        ranges.push(EditorSelection.range(
          Math.min(state.doc.length, r.anchor + size), 
          Math.min(state.doc.length, r.head + size)
        ));
      }
    } else {
      if (blockSurroundedBySeparators || (previousLine === null && nextLineIsSeparator)) {
        changes.push(
          { from: nextLine.from, to: block.from }, 
          { from: block.to, insert: state.lineBreak + nextLine.text + state.lineBreak }
        );
        for (let r of block.ranges) {
          ranges.push(EditorSelection.range(r.anchor - size, r.head - size));
        }
      } else {
        changes.push(
          { from: nextLine.from, to: block.from }, 
          { from: block.to, insert: state.lineBreak + nextLine.text }
        );
        for (let r of block.ranges) {
          ranges.push(EditorSelection.range(r.anchor - size, r.head - size));
        }
      }
    }
  }
  
  if (!changes.length) {
    return false;
  }
  
  dispatch(state.update({
    changes,
    scrollIntoView: true,
    selection: EditorSelection.create(ranges, state.selection.mainIndex),
    userEvent: "move.line"
  }));
  
  return true;
}

/**
 * 向上移动行
 */
export const moveLineUp = ({ state, dispatch }: { state: any; dispatch: any }): boolean => {
  // 防止移动行到第一个块分隔符之前
  if (state.selection.ranges.some((range: SelectionRange) => {
    let startLine = state.doc.lineAt(range.from);
    return startLine.from <= state.field(blockState)[0].content.from;
  })) {
    return true;
  }
  
  return moveLine(state, dispatch, false);
};

/**
 * 向下移动行
 */
export const moveLineDown = ({ state, dispatch }: { state: any; dispatch: any }): boolean => {
  return moveLine(state, dispatch, true);
}; 