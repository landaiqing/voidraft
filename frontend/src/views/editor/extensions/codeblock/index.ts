/**
 * CodeBlock 扩展主入口
 */

import {Extension} from '@codemirror/state';
import {EditorView, keymap} from '@codemirror/view';

// 导入核心模块
import {blockState} from './state';
import {getBlockDecorationExtensions} from './decorations';
import * as commands from './commands';
import {selectAll, getBlockSelectExtensions} from './selectAll';
import {getCopyPasteExtensions, getCopyPasteKeymap} from './copyPaste';
import {EditorOptions, SupportedLanguage} from './types';
import {lineNumbers} from '@codemirror/view';
import './styles.css'

/**
 * 代码块扩展配置选项
 */
export interface CodeBlockOptions {
    // 视觉选项
    showBackground?: boolean;

    // 功能选项
    enableAutoDetection?: boolean;
    defaultLanguage?: SupportedLanguage;

    // 编辑器选项
    defaultBlockToken?: string;
    defaultBlockAutoDetect?: boolean;
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
        defaultBlockToken = 'text',
        defaultBlockAutoDetect = false,
    } = options;

    const editorOptions: EditorOptions = {
        defaultBlockToken,
        defaultBlockAutoDetect,
    };

    const extensions: Extension[] = [
        // 核心状态管理
        blockState,

        // 块内行号
        blockLineNumbers,

        // 视觉装饰系统
        ...getBlockDecorationExtensions({
            showBackground
        }),

        // 块选择功能
        ...getBlockSelectExtensions(),

        // 复制粘贴功能
        ...getCopyPasteExtensions(),

        // 主题样式
        EditorView.theme({
            '&': {
                fontSize: '14px'
            },
            '.cm-content': {
                fontFamily: 'Monaco, Menlo, "Ubuntu Mono", consolas, monospace'
            },
            '.cm-focused': {
                outline: 'none'
            }
        }),

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

// 行号相关
export { getBlockLineFromPos, blockLineNumbers };

/**
 * 默认导出
 */
export default createCodeBlockExtension; 