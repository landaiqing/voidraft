import {KeyBindingCommand} from '@/../bindings/voidraft/internal/models/models'
import {
    hideSearchVisibilityCommand,
    searchReplaceAll,
    searchShowReplace,
    searchToggleCase,
    searchToggleRegex,
    searchToggleWholeWord,
    showSearchVisibilityCommand
} from '../extensions/vscodeSearch/commands'
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
} from '../extensions/codeblock/commands'
import {selectAll} from '../extensions/codeblock/selectAll'
import {deleteLineCommand} from '../extensions/codeblock/deleteLine'
import {moveLineDown, moveLineUp} from '../extensions/codeblock/moveLines'
import {transposeChars} from '../extensions/codeblock'
import {copyCommand, cutCommand, pasteCommand} from '../extensions/codeblock/copyPaste'
import {textHighlightToggleCommand} from '../extensions/textHighlight/textHighlightExtension'
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
} from '@codemirror/commands'
import {foldAll, foldCode, unfoldAll, unfoldCode} from '@codemirror/language'
import i18n from '@/i18n'

// 默认编辑器选项
const defaultEditorOptions = {
    defaultBlockToken: 'text',
    defaultBlockAutoDetect: true,
}

/**
 * 前端命令注册表
 * 将后端定义的command字段映射到具体的前端方法和翻译键
 */
export const commandRegistry = {
    [KeyBindingCommand.ShowSearchCommand]: {
        handler: showSearchVisibilityCommand,
        descriptionKey: 'keybindings.commands.showSearch'
    },
    [KeyBindingCommand.HideSearchCommand]: {
        handler: hideSearchVisibilityCommand,
        descriptionKey: 'keybindings.commands.hideSearch'
    },
    [KeyBindingCommand.SearchToggleCaseCommand]: {
        handler: searchToggleCase,
        descriptionKey: 'keybindings.commands.searchToggleCase'
    },
    [KeyBindingCommand.SearchToggleWordCommand]: {
        handler: searchToggleWholeWord,
        descriptionKey: 'keybindings.commands.searchToggleWord'
    },
    [KeyBindingCommand.SearchToggleRegexCommand]: {
        handler: searchToggleRegex,
        descriptionKey: 'keybindings.commands.searchToggleRegex'
    },
    [KeyBindingCommand.SearchShowReplaceCommand]: {
        handler: searchShowReplace,
        descriptionKey: 'keybindings.commands.searchShowReplace'
    },
    [KeyBindingCommand.SearchReplaceAllCommand]: {
        handler: searchReplaceAll,
        descriptionKey: 'keybindings.commands.searchReplaceAll'
    },

    // 代码块操作命令
    [KeyBindingCommand.BlockSelectAllCommand]: {
        handler: selectAll,
        descriptionKey: 'keybindings.commands.blockSelectAll'
    },
    [KeyBindingCommand.BlockAddAfterCurrentCommand]: {
        handler: addNewBlockAfterCurrent(defaultEditorOptions),
        descriptionKey: 'keybindings.commands.blockAddAfterCurrent'
    },
    [KeyBindingCommand.BlockAddAfterLastCommand]: {
        handler: addNewBlockAfterLast(defaultEditorOptions),
        descriptionKey: 'keybindings.commands.blockAddAfterLast'
    },
    [KeyBindingCommand.BlockAddBeforeCurrentCommand]: {
        handler: addNewBlockBeforeCurrent(defaultEditorOptions),
        descriptionKey: 'keybindings.commands.blockAddBeforeCurrent'
    },
    [KeyBindingCommand.BlockGotoPreviousCommand]: {
        handler: gotoPreviousBlock,
        descriptionKey: 'keybindings.commands.blockGotoPrevious'
    },
    [KeyBindingCommand.BlockGotoNextCommand]: {
        handler: gotoNextBlock,
        descriptionKey: 'keybindings.commands.blockGotoNext'
    },
    [KeyBindingCommand.BlockSelectPreviousCommand]: {
        handler: selectPreviousBlock,
        descriptionKey: 'keybindings.commands.blockSelectPrevious'
    },
    [KeyBindingCommand.BlockSelectNextCommand]: {
        handler: selectNextBlock,
        descriptionKey: 'keybindings.commands.blockSelectNext'
    },
    [KeyBindingCommand.BlockDeleteCommand]: {
        handler: deleteBlock(defaultEditorOptions),
        descriptionKey: 'keybindings.commands.blockDelete'
    },
    [KeyBindingCommand.BlockMoveUpCommand]: {
        handler: moveCurrentBlockUp,
        descriptionKey: 'keybindings.commands.blockMoveUp'
    },
    [KeyBindingCommand.BlockMoveDownCommand]: {
        handler: moveCurrentBlockDown,
        descriptionKey: 'keybindings.commands.blockMoveDown'
    },
    [KeyBindingCommand.BlockDeleteLineCommand]: {
        handler: deleteLineCommand,
        descriptionKey: 'keybindings.commands.blockDeleteLine'
    },
    [KeyBindingCommand.BlockMoveLineUpCommand]: {
        handler: moveLineUp,
        descriptionKey: 'keybindings.commands.blockMoveLineUp'
    },
    [KeyBindingCommand.BlockMoveLineDownCommand]: {
        handler: moveLineDown,
        descriptionKey: 'keybindings.commands.blockMoveLineDown'
    },
    [KeyBindingCommand.BlockTransposeCharsCommand]: {
        handler: transposeChars,
        descriptionKey: 'keybindings.commands.blockTransposeChars'
    },
    [KeyBindingCommand.BlockFormatCommand]: {
        handler: formatCurrentBlock,
        descriptionKey: 'keybindings.commands.blockFormat'
    },
    [KeyBindingCommand.BlockCopyCommand]: {
        handler: copyCommand,
        descriptionKey: 'keybindings.commands.blockCopy'
    },
    [KeyBindingCommand.BlockCutCommand]: {
        handler: cutCommand,
        descriptionKey: 'keybindings.commands.blockCut'
    },
    [KeyBindingCommand.BlockPasteCommand]: {
        handler: pasteCommand,
        descriptionKey: 'keybindings.commands.blockPaste'
    },
    [KeyBindingCommand.HistoryUndoCommand]: {
        handler: undo,
        descriptionKey: 'keybindings.commands.historyUndo'
    },
    [KeyBindingCommand.HistoryRedoCommand]: {
        handler: redo,
        descriptionKey: 'keybindings.commands.historyRedo'
    },
    [KeyBindingCommand.HistoryUndoSelectionCommand]: {
        handler: undoSelection,
        descriptionKey: 'keybindings.commands.historyUndoSelection'
    },
    [KeyBindingCommand.HistoryRedoSelectionCommand]: {
        handler: redoSelection,
        descriptionKey: 'keybindings.commands.historyRedoSelection'
    },
    [KeyBindingCommand.FoldCodeCommand]: {
        handler: foldCode,
        descriptionKey: 'keybindings.commands.foldCode'
    },
    [KeyBindingCommand.UnfoldCodeCommand]: {
        handler: unfoldCode,
        descriptionKey: 'keybindings.commands.unfoldCode'
    },
    [KeyBindingCommand.FoldAllCommand]: {
        handler: foldAll,
        descriptionKey: 'keybindings.commands.foldAll'
    },
    [KeyBindingCommand.UnfoldAllCommand]: {
        handler: unfoldAll,
        descriptionKey: 'keybindings.commands.unfoldAll'
    },
    [KeyBindingCommand.CursorSyntaxLeftCommand]: {
        handler: cursorSyntaxLeft,
        descriptionKey: 'keybindings.commands.cursorSyntaxLeft'
    },
    [KeyBindingCommand.CursorSyntaxRightCommand]: {
        handler: cursorSyntaxRight,
        descriptionKey: 'keybindings.commands.cursorSyntaxRight'
    },
    [KeyBindingCommand.SelectSyntaxLeftCommand]: {
        handler: selectSyntaxLeft,
        descriptionKey: 'keybindings.commands.selectSyntaxLeft'
    },
    [KeyBindingCommand.SelectSyntaxRightCommand]: {
        handler: selectSyntaxRight,
        descriptionKey: 'keybindings.commands.selectSyntaxRight'
    },
    [KeyBindingCommand.CopyLineUpCommand]: {
        handler: copyLineUp,
        descriptionKey: 'keybindings.commands.copyLineUp'
    },
    [KeyBindingCommand.CopyLineDownCommand]: {
        handler: copyLineDown,
        descriptionKey: 'keybindings.commands.copyLineDown'
    },
    [KeyBindingCommand.InsertBlankLineCommand]: {
        handler: insertBlankLine,
        descriptionKey: 'keybindings.commands.insertBlankLine'
    },
    [KeyBindingCommand.SelectLineCommand]: {
        handler: selectLine,
        descriptionKey: 'keybindings.commands.selectLine'
    },
    [KeyBindingCommand.SelectParentSyntaxCommand]: {
        handler: selectParentSyntax,
        descriptionKey: 'keybindings.commands.selectParentSyntax'
    },
    [KeyBindingCommand.IndentLessCommand]: {
        handler: indentLess,
        descriptionKey: 'keybindings.commands.indentLess'
    },
    [KeyBindingCommand.IndentMoreCommand]: {
        handler: indentMore,
        descriptionKey: 'keybindings.commands.indentMore'
    },
    [KeyBindingCommand.IndentSelectionCommand]: {
        handler: indentSelection,
        descriptionKey: 'keybindings.commands.indentSelection'
    },
    [KeyBindingCommand.CursorMatchingBracketCommand]: {
        handler: cursorMatchingBracket,
        descriptionKey: 'keybindings.commands.cursorMatchingBracket'
    },
    [KeyBindingCommand.ToggleCommentCommand]: {
        handler: toggleComment,
        descriptionKey: 'keybindings.commands.toggleComment'
    },
    [KeyBindingCommand.ToggleBlockCommentCommand]: {
        handler: toggleBlockComment,
        descriptionKey: 'keybindings.commands.toggleBlockComment'
    },
    [KeyBindingCommand.InsertNewlineAndIndentCommand]: {
        handler: insertNewlineAndIndent,
        descriptionKey: 'keybindings.commands.insertNewlineAndIndent'
    },
    [KeyBindingCommand.DeleteCharBackwardCommand]: {
        handler: deleteCharBackward,
        descriptionKey: 'keybindings.commands.deleteCharBackward'
    },
    [KeyBindingCommand.DeleteCharForwardCommand]: {
        handler: deleteCharForward,
        descriptionKey: 'keybindings.commands.deleteCharForward'
    },
    [KeyBindingCommand.DeleteGroupBackwardCommand]: {
        handler: deleteGroupBackward,
        descriptionKey: 'keybindings.commands.deleteGroupBackward'
    },
    [KeyBindingCommand.DeleteGroupForwardCommand]: {
        handler: deleteGroupForward,
        descriptionKey: 'keybindings.commands.deleteGroupForward'
    },

    // 文本高亮扩展命令
    [KeyBindingCommand.TextHighlightToggleCommand]: {
        handler: textHighlightToggleCommand,
        descriptionKey: 'keybindings.commands.textHighlightToggle'
    },
} as const

/**
 * 获取命令处理函数
 * @param command 命令名称
 * @returns 对应的处理函数，如果不存在则返回 undefined
 */
export const getCommandHandler = (command: KeyBindingCommand) => {
    return commandRegistry[command]?.handler
}

/**
 * 获取命令描述
 * @param command 命令名称
 * @returns 对应的描述，如果不存在则返回 undefined
 */
export const getCommandDescription = (command: KeyBindingCommand) => {
    const descriptionKey = commandRegistry[command]?.descriptionKey
    return descriptionKey ? i18n.global.t(descriptionKey) : undefined
}

/**
 * 检查命令是否已注册
 * @param command 命令名称
 * @returns 是否已注册
 */
export const isCommandRegistered = (command: KeyBindingCommand): boolean => {
    return command in commandRegistry
}

/**
 * 获取所有已注册的命令
 * @returns 已注册的命令列表
 */
export const getRegisteredCommands = (): KeyBindingCommand[] => {
    return Object.keys(commandRegistry) as KeyBindingCommand[]
} 