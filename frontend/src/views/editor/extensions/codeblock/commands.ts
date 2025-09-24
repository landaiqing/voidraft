/**
 * Block 命令
 */

import { EditorSelection } from "@codemirror/state";
import { Command } from "@codemirror/view";
import { blockState, getActiveNoteBlock, getFirstNoteBlock, getLastNoteBlock, getNoteBlockFromPos } from "./state";
import { Block, EditorOptions, DELIMITER_REGEX } from "./types";
import { formatBlockContent } from "./formatCode";

/**
 * 获取块分隔符
 */
export function getBlockDelimiter(defaultToken: string, autoDetect: boolean): string {
    return `\n∞∞∞${autoDetect ? defaultToken + '-a' : defaultToken}\n`;
}

/**
 * 在光标处插入新块
 */
export const insertNewBlockAtCursor = (options: EditorOptions): Command => ({ state, dispatch }) => {
    if (state.readOnly) return false;

    const currentBlock = getActiveNoteBlock(state);
    let delimText: string;
    
    if (currentBlock) {
        delimText = `\n∞∞∞${currentBlock.language.name}${currentBlock.language.auto ? "-a" : ""}\n`;
    } else {
        delimText = getBlockDelimiter(options.defaultBlockToken, options.defaultBlockAutoDetect);
    }
    
    dispatch(state.replaceSelection(delimText), {
        scrollIntoView: true,
        userEvent: "input",
    });

    return true;
};

/**
 * 在当前块之前添加新块
 */
export const addNewBlockBeforeCurrent = (options: EditorOptions): Command => ({ state, dispatch }) => {
    if (state.readOnly) return false;

    const block = getActiveNoteBlock(state);
    if (!block) return false;
    
    const delimText = getBlockDelimiter(options.defaultBlockToken, options.defaultBlockAutoDetect);

    dispatch(state.update({
        changes: {
            from: block.delimiter.from,
            insert: delimText,
        },
        selection: EditorSelection.cursor(block.delimiter.from + delimText.length),
    }, {
        scrollIntoView: true,
        userEvent: "input",
    }));
    
    return true;
};

/**
 * 在当前块之后添加新块
 */
export const addNewBlockAfterCurrent = (options: EditorOptions): Command => ({ state, dispatch }) => {
    if (state.readOnly) return false;

    const block = getActiveNoteBlock(state);
    if (!block) return false;
    
    const delimText = getBlockDelimiter(options.defaultBlockToken, options.defaultBlockAutoDetect);

    dispatch(state.update({
        changes: {
            from: block.content.to,
            insert: delimText,
        },
        selection: EditorSelection.cursor(block.content.to + delimText.length)
    }, {
        scrollIntoView: true,
        userEvent: "input",
    }));
    
    return true;
};

/**
 * 在第一个块之前添加新块
 */
export const addNewBlockBeforeFirst = (options: EditorOptions): Command => ({ state, dispatch }) => {
    if (state.readOnly) return false;

    const block = getFirstNoteBlock(state);
    if (!block) return false;
    
    const delimText = getBlockDelimiter(options.defaultBlockToken, options.defaultBlockAutoDetect);

    dispatch(state.update({
        changes: {
            from: block.delimiter.from,
            insert: delimText,
        },
        selection: EditorSelection.cursor(delimText.length),
    }, {
        scrollIntoView: true,
        userEvent: "input",
    }));
    
    return true;
};

/**
 * 在最后一个块之后添加新块
 */
export const addNewBlockAfterLast = (options: EditorOptions): Command => ({ state, dispatch }) => {
    if (state.readOnly) return false;
    
    const block = getLastNoteBlock(state);
    if (!block) return false;
    
    const delimText = getBlockDelimiter(options.defaultBlockToken, options.defaultBlockAutoDetect);

    dispatch(state.update({
        changes: {
            from: block.content.to,
            insert: delimText,
        },
        selection: EditorSelection.cursor(block.content.to + delimText.length)
    }, {
        scrollIntoView: true,
        userEvent: "input",
    }));
    
    return true;
};

/**
 * 更改块语言
 */
export function changeLanguageTo(state: any, dispatch: any, block: Block, language: string, auto: boolean) {
    if (state.readOnly) return false;
    
    const currentDelimiter = state.doc.sliceString(block.delimiter.from, block.delimiter.to);
    
    // 重置正则表达式的 lastIndex
    DELIMITER_REGEX.lastIndex = 0;
    if (currentDelimiter.match(DELIMITER_REGEX)) {
        const newDelimiter = `\n∞∞∞${language}${auto ? '-a' : ''}\n`;
        
        dispatch({
            changes: {
                from: block.delimiter.from,
                to: block.delimiter.to,
                insert: newDelimiter,
            },
        });
        
        return true;
    } else {
        return false;
    }
}

/**
 * 更改当前块语言
 */
export function changeCurrentBlockLanguage(state: any, dispatch: any, language: string | null, auto: boolean) {
    const block = getActiveNoteBlock(state);
    if (!block) {
        console.warn("No active block found");
        return false;
    }
    
    // 如果 language 为 null，我们只想更改自动检测标志
    if (language === null) {
        language = block.language.name;
    }
    
    return changeLanguageTo(state, dispatch, block, language, auto);
}

// 选择和移动辅助函数
function updateSel(sel: EditorSelection, by: (range: any) => any): EditorSelection {
    return EditorSelection.create(sel.ranges.map(by), sel.mainIndex);
}

function setSel(state: any, selection: EditorSelection) {
    return state.update({ selection, scrollIntoView: true, userEvent: "select" });
}

function extendSel(state: any, dispatch: any, how: (range: any) => any) {
    const selection = updateSel(state.selection, range => {
        const head = how(range);
        return EditorSelection.range(range.anchor, head.head, head.goalColumn, head.bidiLevel || undefined);
    });
    if (selection.eq(state.selection)) return false;
    dispatch(setSel(state, selection));
    return true;
}

function moveSel(state: any, dispatch: any, how: (range: any) => any) {
    const selection = updateSel(state.selection, how);
    if (selection.eq(state.selection)) return false;
    dispatch(setSel(state, selection));
    return true;
}

function previousBlock(state: any, range: any) {
    const blocks = state.field(blockState);
    const block = getNoteBlockFromPos(state, range.head);
    if (!block) return EditorSelection.cursor(0);
    
    if (range.head === block.content.from) {
        const index = blocks.indexOf(block);
        const previousBlockIndex = index > 0 ? index - 1 : 0;
        return EditorSelection.cursor(blocks[previousBlockIndex].content.from);
    } else {
        return EditorSelection.cursor(block.content.from);
    }
}

function nextBlock(state: any, range: any) {
    const blocks = state.field(blockState);
    const block = getNoteBlockFromPos(state, range.head);
    if (!block) return EditorSelection.cursor(state.doc.length);
    
    if (range.head === block.content.to) {
        const index = blocks.indexOf(block);
        const nextBlockIndex = index < blocks.length - 1 ? index + 1 : index;
        return EditorSelection.cursor(blocks[nextBlockIndex].content.to);
    } else {
        return EditorSelection.cursor(block.content.to);
    }
}

/**
 * 跳转到下一个块
 */
export function gotoNextBlock({ state, dispatch }: any) {
    return moveSel(state, dispatch, (range: any) => nextBlock(state, range));
}

/**
 * 选择到下一个块
 */
export function selectNextBlock({ state, dispatch }: any) {
    return extendSel(state, dispatch, (range: any) => nextBlock(state, range));
}

/**
 * 跳转到上一个块
 */
export function gotoPreviousBlock({ state, dispatch }: any) {
    return moveSel(state, dispatch, (range: any) => previousBlock(state, range));
}

/**
 * 选择到上一个块
 */
export function selectPreviousBlock({ state, dispatch }: any) {
    return extendSel(state, dispatch, (range: any) => previousBlock(state, range));
}

/**
 * 删除块
 */
export const deleteBlock = (_options: EditorOptions): Command => ({ state, dispatch }) => {
    if (state.readOnly) return false;
    
    const block = getActiveNoteBlock(state);
    if (!block) return false;
    
    const blocks = state.field(blockState);
    if (blocks.length <= 1) return false; // 不能删除最后一个块
    
    const blockIndex = blocks.indexOf(block);
    let newCursorPos: number;
    
    if (blockIndex === blocks.length - 1) {
        // 如果是最后一个块，将光标移到前一个块的末尾
        // 需要计算删除后的位置
        const prevBlock = blocks[blockIndex - 1];
        newCursorPos = prevBlock.content.to;
    } else {
        // 否则移到下一个块的开始
        // 需要计算删除后的位置，下一个块会向前移动
        const nextBlock = blocks[blockIndex + 1];
        const blockLength = block.range.to - block.range.from;
        newCursorPos = nextBlock.content.from - blockLength;
    }
    
    // 确保光标位置在有效范围内
    const docLengthAfterDelete = state.doc.length - (block.range.to - block.range.from);
    newCursorPos = Math.max(0, Math.min(newCursorPos, docLengthAfterDelete));
    
    dispatch(state.update({
        changes: {
            from: block.range.from,
            to: block.range.to,
            insert: ""
        },
        selection: EditorSelection.cursor(newCursorPos)
    }, {
        scrollIntoView: true,
        userEvent: "delete"
    }));
    
    return true;
};

/**
 * 向上移动当前块
 */
export function moveCurrentBlockUp({ state, dispatch }: any) {
    return moveCurrentBlock(state, dispatch, true);
}

/**
 * 向下移动当前块
 */
export function moveCurrentBlockDown({ state, dispatch }: any) {
    return moveCurrentBlock(state, dispatch, false);
}

function moveCurrentBlock(state: any, dispatch: any, up: boolean) {
    if (state.readOnly) return false;
    
    const block = getActiveNoteBlock(state);
    if (!block) return false;
    
    const blocks = state.field(blockState);
    const blockIndex = blocks.indexOf(block);
    
    const targetIndex = up ? blockIndex - 1 : blockIndex + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) return false;
    
    const targetBlock = blocks[targetIndex];
    
    // 获取两个块的完整内容
    const currentBlockContent = state.doc.sliceString(block.range.from, block.range.to);
    const targetBlockContent = state.doc.sliceString(targetBlock.range.from, targetBlock.range.to);
    
    // 交换块的位置
    const changes = up ? [
        {
            from: targetBlock.range.from,
            to: block.range.to,
            insert: currentBlockContent + targetBlockContent
        }
    ] : [
        {
            from: block.range.from,
            to: targetBlock.range.to,
            insert: targetBlockContent + currentBlockContent
        }
    ];
    
    // 计算新的光标位置
    const newCursorPos = up ? 
        targetBlock.range.from + (block.range.to - block.range.from) + (block.content.from - block.range.from) :
        block.range.from + (targetBlock.range.to - targetBlock.range.from) + (block.content.from - block.range.from);
    
    dispatch(state.update({
        changes,
        selection: EditorSelection.cursor(newCursorPos)
    }, {
        scrollIntoView: true,
        userEvent: "move"
    }));
    
    return true;
}

/**
 * 格式化当前块
 */
export const formatCurrentBlock: Command = (view) => {
    return formatBlockContent(view);
}; 