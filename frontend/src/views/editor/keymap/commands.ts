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
    copyLineDown,
    copyLineUp,
    cursorMatchingBracket,
    cursorSyntaxLeft,
    cursorSyntaxRight,
    deleteCharBackward,
    deleteCharForward,
    deleteGroupBackward,
    deleteGroupForward,
    indentLess,
    indentMore,
    indentSelection,
    insertBlankLine,
    insertNewlineAndIndent,
    redo,
    redoSelection,
    selectLine,
    selectParentSyntax,
    selectSyntaxLeft,
    selectSyntaxRight,
    toggleBlockComment,
    toggleComment,
    undo,
    undoSelection
} from '@codemirror/commands';
import {foldAll, foldCode, unfoldAll, unfoldCode} from '@codemirror/language';
import i18n from '@/i18n';
import {KeyBindingKey} from '@/../bindings/voidraft/internal/models/models';

// 默认代码块扩展选项
const defaultBlockExtensionOptions = {
    defaultBlockToken: 'text',
    defaultBlockAutoDetect: true,
};

/**
 * 前端命令注册表
 * 将后端定义的key字段映射到具体的前端方法和翻译键
 */
export const commands: Record<string, { handler: any; descriptionKey: string }> = {
    [KeyBindingKey.ShowSearchKeyBindingKey]: {
        handler: openSearchPanel,
        descriptionKey: 'keybindings.commands.showSearch'
    },
    [KeyBindingKey.HideSearchKeyBindingKey]: {
        handler: closeSearchPanel,
        descriptionKey: 'keybindings.commands.hideSearch'
    },
    [KeyBindingKey.BlockSelectAllKeyBindingKey]: {
        handler: selectAll,
        descriptionKey: 'keybindings.commands.blockSelectAll'
    },
    [KeyBindingKey.BlockAddAfterCurrentKeyBindingKey]: {
        handler: addNewBlockAfterCurrent(defaultBlockExtensionOptions),
        descriptionKey: 'keybindings.commands.blockAddAfterCurrent'
    },
    [KeyBindingKey.BlockAddAfterLastKeyBindingKey]: {
        handler: addNewBlockAfterLast(defaultBlockExtensionOptions),
        descriptionKey: 'keybindings.commands.blockAddAfterLast'
    },
    [KeyBindingKey.BlockAddBeforeCurrentKeyBindingKey]: {
        handler: addNewBlockBeforeCurrent(defaultBlockExtensionOptions),
        descriptionKey: 'keybindings.commands.blockAddBeforeCurrent'
    },
    [KeyBindingKey.BlockGotoPreviousKeyBindingKey]: {
        handler: gotoPreviousBlock,
        descriptionKey: 'keybindings.commands.blockGotoPrevious'
    },
    [KeyBindingKey.BlockGotoNextKeyBindingKey]: {
        handler: gotoNextBlock,
        descriptionKey: 'keybindings.commands.blockGotoNext'
    },
    [KeyBindingKey.BlockSelectPreviousKeyBindingKey]: {
        handler: selectPreviousBlock,
        descriptionKey: 'keybindings.commands.blockSelectPrevious'
    },
    [KeyBindingKey.BlockSelectNextKeyBindingKey]: {
        handler: selectNextBlock,
        descriptionKey: 'keybindings.commands.blockSelectNext'
    },
    [KeyBindingKey.BlockDeleteKeyBindingKey]: {
        handler: deleteBlock(defaultBlockExtensionOptions),
        descriptionKey: 'keybindings.commands.blockDelete'
    },
    [KeyBindingKey.BlockMoveUpKeyBindingKey]: {
        handler: moveCurrentBlockUp,
        descriptionKey: 'keybindings.commands.blockMoveUp'
    },
    [KeyBindingKey.BlockMoveDownKeyBindingKey]: {
        handler: moveCurrentBlockDown,
        descriptionKey: 'keybindings.commands.blockMoveDown'
    },
    [KeyBindingKey.BlockDeleteLineKeyBindingKey]: {
        handler: deleteLineCommand,
        descriptionKey: 'keybindings.commands.blockDeleteLine'
    },
    [KeyBindingKey.BlockMoveLineUpKeyBindingKey]: {
        handler: moveLineUp,
        descriptionKey: 'keybindings.commands.blockMoveLineUp'
    },
    [KeyBindingKey.BlockMoveLineDownKeyBindingKey]: {
        handler: moveLineDown,
        descriptionKey: 'keybindings.commands.blockMoveLineDown'
    },
    [KeyBindingKey.BlockTransposeCharsKeyBindingKey]: {
        handler: transposeChars,
        descriptionKey: 'keybindings.commands.blockTransposeChars'
    },
    [KeyBindingKey.BlockFormatKeyBindingKey]: {
        handler: formatCurrentBlock,
        descriptionKey: 'keybindings.commands.blockFormat'
    },
    [KeyBindingKey.BlockCopyKeyBindingKey]: {
        handler: copyCommand,
        descriptionKey: 'keybindings.commands.blockCopy'
    },
    [KeyBindingKey.BlockCutKeyBindingKey]: {
        handler: cutCommand,
        descriptionKey: 'keybindings.commands.blockCut'
    },
    [KeyBindingKey.BlockPasteKeyBindingKey]: {
        handler: pasteCommand,
        descriptionKey: 'keybindings.commands.blockPaste'
    },
    [KeyBindingKey.HistoryUndoKeyBindingKey]: {
        handler: undo,
        descriptionKey: 'keybindings.commands.historyUndo'
    },
    [KeyBindingKey.HistoryRedoKeyBindingKey]: {
        handler: redo,
        descriptionKey: 'keybindings.commands.historyRedo'
    },
    [KeyBindingKey.HistoryUndoSelectionKeyBindingKey]: {
        handler: undoSelection,
        descriptionKey: 'keybindings.commands.historyUndoSelection'
    },
    [KeyBindingKey.HistoryRedoSelectionKeyBindingKey]: {
        handler: redoSelection,
        descriptionKey: 'keybindings.commands.historyRedoSelection'
    },
    [KeyBindingKey.FoldCodeKeyBindingKey]: {
        handler: foldCode,
        descriptionKey: 'keybindings.commands.foldCode'
    },
    [KeyBindingKey.UnfoldCodeKeyBindingKey]: {
        handler: unfoldCode,
        descriptionKey: 'keybindings.commands.unfoldCode'
    },
    [KeyBindingKey.FoldAllKeyBindingKey]: {
        handler: foldAll,
        descriptionKey: 'keybindings.commands.foldAll'
    },
    [KeyBindingKey.UnfoldAllKeyBindingKey]: {
        handler: unfoldAll,
        descriptionKey: 'keybindings.commands.unfoldAll'
    },
    [KeyBindingKey.CursorSyntaxLeftKeyBindingKey]: {
        handler: cursorSyntaxLeft,
        descriptionKey: 'keybindings.commands.cursorSyntaxLeft'
    },
    [KeyBindingKey.CursorSyntaxRightKeyBindingKey]: {
        handler: cursorSyntaxRight,
        descriptionKey: 'keybindings.commands.cursorSyntaxRight'
    },
    [KeyBindingKey.SelectSyntaxLeftKeyBindingKey]: {
        handler: selectSyntaxLeft,
        descriptionKey: 'keybindings.commands.selectSyntaxLeft'
    },
    [KeyBindingKey.SelectSyntaxRightKeyBindingKey]: {
        handler: selectSyntaxRight,
        descriptionKey: 'keybindings.commands.selectSyntaxRight'
    },
    [KeyBindingKey.CopyLineUpKeyBindingKey]: {
        handler: copyLineUp,
        descriptionKey: 'keybindings.commands.copyLineUp'
    },
    [KeyBindingKey.CopyLineDownKeyBindingKey]: {
        handler: copyLineDown,
        descriptionKey: 'keybindings.commands.copyLineDown'
    },
    [KeyBindingKey.InsertBlankLineKeyBindingKey]: {
        handler: insertBlankLine,
        descriptionKey: 'keybindings.commands.insertBlankLine'
    },
    [KeyBindingKey.SelectLineKeyBindingKey]: {
        handler: selectLine,
        descriptionKey: 'keybindings.commands.selectLine'
    },
    [KeyBindingKey.SelectParentSyntaxKeyBindingKey]: {
        handler: selectParentSyntax,
        descriptionKey: 'keybindings.commands.selectParentSyntax'
    },
    [KeyBindingKey.IndentLessKeyBindingKey]: {
        handler: indentLess,
        descriptionKey: 'keybindings.commands.indentLess'
    },
    [KeyBindingKey.IndentMoreKeyBindingKey]: {
        handler: indentMore,
        descriptionKey: 'keybindings.commands.indentMore'
    },
    [KeyBindingKey.IndentSelectionKeyBindingKey]: {
        handler: indentSelection,
        descriptionKey: 'keybindings.commands.indentSelection'
    },
    [KeyBindingKey.CursorMatchingBracketKeyBindingKey]: {
        handler: cursorMatchingBracket,
        descriptionKey: 'keybindings.commands.cursorMatchingBracket'
    },
    [KeyBindingKey.ToggleCommentKeyBindingKey]: {
        handler: toggleComment,
        descriptionKey: 'keybindings.commands.toggleComment'
    },
    [KeyBindingKey.ToggleBlockCommentKeyBindingKey]: {
        handler: toggleBlockComment,
        descriptionKey: 'keybindings.commands.toggleBlockComment'
    },
    [KeyBindingKey.InsertNewlineAndIndentKeyBindingKey]: {
        handler: insertNewlineAndIndent,
        descriptionKey: 'keybindings.commands.insertNewlineAndIndent'
    },
    [KeyBindingKey.DeleteCharBackwardKeyBindingKey]: {
        handler: deleteCharBackward,
        descriptionKey: 'keybindings.commands.deleteCharBackward'
    },
    [KeyBindingKey.DeleteCharForwardKeyBindingKey]: {
        handler: deleteCharForward,
        descriptionKey: 'keybindings.commands.deleteCharForward'
    },
    [KeyBindingKey.DeleteGroupBackwardKeyBindingKey]: {
        handler: deleteGroupBackward,
        descriptionKey: 'keybindings.commands.deleteGroupBackward'
    },
    [KeyBindingKey.DeleteGroupForwardKeyBindingKey]: {
        handler: deleteGroupForward,
        descriptionKey: 'keybindings.commands.deleteGroupForward'
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
