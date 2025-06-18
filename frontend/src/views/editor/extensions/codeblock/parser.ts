/**
 * Block 解析器
 */

import { EditorState } from '@codemirror/state';
import { syntaxTree, syntaxTreeAvailable } from '@codemirror/language';
import {
    CodeBlock,
    SupportedLanguage,
    SUPPORTED_LANGUAGES,
    DELIMITER_REGEX,
    DELIMITER_PREFIX,
    DELIMITER_SUFFIX,
    AUTO_DETECT_SUFFIX,
    ParseOptions,
    LanguageDetectionResult,
    Block
} from './types';

/**
 * 语言检测工具
 */
class LanguageDetector {
    // 语言关键字映射
    private static readonly LANGUAGE_PATTERNS: Record<string, RegExp[]> = {
        javascript: [
            /\b(function|const|let|var|class|extends|import|export|async|await)\b/,
            /\b(console\.log|document\.|window\.)\b/,
            /=>\s*[{(]/
        ],
        typescript: [
            /\b(interface|type|enum|namespace|implements|declare)\b/,
            /:\s*(string|number|boolean|object|any)\b/,
            /<[A-Z][a-zA-Z0-9<>,\s]*>/
        ],
        python: [
            /\b(def|class|import|from|if __name__|print|len|range)\b/,
            /^\s*#.*$/m,
            /\b(True|False|None)\b/
        ],
        java: [
            /\b(public|private|protected|static|final|class|interface)\b/,
            /\b(System\.out\.println|String|int|void)\b/,
            /import\s+[a-zA-Z0-9_.]+;/
        ],
        html: [
            /<\/?[a-zA-Z][^>]*>/,
            /<!DOCTYPE\s+html>/i,
            /<(div|span|p|h[1-6]|body|head|html)\b/
        ],
        css: [
            /[.#][a-zA-Z][\w-]*\s*{/,
            /\b(color|background|margin|padding|font-size):\s*[^;]+;/,
            /@(media|keyframes|import)\b/
        ],
        json: [
            /^\s*[{\[][\s\S]*[}\]]\s*$/,
            /"[^"]*":\s*(".*"|[\d.]+|true|false|null)/,
            /,\s*$/m
        ],
        sql: [
            /\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i,
            /\b(JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP BY|ORDER BY)\b/i,
            /;\s*$/m
        ],
        shell: [
            /^#!/,
            /\b(echo|cd|ls|grep|awk|sed|cat|chmod)\b/,
            /\$\{?\w+\}?/
        ],
        markdown: [
            /^#+\s+/m,
            /\*\*.*?\*\*/,
            /\[.*?\]\(.*?\)/,
            /^```/m
        ]
    };

    /**
     * 检测文本的编程语言
     */
    static detectLanguage(text: string): LanguageDetectionResult {
        if (!text.trim()) {
            return { language: 'text', confidence: 1.0 };
        }

        const scores: Record<string, number> = {};

        // 对每种语言计算匹配分数
        for (const [language, patterns] of Object.entries(this.LANGUAGE_PATTERNS)) {
            let score = 0;
            const textLower = text.toLowerCase();

            for (const pattern of patterns) {
                const matches = text.match(pattern);
                if (matches) {
                    score += matches.length;
                }
            }

            // 根据文本长度标准化分数
            scores[language] = score / Math.max(text.length / 100, 1);
        }

        // 找到最高分的语言
        const bestMatch = Object.entries(scores)
            .sort(([, a], [, b]) => b - a)[0];

        if (bestMatch && bestMatch[1] > 0) {
            return {
                language: bestMatch[0] as SupportedLanguage,
                confidence: Math.min(bestMatch[1], 1.0)
            };
        }

        return { language: 'text', confidence: 1.0 };
    }
}

/**
 * 从语法树解析代码块
 */
export function getBlocksFromSyntaxTree(state: EditorState): CodeBlock[] | null {
    if (!syntaxTreeAvailable(state)) {
        return null;
    }

    const tree = syntaxTree(state);
    const blocks: CodeBlock[] = [];
    const doc = state.doc;

    // TODO: 如果使用自定义 Lezer 语法，在这里实现语法树解析
    // 目前先返回 null，使用字符串解析作为后备
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
    // 如果文档为空，创建一个默认的文本块
        return [{
      language: {
        name: 'text',
        auto: false,
      },
      content: {
        from: 0,
        to: 0,
      },
      delimiter: {
        from: 0,
        to: 0,
      },
      range: {
        from: 0,
        to: 0,
      },
        }];
    }

  const content = doc.sliceString(0, doc.length);
  const delim = "\n∞∞∞";
  let pos = 0;

  // 检查文档是否以分隔符开始
  if (!content.startsWith("∞∞∞")) {
    // 如果文档不以分隔符开始，查找第一个分隔符
    const firstDelimPos = content.indexOf(delim);
    
    if (firstDelimPos === -1) {
      // 如果没有找到分隔符，整个文档作为一个文本块
      return [{
        language: {
          name: 'text',
          auto: false,
        },
        content: {
          from: 0,
          to: doc.length,
        },
        delimiter: {
          from: 0,
          to: 0,
        },
        range: {
          from: 0,
          to: doc.length,
        },
        }];
    }

    // 创建第一个块（分隔符之前的内容）
    blocks.push({
      language: {
        name: 'text',
        auto: false,
      },
      content: {
        from: 0,
        to: firstDelimPos,
      },
      delimiter: {
        from: 0,
        to: 0,
      },
      range: {
        from: 0,
        to: firstDelimPos,
      },
    });
    
    pos = firstDelimPos;
    firstBlockDelimiterSize = 0;
  }
  
  while (pos < doc.length) {
    const blockStart = content.indexOf(delim, pos);
    if (blockStart !== pos) {
      // 如果在当前位置没有找到分隔符，可能是文档结尾
      break;
    }
    
    const langStart = blockStart + delim.length;
    const delimiterEnd = content.indexOf("\n", langStart);
    if (delimiterEnd < 0) {
      console.error("Error parsing blocks. Delimiter didn't end with newline");
      break;
    }
    
    const langFull = content.substring(langStart, delimiterEnd);
    let auto = false;
    let lang = langFull;
    
    if (langFull.endsWith("-a")) {
      auto = true;
      lang = langFull.substring(0, langFull.length - 2);
    }
    
    const contentFrom = delimiterEnd + 1;
    let blockEnd = content.indexOf(delim, contentFrom);
    if (blockEnd < 0) {
      blockEnd = doc.length;
    }
    
    const block: Block = {
      language: {
        name: lang || 'text',
        auto: auto,
      },
      content: {
        from: contentFrom,
        to: blockEnd,
      },
      delimiter: {
        from: blockStart,
        to: delimiterEnd + 1,
      },
      range: {
        from: blockStart,
        to: blockEnd,
      },
    };
    
    blocks.push(block);
    pos = blockEnd;
    
    // 设置第一个块分隔符的大小（只有当这是第一个有分隔符的块时）
    if (blocks.length === 1 && firstBlockDelimiterSize === undefined) {
      firstBlockDelimiterSize = block.delimiter.to;
    }
  }
  
  // 如果没有找到任何块，创建一个默认块
  if (blocks.length === 0) {
        blocks.push({
      language: {
        name: 'text',
        auto: false,
      },
      content: {
        from: 0,
        to: doc.length,
      },
      delimiter: {
        from: 0,
        to: 0,
      },
      range: {
        from: 0,
        to: doc.length,
      },
    });
    firstBlockDelimiterSize = 0;
    }

    return blocks;
}

/**
 * 获取文档中的所有块
 */
export function getBlocks(state: EditorState): Block[] {
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
export function createDelimiter(language: SupportedLanguage, autoDetect = false): string {
    const suffix = autoDetect ? AUTO_DETECT_SUFFIX : '';
    return `${DELIMITER_PREFIX}${language}${suffix}${DELIMITER_SUFFIX}`;
}

/**
 * 验证分隔符格式
 */
export function isValidDelimiter(text: string): boolean {
    DELIMITER_REGEX.lastIndex = 0;
    return DELIMITER_REGEX.test(text);
}

/**
 * 解析分隔符信息
 */
export function parseDelimiter(delimiterText: string): { language: SupportedLanguage; auto: boolean } | null {
    DELIMITER_REGEX.lastIndex = 0;
    const match = DELIMITER_REGEX.exec(delimiterText);

    if (!match) {
        return null;
    }

    const languageName = match[1];
    const isAuto = match[2] === AUTO_DETECT_SUFFIX;

    const validLanguage = SUPPORTED_LANGUAGES.includes(languageName as SupportedLanguage)
        ? languageName as SupportedLanguage
        : 'text';

    return {
        language: validLanguage,
        auto: isAuto
    };
}