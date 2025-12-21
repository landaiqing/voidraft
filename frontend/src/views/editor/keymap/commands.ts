import {closeSearchPanel, openSearchPanel,} from '@codemirror/search';
import {
    addNewBlockAfterCurrent,
    addNewBlockAfterLast,
    addNewBlockBeforeCurrent,
    deleteBlock,
    formatCurrentBlock,
    gotoNextBlock,
    gotoPreviousBlock,
    moveCurrentBlockDown,
    moveCurrentBlockUp,
    selectNextBlock,
    selectPreviousBlock
} from '../extensions/codeblock/commands';
import {selectAll} from '../extensions/codeblock/selectAll';
import {deleteLineCommand} from '../extensions/codeblock/deleteLine';
import {moveLineDown, moveLineUp} from '../extensions/codeblock/moveLines';
import {transposeChars} from '../extensions/codeblock';
import {copyCommand, cutCommand, pasteCommand} from '../extensions/codeblock/copyPaste';
import {
    addCursorAbove,
    addCursorBelow,
    copyLineDown,
    copyLineUp,
    cursorCharLeft,
    cursorCharRight,
    cursorLineDown,
    cursorLineUp,
    cursorPageDown,
    cursorPageUp,
    cursorDocEnd,
    cursorDocStart,
    cursorGroupLeft,
    cursorGroupRight,
    cursorLineEnd,
    cursorLineStart,
    cursorMatchingBracket,
    cursorSyntaxLeft,
    cursorSyntaxRight,
    deleteCharBackward,
    deleteCharForward,
    deleteGroupBackward,
    deleteGroupForward,
    deleteToLineEnd,
    deleteToLineStart,
    indentLess,
    indentMore,
    indentSelection,
    insertBlankLine,
    insertNewlineAndIndent,
    redo,
    redoSelection,
    selectCharLeft,
    selectCharRight,
    selectLineDown,
    selectLineUp,
    selectDocEnd,
    selectDocStart,
    selectGroupLeft,
    selectGroupRight,
    selectLine,
    selectLineEnd,
    selectLineStart,
    selectMatchingBracket,
    selectParentSyntax,
    selectSyntaxLeft,
    selectSyntaxRight,
    simplifySelection,
    splitLine,
    toggleBlockComment,
    toggleComment,
    undo,
    undoSelection
} from '@codemirror/commands';
import {foldAll, foldCode, unfoldAll, unfoldCode} from '@codemirror/language';
import i18n from '@/i18n';
import {KeyBindingName} from '@/../bindings/voidraft/internal/models/models';
import {copyBlockImageCommand} from '../extensions/blockImage';

const defaultBlockExtensionOptions = {
    defaultBlockToken: 'text',
    defaultBlockAutoDetect: true,
};

/**
 * 前端命令注册表
 * 将后端定义的key字段映射到具体的前端方法和翻译键
 */
export const commands: Record<string, { handler: any; descriptionKey: string }> = {
    [KeyBindingName.ShowSearch]: {
        handler: openSearchPanel,
        descriptionKey: 'keybindings.commands.showSearch'
    },
    [KeyBindingName.HideSearch]: {
        handler: closeSearchPanel,
        descriptionKey: 'keybindings.commands.hideSearch'
    },
    [KeyBindingName.BlockSelectAll]: {
        handler: selectAll,
        descriptionKey: 'keybindings.commands.blockSelectAll'
    },
    [KeyBindingName.BlockAddAfterCurrent]: {
        handler: addNewBlockAfterCurrent(defaultBlockExtensionOptions),
        descriptionKey: 'keybindings.commands.blockAddAfterCurrent'
    },
    [KeyBindingName.BlockAddAfterLast]: {
        handler: addNewBlockAfterLast(defaultBlockExtensionOptions),
        descriptionKey: 'keybindings.commands.blockAddAfterLast'
    },
    [KeyBindingName.BlockAddBeforeCurrent]: {
        handler: addNewBlockBeforeCurrent(defaultBlockExtensionOptions),
        descriptionKey: 'keybindings.commands.blockAddBeforeCurrent'
    },
    [KeyBindingName.BlockGotoPrevious]: {
        handler: gotoPreviousBlock,
        descriptionKey: 'keybindings.commands.blockGotoPrevious'
    },
    [KeyBindingName.BlockGotoNext]: {
        handler: gotoNextBlock,
        descriptionKey: 'keybindings.commands.blockGotoNext'
    },
    [KeyBindingName.BlockSelectPrevious]: {
        handler: selectPreviousBlock,
        descriptionKey: 'keybindings.commands.blockSelectPrevious'
    },
    [KeyBindingName.BlockSelectNext]: {
        handler: selectNextBlock,
        descriptionKey: 'keybindings.commands.blockSelectNext'
    },
    [KeyBindingName.BlockDelete]: {
        handler: deleteBlock(defaultBlockExtensionOptions),
        descriptionKey: 'keybindings.commands.blockDelete'
    },
    [KeyBindingName.BlockMoveUp]: {
        handler: moveCurrentBlockUp,
        descriptionKey: 'keybindings.commands.blockMoveUp'
    },
    [KeyBindingName.BlockMoveDown]: {
        handler: moveCurrentBlockDown,
        descriptionKey: 'keybindings.commands.blockMoveDown'
    },
    [KeyBindingName.BlockDeleteLine]: {
        handler: deleteLineCommand,
        descriptionKey: 'keybindings.commands.blockDeleteLine'
    },
    [KeyBindingName.BlockMoveLineUp]: {
        handler: moveLineUp,
        descriptionKey: 'keybindings.commands.blockMoveLineUp'
    },
    [KeyBindingName.BlockMoveLineDown]: {
        handler: moveLineDown,
        descriptionKey: 'keybindings.commands.blockMoveLineDown'
    },
    [KeyBindingName.BlockTransposeChars]: {
        handler: transposeChars,
        descriptionKey: 'keybindings.commands.blockTransposeChars'
    },
    [KeyBindingName.BlockFormat]: {
        handler: formatCurrentBlock,
        descriptionKey: 'keybindings.commands.blockFormat'
    },
    [KeyBindingName.BlockCopy]: {
        handler: copyCommand,
        descriptionKey: 'keybindings.commands.blockCopy'
    },
    [KeyBindingName.BlockCut]: {
        handler: cutCommand,
        descriptionKey: 'keybindings.commands.blockCut'
    },
    [KeyBindingName.BlockPaste]: {
        handler: pasteCommand,
        descriptionKey: 'keybindings.commands.blockPaste'
    },
    [KeyBindingName.CopyBlockImage]: {
        handler: copyBlockImageCommand,
        descriptionKey: 'keybindings.commands.copyBlockImage'
    },
    [KeyBindingName.HistoryUndo]: {
        handler: undo,
        descriptionKey: 'keybindings.commands.historyUndo'
    },
    [KeyBindingName.HistoryRedo]: {
        handler: redo,
        descriptionKey: 'keybindings.commands.historyRedo'
    },
    [KeyBindingName.HistoryUndoSelection]: {
        handler: undoSelection,
        descriptionKey: 'keybindings.commands.historyUndoSelection'
    },
    [KeyBindingName.HistoryRedoSelection]: {
        handler: redoSelection,
        descriptionKey: 'keybindings.commands.historyRedoSelection'
    },
    [KeyBindingName.FoldCode]: {
        handler: foldCode,
        descriptionKey: 'keybindings.commands.foldCode'
    },
    [KeyBindingName.UnfoldCode]: {
        handler: unfoldCode,
        descriptionKey: 'keybindings.commands.unfoldCode'
    },
    [KeyBindingName.FoldAll]: {
        handler: foldAll,
        descriptionKey: 'keybindings.commands.foldAll'
    },
    [KeyBindingName.UnfoldAll]: {
        handler: unfoldAll,
        descriptionKey: 'keybindings.commands.unfoldAll'
    },
    [KeyBindingName.CursorSyntaxLeft]: {
        handler: cursorSyntaxLeft,
        descriptionKey: 'keybindings.commands.cursorSyntaxLeft'
    },
    [KeyBindingName.CursorSyntaxRight]: {
        handler: cursorSyntaxRight,
        descriptionKey: 'keybindings.commands.cursorSyntaxRight'
    },
    [KeyBindingName.SelectSyntaxLeft]: {
        handler: selectSyntaxLeft,
        descriptionKey: 'keybindings.commands.selectSyntaxLeft'
    },
    [KeyBindingName.SelectSyntaxRight]: {
        handler: selectSyntaxRight,
        descriptionKey: 'keybindings.commands.selectSyntaxRight'
    },
    [KeyBindingName.CopyLineUp]: {
        handler: copyLineUp,
        descriptionKey: 'keybindings.commands.copyLineUp'
    },
    [KeyBindingName.CopyLineDown]: {
        handler: copyLineDown,
        descriptionKey: 'keybindings.commands.copyLineDown'
    },
    [KeyBindingName.InsertBlankLine]: {
        handler: insertBlankLine,
        descriptionKey: 'keybindings.commands.insertBlankLine'
    },
    [KeyBindingName.SelectLine]: {
        handler: selectLine,
        descriptionKey: 'keybindings.commands.selectLine'
    },
    [KeyBindingName.SelectParentSyntax]: {
        handler: selectParentSyntax,
        descriptionKey: 'keybindings.commands.selectParentSyntax'
    },
    [KeyBindingName.SimplifySelection]: {
        handler: simplifySelection,
        descriptionKey: 'keybindings.commands.simplifySelection'
    },
    [KeyBindingName.AddCursorAbove]: {
        handler: addCursorAbove,
        descriptionKey: 'keybindings.commands.addCursorAbove'
    },
    [KeyBindingName.AddCursorBelow]: {
        handler: addCursorBelow,
        descriptionKey: 'keybindings.commands.addCursorBelow'
    },
    [KeyBindingName.CursorGroupLeft]: {
        handler: cursorGroupLeft,
        descriptionKey: 'keybindings.commands.cursorGroupLeft'
    },
    [KeyBindingName.CursorGroupRight]: {
        handler: cursorGroupRight,
        descriptionKey: 'keybindings.commands.cursorGroupRight'
    },
    [KeyBindingName.SelectGroupLeft]: {
        handler: selectGroupLeft,
        descriptionKey: 'keybindings.commands.selectGroupLeft'
    },
    [KeyBindingName.SelectGroupRight]: {
        handler: selectGroupRight,
        descriptionKey: 'keybindings.commands.selectGroupRight'
    },
    [KeyBindingName.DeleteToLineEnd]: {
        handler: deleteToLineEnd,
        descriptionKey: 'keybindings.commands.deleteToLineEnd'
    },
    [KeyBindingName.DeleteToLineStart]: {
        handler: deleteToLineStart,
        descriptionKey: 'keybindings.commands.deleteToLineStart'
    },
    [KeyBindingName.CursorLineStart]: {
        handler: cursorLineStart,
        descriptionKey: 'keybindings.commands.cursorLineStart'
    },
    [KeyBindingName.CursorLineEnd]: {
        handler: cursorLineEnd,
        descriptionKey: 'keybindings.commands.cursorLineEnd'
    },
    [KeyBindingName.SelectLineStart]: {
        handler: selectLineStart,
        descriptionKey: 'keybindings.commands.selectLineStart'
    },
    [KeyBindingName.SelectLineEnd]: {
        handler: selectLineEnd,
        descriptionKey: 'keybindings.commands.selectLineEnd'
    },
    [KeyBindingName.CursorDocStart]: {
        handler: cursorDocStart,
        descriptionKey: 'keybindings.commands.cursorDocStart'
    },
    [KeyBindingName.CursorDocEnd]: {
        handler: cursorDocEnd,
        descriptionKey: 'keybindings.commands.cursorDocEnd'
    },
    [KeyBindingName.SelectDocStart]: {
        handler: selectDocStart,
        descriptionKey: 'keybindings.commands.selectDocStart'
    },
    [KeyBindingName.SelectDocEnd]: {
        handler: selectDocEnd,
        descriptionKey: 'keybindings.commands.selectDocEnd'
    },
    [KeyBindingName.SelectMatchingBracket]: {
        handler: selectMatchingBracket,
        descriptionKey: 'keybindings.commands.selectMatchingBracket'
    },
    [KeyBindingName.SplitLine]: {
        handler: splitLine,
        descriptionKey: 'keybindings.commands.splitLine'
    },
    [KeyBindingName.IndentLess]: {
        handler: indentLess,
        descriptionKey: 'keybindings.commands.indentLess'
    },
    [KeyBindingName.IndentMore]: {
        handler: indentMore,
        descriptionKey: 'keybindings.commands.indentMore'
    },
    [KeyBindingName.IndentSelection]: {
        handler: indentSelection,
        descriptionKey: 'keybindings.commands.indentSelection'
    },
    [KeyBindingName.CursorMatchingBracket]: {
        handler: cursorMatchingBracket,
        descriptionKey: 'keybindings.commands.cursorMatchingBracket'
    },
    [KeyBindingName.ToggleComment]: {
        handler: toggleComment,
        descriptionKey: 'keybindings.commands.toggleComment'
    },
    [KeyBindingName.ToggleBlockComment]: {
        handler: toggleBlockComment,
        descriptionKey: 'keybindings.commands.toggleBlockComment'
    },
    [KeyBindingName.InsertNewlineAndIndent]: {
        handler: insertNewlineAndIndent,
        descriptionKey: 'keybindings.commands.insertNewlineAndIndent'
    },
    [KeyBindingName.DeleteCharBackward]: {
        handler: deleteCharBackward,
        descriptionKey: 'keybindings.commands.deleteCharBackward'
    },
    [KeyBindingName.DeleteCharForward]: {
        handler: deleteCharForward,
        descriptionKey: 'keybindings.commands.deleteCharForward'
    },
    [KeyBindingName.DeleteGroupBackward]: {
        handler: deleteGroupBackward,
        descriptionKey: 'keybindings.commands.deleteGroupBackward'
    },
    [KeyBindingName.DeleteGroupForward]: {
        handler: deleteGroupForward,
        descriptionKey: 'keybindings.commands.deleteGroupForward'
    },

    // Emacs 模式额外的基础导航命令
    [KeyBindingName.CursorCharLeft]: {
        handler: cursorCharLeft,
        descriptionKey: 'keybindings.commands.cursorCharLeft'
    },
    [KeyBindingName.CursorCharRight]: {
        handler: cursorCharRight,
        descriptionKey: 'keybindings.commands.cursorCharRight'
    },
    [KeyBindingName.CursorLineUp]: {
        handler: cursorLineUp,
        descriptionKey: 'keybindings.commands.cursorLineUp'
    },
    [KeyBindingName.CursorLineDown]: {
        handler: cursorLineDown,
        descriptionKey: 'keybindings.commands.cursorLineDown'
    },
    [KeyBindingName.CursorPageUp]: {
        handler: cursorPageUp,
        descriptionKey: 'keybindings.commands.cursorPageUp'
    },
    [KeyBindingName.CursorPageDown]: {
        handler: cursorPageDown,
        descriptionKey: 'keybindings.commands.cursorPageDown'
    },
    [KeyBindingName.SelectCharLeft]: {
        handler: selectCharLeft,
        descriptionKey: 'keybindings.commands.selectCharLeft'
    },
    [KeyBindingName.SelectCharRight]: {
        handler: selectCharRight,
        descriptionKey: 'keybindings.commands.selectCharRight'
    },
    [KeyBindingName.SelectLineUp]: {
        handler: selectLineUp,
        descriptionKey: 'keybindings.commands.selectLineUp'
    },
    [KeyBindingName.SelectLineDown]: {
        handler: selectLineDown,
        descriptionKey: 'keybindings.commands.selectLineDown'
    },
};

/**
 * 获取命令处理函数
 * @param key 命令标识符
 * @returns 对应的处理函数，如果不存在则返回 undefined
 */
export const getCommandHandler = (key: string) => {
    return commands[key]?.handler;
};

/**
 * 获取命令描述
 * @param key 命令标识符
 * @returns 对应的描述，如果不存在则返回 undefined
 */
export const getCommandDescription = (key: string) => {
    const descriptionKey = commands[key]?.descriptionKey;
    return descriptionKey ? i18n.global.t(descriptionKey) : undefined;
};

/**
 * 检查命令是否已注册
 * @param key 命令标识符
 * @returns 是否已注册
 */
export const isCommandRegistered = (key: string): boolean => {
    return key in commands;
};

/**
 * 获取所有已注册的命令
 * @returns 已注册的命令列表
 */
export const getRegisteredCommands = (): string[] => {
    return Object.keys(commands);
};
