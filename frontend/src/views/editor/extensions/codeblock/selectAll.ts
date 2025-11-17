/**
 * 块隔离选择功能
 */

import { ViewPlugin, Decoration } from "@codemirror/view";
import { StateField, StateEffect, RangeSetBuilder, EditorSelection, EditorState, Transaction } from "@codemirror/state";
import { selectAll as defaultSelectAll } from "@codemirror/commands";
import { Command } from "@codemirror/view";
import { getActiveNoteBlock, blockState } from "./state";
import { USER_EVENTS, codeBlockEvent, CONTENT_EDIT } from "./annotation";

/**
 * 当用户按下 Ctrl+A 时，我们希望首先选择整个块。但如果整个块已经被选中，
 * 我们希望改为选择整个文档。这对于空块不起作用，因为整个块已经被选中（因为它是空的）。
 * 因此我们使用 StateField 来跟踪空块是否被选中，并添加手动行装饰来视觉上指示空块被选中。
 */

/**
 * 空块选择状态字段
 */
export const emptyBlockSelected = StateField.define<number | null>({
  create: () => {
    return null;
  },
  
  update(value, tr) {
    if (tr.selection) {
      // 如果选择改变，重置状态
      return null;
    } else {
      for (const e of tr.effects) {
        if (e.is(setEmptyBlockSelected)) {
          // 切换状态为 true
          return e.value;
        }
      }
    }
    return value;
  },
  
  provide() {
    return ViewPlugin.fromClass(class {
      decorations: any;
      
      constructor(view: any) {
        this.decorations = emptyBlockSelectedDecorations(view);
      }
      
      update(update: any) {
        this.decorations = emptyBlockSelectedDecorations(update.view);
      }
    }, {
      decorations: v => v.decorations
    });
  }
});

/**
 * 可以分派的效果来设置空块选择状态
 */
const setEmptyBlockSelected = StateEffect.define<number>();

/**
 * 空块选择装饰
 */
const decoration = Decoration.line({
  attributes: { class: "code-block-empty-selected" }
});

function emptyBlockSelectedDecorations(view: any) {
  const selectionPos = view.state.field(emptyBlockSelected);
  const builder = new RangeSetBuilder();
  if (selectionPos !== null) {
    const line = view.state.doc.lineAt(selectionPos);
    builder.add(line.from, line.from, decoration);
  }
  return builder.finish();
}

/**
 * 块隔离的选择全部功能
 */
export const selectAll: Command = ({ state, dispatch }) => {
  const range = state.selection.asSingle().ranges[0];
  const block = getActiveNoteBlock(state);

  // 如果没有找到块，使用默认的全选
  if (!block) {
    return defaultSelectAll({ state, dispatch });
  }

  // 单独处理空块
  if (block.content.from === block.content.to) {
    // 检查是否已经按过 Ctrl+A
    if (state.field(emptyBlockSelected)) {
      // 如果活动块已经标记为选中，我们想要选择整个缓冲区
      return defaultSelectAll({ state, dispatch });
    } else if (range.empty) {
      // 如果空块没有被选中，标记为选中
      // 我们检查 range.empty 的原因是如果文档末尾有一个空块
      // 用户按两次 Ctrl+A 使整个缓冲区被选中，活动块仍然是空的
      // 但我们不想标记它为选中
      dispatch({
        effects: setEmptyBlockSelected.of(block.content.from)
      });
      return true;
    }
    return true;
  }

  // 检查是否已经选中了块的所有文本，在这种情况下我们想要选择整个文档的所有文本
  if (range.from === block.content.from && range.to === block.content.to) {
    return defaultSelectAll({ state, dispatch });
  }

  // 选择当前块的所有内容
  dispatch(state.update({
    selection: { anchor: block.content.from, head: block.content.to },
    userEvent: USER_EVENTS.SELECT,
    annotations: [codeBlockEvent.of(CONTENT_EDIT)],
  }));

  return true;
};

/**
 * 块感知的选择扩展功能
 * 使用事务过滤器来确保选择不会跨越块边界
 */
export const blockAwareSelection = EditorState.transactionFilter.of((tr: any) => {
  // 只处理选择变化的事务，并且忽略我们自己生成的事务
  if (!tr.selection || !tr.selection.ranges || tr.annotation?.(Transaction.userEvent) === USER_EVENTS.SELECT_BLOCK_BOUNDARY) {
    return tr;
  }

  const state = tr.startState;
  
  try {
    const blocks = state.field(blockState);
    
    if (blocks.length === 0) {
      return tr;
    }

    // 检查是否需要修正选择
    let needsCorrection = false;
    const correctedRanges = tr.selection.ranges.map((range: any) => {
      // 为选择范围的开始和结束位置找到对应的块
      const fromBlock = getBlockAtPos(state, range.from);
      const toBlock = getBlockAtPos(state, range.to);

      // 如果选择开始或结束在分隔符内，跳过边界检查
      if (isInDelimiter(state, range.from) || isInDelimiter(state, range.to)) {
        return range;
      }

      // 如果选择跨越了多个块，需要限制选择
      if (fromBlock && toBlock && fromBlock !== toBlock) {
        // 选择跨越了多个块，限制到起始块
        needsCorrection = true;
        return EditorSelection.range(
          Math.max(range.from, fromBlock.content.from),
          Math.min(range.to, fromBlock.content.to)
        );
      }

      // 如果选择在一个块内，确保不超出块边界
      if (fromBlock) {
        const newFrom = Math.max(range.from, fromBlock.content.from);
        const newTo = Math.min(range.to, fromBlock.content.to);
        
        if (newFrom !== range.from || newTo !== range.to) {
          needsCorrection = true;
          return EditorSelection.range(newFrom, newTo);
        }
      }
      
      return range;
    });

    if (needsCorrection) {
      // 返回修正后的事务
      return {
        ...tr,
        selection: EditorSelection.create(correctedRanges, tr.selection.mainIndex),
        annotations: tr.annotations.concat(Transaction.userEvent.of(USER_EVENTS.SELECT_BLOCK_BOUNDARY))
      };
    }
  } catch (error) {
    // 如果出现错误，返回原始事务
    console.warn("Block boundary check failed:", error);
  }

  return tr;
});

/**
 * 辅助函数：根据位置获取块
 */
function getBlockAtPos(state: any, pos: number) {
  const blocks = state.field(blockState);
  return blocks.find((block: any) => 
    block.content.from <= pos && block.content.to >= pos
  );
}

/**
 * 辅助函数：检查位置是否在块分隔符内
 */
function isInDelimiter(state: any, pos: number) {
  const blocks = state.field(blockState);
  return blocks.some((block: any) => 
    block.delimiter.from <= pos && block.delimiter.to >= pos
  );
}

/**
 * 获取块选择扩展
 */
export function getBlockSelectExtensions() {
  return [
    emptyBlockSelected,
  ];
} 
