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
import {lineNumbers} from '@codemirror/view';

// 导入核心模块
import {blockState} from './state';
import {getBlockDecorationExtensions} from './decorations';
import {getBlockSelectExtensions} from './selectAll';
import {getCopyPasteExtensions} from './copyPaste';
import {moveLineDown, moveLineUp} from './moveLines';
import {getCodeBlockLanguageExtension} from './lang-parser';
import {createLanguageDetection} from './lang-detect';
import {SupportedLanguage} from './types';
import {getMathBlockExtensions} from './mathBlock';
import {createCursorProtection} from './cursorProtection';

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

    /** 分隔符高度（像素） */
    separatorHeight?: number;
}

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
 * 注意：blockLineNumbers 已移至动态扩展管理，通过 ExtensionLineNumbers 控制
 */
export function createCodeBlockExtension(options: CodeBlockOptions = {}): Extension {
    const {
        showBackground = true,
        enableAutoDetection = true,
        defaultLanguage = 'text',
    } = options;

    return [
        // 核心状态管理
        blockState,

        // 语言解析支持
        ...getCodeBlockLanguageExtension(),

        // 语言自动检测（如果启用）
        ...(enableAutoDetection ? [createLanguageDetection({
            defaultLanguage: defaultLanguage,
            confidenceThreshold: 0.15,
            minContentLength: 8
        })] : []),

        // 视觉装饰系统
        ...getBlockDecorationExtensions({
            showBackground
        }),

        // 光标保护（防止方向键移动到分隔符上）
        createCursorProtection(),

        // 块选择功能
        ...getBlockSelectExtensions(),

        // 复制粘贴功能
        ...getCopyPasteExtensions(),

        // 数学块功能
        ...getMathBlockExtensions(),

    ];
}


// 导出核心功能
export {
    // 类型定义
    type Block,
    type SupportedLanguage,
    type CreateBlockOptions,
} from './types';

// 导出解析器函数
export {
    getActiveBlock,
    getBlockFromPos
} from './parser';

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

// 格式化功能
export {formatBlockContent} from './formatCode';

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
    languageMapping,
    LanguageInfo,
} from './lang-parser';

// 语言检测
export {
    createLanguageDetection,
    detectLanguage,
    detectLanguages,
    levenshteinDistance,
    type LanguageDetectionResult
} from './lang-detect';

// 行号相关
export {getBlockLineFromPos, blockLineNumbers};

// 数学块功能
export {
    getMathBlockExtensions
} from './mathBlock';

// 光标保护功能
export {
    createCursorProtection
} from './cursorProtection';

/**
 * 默认导出
 */
export default createCodeBlockExtension; 