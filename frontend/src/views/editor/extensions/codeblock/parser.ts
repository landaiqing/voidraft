/**
 * Block 解析器
 */

import { EditorState } from '@codemirror/state';
import { syntaxTree, ensureSyntaxTree } from '@codemirror/language';
import type { Tree } from '@lezer/common';
import {
    Block as BlockNode,
    BlockDelimiter,
    BlockContent,
} from './lang-parser/parser.terms.js';
import {
    type Block,
    type BlockAccess,
    type BlockDelimiterInfo,
    type SupportedLanguage,
    AUTO_DETECT_SUFFIX,
    DELIMITER_PREFIX,
    DELIMITER_REGEX,
    DELIMITER_START,
    DELIMITER_SUFFIX,
    READONLY_SUFFIX,
    WRITABLE_SUFFIX,
} from './types';
import { LANGUAGES } from './lang-parser/languages';

const DEFAULT_LANGUAGE = (LANGUAGES[0]?.token || 'text') as SupportedLanguage;
const DEFAULT_ACCESS: BlockAccess = 'write';

function getDefaultDelimiterInfo(): BlockDelimiterInfo {
    return {
        language: DEFAULT_LANGUAGE,
        auto: false,
        access: DEFAULT_ACCESS,
    };
}

/**
 * 从语法树解析代码块
 */
export function getBlocksFromSyntaxTree(state: EditorState): Block[] | null {
    const tree = syntaxTree(state);
    if (!tree) {
        return null;
    }
    return collectBlocksFromTree(tree, state);
}

function collectBlocksFromTree(tree: Tree, state: EditorState): Block[] | null {
    const blocks: Block[] = [];
    const doc = state.doc;

    tree.iterate({
        enter(node) {
            if (node.type.id !== BlockNode) {
                return;
            }

            let delimiter: { from: number; to: number } | null = null;
            let content: { from: number; to: number } | null = null;
            let delimiterInfo = getDefaultDelimiterInfo();

            const blockNode = node.node;
            blockNode.firstChild?.cursor().iterate(child => {
                if (child.type.id === BlockDelimiter) {
                    delimiter = { from: child.from, to: child.to };
                    const delimiterText = doc.sliceString(child.from, child.to);
                    delimiterInfo = parseDelimiter(delimiterText) ?? getDefaultDelimiterInfo();
                } else if (child.type.id === BlockContent) {
                    content = { from: child.from, to: child.to };
                }
            });

            if (!delimiter || !content) {
                return;
            }

            blocks.push({
                language: {
                    name: delimiterInfo.language,
                    auto: delimiterInfo.auto,
                },
                access: delimiterInfo.access,
                content,
                delimiter,
                range: {
                    from: node.from,
                    to: node.to,
                },
            });
        }
    });

    if (blocks.length > 0) {
        firstBlockDelimiterSize = blocks[0].delimiter.to;
        return blocks;
    }

    return null;
}

// 跟踪第一个分隔符的大小
export let firstBlockDelimiterSize: number | undefined;

/**
 * 从文档字符串内容解析块，使用 String.indexOf()
 */
export function getBlocksFromString(state: EditorState): Block[] {
    const blocks: Block[] = [];
    const doc = state.doc;

    if (doc.length === 0) {
        return [createPlainTextBlock(0, 0)];
    }

    const content = doc.sliceString(0, doc.length);
    const suffixLength = DELIMITER_SUFFIX.length;

    let pos = findDelimiter(content, 0);

    if (pos === -1) {
        firstBlockDelimiterSize = 0;
        return [createPlainTextBlock(0, doc.length)];
    }

    if (pos > 0) {
        blocks.push(createPlainTextBlock(0, pos));
    }

    while (pos !== -1 && pos < doc.length) {
        const blockStart = pos;
        const langStart = blockStart + delimiterPrefixLength(content, blockStart);
        const delimiterEnd = content.indexOf(DELIMITER_SUFFIX, langStart);
        if (delimiterEnd === -1) {
            break;
        }

        const delimiterText = content.slice(blockStart, delimiterEnd + suffixLength);
        const delimiterInfo = parseDelimiter(delimiterText);
        if (!delimiterInfo) {
            break;
        }

        const contentStart = delimiterEnd + suffixLength;
        const nextDelimiter = findDelimiter(content, contentStart);
        const contentEnd = nextDelimiter === -1 ? doc.length : nextDelimiter;

        blocks.push({
            language: {
                name: delimiterInfo.language,
                auto: delimiterInfo.auto,
            },
            access: delimiterInfo.access,
            content: { from: contentStart, to: contentEnd },
            delimiter: { from: blockStart, to: delimiterEnd + suffixLength },
            range: { from: blockStart, to: contentEnd },
        });

        pos = nextDelimiter;
    }

    if (blocks.length === 0) {
        blocks.push(createPlainTextBlock(0, doc.length));
        firstBlockDelimiterSize = 0;
    } else {
        firstBlockDelimiterSize = blocks[0].delimiter.to;
    }

    return blocks;
}

/**
 * 获取文档中的所有块
 */
export function getBlocks(state: EditorState): Block[] {
    let blocks = getBlocksFromSyntaxTree(state);
    if (blocks) {
        return blocks;
    }

    const ensuredTree = ensureSyntaxTree(state, state.doc.length, 200);
    if (ensuredTree) {
        blocks = collectBlocksFromTree(ensuredTree, state);
        if (blocks) {
            return blocks;
        }
    }

    return getBlocksFromString(state);
}

/**
 * 获取当前光标所在的块
 */
export function getActiveBlock(state: EditorState): Block | undefined {
    const range = state.selection.asSingle().ranges[0];
    const blocks = getBlocks(state);
    return blocks.find(block =>
        block.range.from <= range.head && block.range.to >= range.head
    );
}

/**
 * 获取第一个块
 */
export function getFirstBlock(state: EditorState): Block | undefined {
    const blocks = getBlocks(state);
    return blocks[0];
}

/**
 * 获取最后一个块
 */
export function getLastBlock(state: EditorState): Block | undefined {
    const blocks = getBlocks(state);
    return blocks[blocks.length - 1];
}

/**
 * 根据位置获取块
 */
export function getBlockFromPos(state: EditorState, pos: number): Block | undefined {
    const blocks = getBlocks(state);
    return blocks.find(block =>
        block.range.from <= pos && block.range.to >= pos
    );
}

/**
 * 获取块的行信息
 */
export function getBlockLineFromPos(state: EditorState, pos: number) {
    const line = state.doc.lineAt(pos);
    const block = getBlockFromPos(state, pos);

    if (block) {
        const firstBlockLine = state.doc.lineAt(block.content.from).number;
        return {
            line: line.number - firstBlockLine + 1,
            col: pos - line.from,
            length: line.length,
        };
    }

    return {
        line: line.number,
        col: pos - line.from,
        length: line.length,
    };
}

/**
 * 创建新的分隔符文本
 */
export function createDelimiter(
    language: SupportedLanguage,
    autoDetect = false,
    access: BlockAccess = DEFAULT_ACCESS,
): string {
    const suffixes: string[] = [];
    if (autoDetect) {
        suffixes.push(AUTO_DETECT_SUFFIX);
    }
    suffixes.push(access === 'read' ? READONLY_SUFFIX : WRITABLE_SUFFIX);
    return `${DELIMITER_PREFIX}${language}${suffixes.join('')}${DELIMITER_SUFFIX}`;
}

/**
 * 验证分隔符格式
 */
export function isValidDelimiter(text: string): boolean {
    return parseDelimiter(text) !== null;
}

/**
 * 解析分隔符信息
 */
export function parseDelimiter(delimiterText: string): BlockDelimiterInfo | null {
    const match = delimiterText.match(DELIMITER_REGEX);
    if (!match) {
        return null;
    }

    const [, languageName, rawFlags = ''] = match;
    const validLanguage = LANGUAGES.some(lang => lang.token === languageName)
        ? languageName as SupportedLanguage
        : DEFAULT_LANGUAGE;

    const flags = rawFlags.match(/-(?:a|r|w)/g) ?? [];
    let auto = false;
    let access: BlockAccess = DEFAULT_ACCESS;

    for (const flag of flags) {
        if (flag === AUTO_DETECT_SUFFIX) {
            auto = true;
        } else if (flag === READONLY_SUFFIX) {
            access = 'read';
        } else if (flag === WRITABLE_SUFFIX) {
            access = 'write';
        } else {
            return null;
        }
    }

    return {
        language: validLanguage,
        auto,
        access,
    };
}

function createPlainTextBlock(from: number, to: number): Block {
    return {
        language: { name: DEFAULT_LANGUAGE, auto: false },
        access: DEFAULT_ACCESS,
        content: { from, to },
        delimiter: { from: 0, to: 0 },
        range: { from, to },
    };
}

function findDelimiter(content: string, from: number): number {
    if (from <= 0 && content.startsWith(DELIMITER_START)) {
        return 0;
    }
    return content.indexOf(DELIMITER_PREFIX, Math.max(from, 0));
}

function delimiterPrefixLength(content: string, from: number): number {
    if (content.startsWith(DELIMITER_PREFIX, from)) {
        return DELIMITER_PREFIX.length;
    }
    return DELIMITER_START.length;
}
