/**
 * Block 状态管理
 */

import { StateField, EditorState } from '@codemirror/state';
import { Block } from './types';
import { getBlocks } from './parser';

/**
 * 块状态字段，跟踪文档中的所有块
 */
export const blockState = StateField.define<Block[]>({
  create(state: EditorState): Block[] {
    return getBlocks(state);
  },
  
  update(blocks: Block[], transaction): Block[] {
    // 如果块为空，可能意味着我们没有获得解析的语法树，那么我们希望在所有更新时更新块（而不仅仅是文档更改）
    if (transaction.docChanged || blocks.length === 0) {
      return getBlocks(transaction.state);
    }
    return blocks;
  },
});

/**
 * 获取当前活动的块
 */
export function getActiveNoteBlock(state: EditorState): Block | undefined {
  // 检查 blockState 字段是否存在
  if (!state.field(blockState, false)) {
    return undefined;
  }
  
  // 找到光标所在的块
  const range = state.selection.asSingle().ranges[0];
  return state.field(blockState).find(block => 
    block.range.from <= range.head && block.range.to >= range.head
  );
}

/**
 * 获取第一个块
 */
export function getFirstNoteBlock(state: EditorState): Block | undefined {
  if (!state.field(blockState, false)) {
    return undefined;
  }
  return state.field(blockState)[0];
}

/**
 * 获取最后一个块
 */
export function getLastNoteBlock(state: EditorState): Block | undefined {
  if (!state.field(blockState, false)) {
    return undefined;
  }
  const blocks = state.field(blockState);
  return blocks[blocks.length - 1];
}

/**
 * 根据位置获取块
 */
export function getNoteBlockFromPos(state: EditorState, pos: number): Block | undefined {
  if (!state.field(blockState, false)) {
    return undefined;
  }
  return state.field(blockState).find(block => 
    block.range.from <= pos && block.range.to >= pos
  );
} 