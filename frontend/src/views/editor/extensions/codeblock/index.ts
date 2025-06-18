/**
 * CodeBlock 扩展主入口
 * 
 * 配置说明：
 * - showBackground: 控制是否显示代码块的背景色区分
 * - enableAutoDetection: 控制是否启用内容的语言自动检测功能
 * - defaultLanguage: 新建代码块时使用的默认语言（也是自动检测的回退语言）
 * - defaultAutoDetect: 新建代码块时是否默认添加-a标记启用自动检测
 * 
 * 注意：defaultLanguage 和 defaultAutoDetect 是配合使用的：
 * - 如果 defaultAutoDetect=true，新建块会是 ∞∞∞javascript-a（会根据内容自动检测语言）
 * - 如果 defaultAutoDetect=false，新建块会是 ∞∞∞javascript（固定使用指定语言）
 */

import {Extension} from '@codemirror/state';
import {keymap} from '@codemirror/view';

// 导入核心模块
import {blockState} from './state';
import {getBlockDecorationExtensions} from './decorations';
import * as commands from './commands';
import {selectAll, getBlockSelectExtensions} from './selectAll';
import {getCopyPasteExtensions, getCopyPasteKeymap} from './copyPaste';
import {deleteLineCommand} from './deleteLine';
import {moveLineUp, moveLineDown} from './moveLines';
import {transposeChars} from './transposeChars';
import {getCodeBlockLanguageExtension} from './lang-parser';
import {createLanguageDetection} from './language-detection';
import {EditorOptions, SupportedLanguage} from './types';
import {lineNumbers} from '@codemirror/view';
import './styles.css'

/**
 * 代码块扩展配置选项
 */
export interface CodeBlockOptions {
    /** 是否显示块背景色 */
    showBackground?: boolean;

    /** 是否启用语言自动检测功能 */
    enableAutoDetection?: boolean;
    
    /** 新建块时的默认语言 */
    defaultLanguage?: SupportedLanguage;
    
    /** 新建块时是否默认启用自动检测（添加-a标记） */
    defaultAutoDetect?: boolean;
}

/**
 * 默认编辑器选项
 */
const defaultEditorOptions: EditorOptions = {
    defaultBlockToken: 'text',
    defaultBlockAutoDetect: false,
};

/**
 * 获取块内行号信息
 */
function getBlockLineFromPos(state: any, pos: number) {
    const line = state.doc.lineAt(pos);
    const blocks = state.field(blockState);
    const block = blocks.find((block: any) => 
        block.content.from <= line.from && block.content.to >= line.from
    );
    
    if (block) {
        const firstBlockLine = state.doc.lineAt(block.content.from).number;
        return {
            line: line.number - firstBlockLine + 1,
            col: pos - line.from + 1,
            length: line.length,
        };
    }
    return null;
}

/**
 * 创建块内行号扩展
 */
const blockLineNumbers = lineNumbers({
    formatNumber(lineNo, state) {
        if (state.doc.lines >= lineNo) {
            const lineInfo = getBlockLineFromPos(state, state.doc.line(lineNo).from);
            if (lineInfo !== null) {
                return lineInfo.line.toString();
            }
        }
        return "";
    }
});

/**
 * 创建代码块扩展
 */
export function createCodeBlockExtension(options: CodeBlockOptions = {}): Extension {
    const {
        showBackground = true,
        enableAutoDetection = true,
        defaultLanguage = 'text',
        defaultAutoDetect = true,
    } = options;

    // 将简化的配置转换为内部使用的EditorOptions
    const editorOptions: EditorOptions = {
        defaultBlockToken: defaultLanguage,
        defaultBlockAutoDetect: defaultAutoDetect,
    };

    const extensions: Extension[] = [
        // 核心状态管理
        blockState,

        // 块内行号
        blockLineNumbers,

        // 语言解析支持
        ...getCodeBlockLanguageExtension(),

        // 语言自动检测（如果启用）
        ...(enableAutoDetection ? [createLanguageDetection({
            defaultLanguage: defaultLanguage,
            confidenceThreshold: 0.3,
            minContentLength: 8,
        })] : []),

        // 视觉装饰系统
        ...getBlockDecorationExtensions({
            showBackground
        }),

        // 块选择功能
        ...getBlockSelectExtensions(),

        // 复制粘贴功能
        ...getCopyPasteExtensions(),

        // 键盘映射
        keymap.of([
            // 复制粘贴命令
            ...getCopyPasteKeymap(),

            // 块隔离选择命令
            {
                key: 'Mod-a',
                run: selectAll,
                preventDefault: true
            },
            // 块创建命令
            {
                key: 'Mod-Enter',
                run: commands.addNewBlockAfterCurrent(editorOptions),
                preventDefault: true
            },
            {
                key: 'Mod-Shift-Enter',
                run: commands.addNewBlockAfterLast(editorOptions),
                preventDefault: true
            },
            {
                key: 'Alt-Enter',
                run: commands.addNewBlockBeforeCurrent(editorOptions),
                preventDefault: true
            },

            // 块导航命令
            {
                key: 'Mod-ArrowUp',
                run: commands.gotoPreviousBlock,
                preventDefault: true
            },
            {
                key: 'Mod-ArrowDown',
                run: commands.gotoNextBlock,
                preventDefault: true
            },
            {
                key: 'Mod-Shift-ArrowUp',
                run: commands.selectPreviousBlock,
                preventDefault: true
            },
            {
                key: 'Mod-Shift-ArrowDown',
                run: commands.selectNextBlock,
                preventDefault: true
            },

            // 块编辑命令
            {
                key: 'Mod-Shift-d',
                run: commands.deleteBlock(editorOptions),
                preventDefault: true
            },
            {
                key: 'Alt-Mod-ArrowUp',
                run: commands.moveCurrentBlockUp,
                preventDefault: true
            },
            {
                key: 'Alt-Mod-ArrowDown',
                run: commands.moveCurrentBlockDown,
                preventDefault: true
            },

            // 行编辑命令
            {
                key: 'Mod-Shift-k',  // 删除行
                run: deleteLineCommand,
                preventDefault: true
            },
            {
                key: 'Alt-ArrowUp',  // 向上移动行
                run: moveLineUp,
                preventDefault: true
            },
            {
                key: 'Alt-ArrowDown',  // 向下移动行
                run: moveLineDown,
                preventDefault: true
            },
            {
                key: 'Ctrl-t',  // 字符转置
                run: transposeChars,
                preventDefault: true
            },
        ])
    ];

    return extensions;
}


// 导出核心功能
export {
    // 类型定义
    type Block,
    type SupportedLanguage,
    type CreateBlockOptions,
    SUPPORTED_LANGUAGES
} from './types';

// 状态管理
export {
    blockState,
    getActiveNoteBlock,
    getFirstNoteBlock,
    getLastNoteBlock,
    getNoteBlockFromPos
} from './state';

// 解析器
export {
    getBlocks,
    getBlocksFromString,
    firstBlockDelimiterSize
} from './parser';

// 命令
export * from './commands';

// 选择功能
export {
    selectAll,
    getBlockSelectExtensions
} from './selectAll';

// 复制粘贴功能
export {
    copyCommand,
    cutCommand,
    pasteCommand,
    getCopyPasteExtensions,
    getCopyPasteKeymap
} from './copyPaste';

// 删除行功能
export {
    deleteLine,
    deleteLineCommand
} from './deleteLine';

// 移动行功能
export {
    moveLineUp,
    moveLineDown
} from './moveLines';

// 字符转置功能
export {
    transposeChars
} from './transposeChars';

// 语言解析器
export {
    getCodeBlockLanguageExtension,
    getLanguage,
    getLanguageTokens,
    languageMapping,
    LanguageInfo,
    LANGUAGES as PARSER_LANGUAGES
} from './lang-parser';

// 语言检测
export {
    createLanguageDetection,
    detectLanguage,
    detectLanguages,
    detectLanguageHeuristic,
    getSupportedDetectionLanguages,
    levenshteinDistance,
    type LanguageDetectionResult
} from './language-detection';

// 行号相关
export { getBlockLineFromPos, blockLineNumbers };

/**
 * 默认导出
 */
export default createCodeBlockExtension; 