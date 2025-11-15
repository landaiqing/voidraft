/**
 * 光标保护扩展
 * 防止光标通过方向键移动到分隔符区域
 */

import { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import { blockState } from './state';
import { Block } from './types';

/**
 * 二分查找：找到包含指定位置的块
 * blocks 数组按位置排序，使用二分查找 O(log n)
 */
function findBlockAtPos(blocks: Block[], pos: number): Block | null {
    let left = 0;
    let right = blocks.length - 1;

    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const block = blocks[mid];

        if (pos < block.range.from) {
            // 位置在当前块之前
            right = mid - 1;
        } else if (pos > block.range.to) {
            // 位置在当前块之后
            left = mid + 1;
        } else {
            // 位置在当前块范围内
            return block;
        }
    }

    return null;
}

/**
 * 检查位置是否在分隔符区域内
 */
function isInDelimiter(view: EditorView, pos: number): boolean {
    try {
        const blocks = view.state.field(blockState, false);
        if (!blocks || blocks.length === 0) return false;

        const block = findBlockAtPos(blocks, pos);
        if (!block) return false;

        // 检查是否在该块的分隔符区域内
        return pos >= block.delimiter.from && pos < block.delimiter.to;
    } catch {
        return false;
    }
}

/**
 * 调整光标位置，跳过分隔符区域
 */
function adjustPosition(view: EditorView, pos: number, forward: boolean): number {
    try {
        const blocks = view.state.field(blockState, false);
        if (!blocks || blocks.length === 0) return pos;

        const block = findBlockAtPos(blocks, pos);
        if (!block) return pos;

        // 如果位置在分隔符内
        if (pos >= block.delimiter.from && pos < block.delimiter.to) {
            // 向前移动：跳到该块内容的开始
            // 向后移动：跳到前一个块的内容末尾
            if (forward) {
                return block.content.from;
            } else {
                // 找到前一个块的索引
                const blockIndex = blocks.indexOf(block);
                if (blockIndex > 0) {
                    const prevBlock = blocks[blockIndex - 1];
                    return prevBlock.content.to;
                }
                return block.delimiter.from;
            }
        }

        return pos;
    } catch {
        return pos;
    }
}

/**
 * 光标保护扩展
 * 拦截方向键移动，防止光标进入分隔符区域
 */
export function createCursorProtection() {
    return EditorView.domEventHandlers({
        keydown(event, view) {
            // 只处理方向键
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
                return false;
            }

            // 获取当前光标位置
            const selection = view.state.selection.main;
            const currentPos = selection.head;

            // 计算目标位置
            let targetPos = currentPos;
            
            if (event.key === 'ArrowLeft') {
                targetPos = Math.max(0, currentPos - 1);
            } else if (event.key === 'ArrowRight') {
                targetPos = Math.min(view.state.doc.length, currentPos + 1);
            } else if (event.key === 'ArrowUp') {
                const line = view.state.doc.lineAt(currentPos);
                if (line.number > 1) {
                    const prevLine = view.state.doc.line(line.number - 1);
                    const col = currentPos - line.from;
                    targetPos = Math.min(prevLine.from + col, prevLine.to);
                }
            } else if (event.key === 'ArrowDown') {
                const line = view.state.doc.lineAt(currentPos);
                if (line.number < view.state.doc.lines) {
                    const nextLine = view.state.doc.line(line.number + 1);
                    const col = currentPos - line.from;
                    targetPos = Math.min(nextLine.from + col, nextLine.to);
                }
            }

            // 检查目标位置是否在分隔符内
            if (isInDelimiter(view, targetPos)) {
                // 调整位置
                const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
                const adjustedPos = adjustPosition(view, targetPos, forward);

                // 移动光标到调整后的位置
                view.dispatch({
                    selection: EditorSelection.cursor(adjustedPos),
                    scrollIntoView: true,
                    userEvent: 'select'
                });

                // 阻止默认行为
                event.preventDefault();
                return true;
            }

            return false;
        }
    });
}

