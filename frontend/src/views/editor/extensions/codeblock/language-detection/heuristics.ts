/**
 * 基于启发式规则的语言检测
 * 用于快速识别常见的编程语言模式
 */

import { SupportedLanguage } from '../types';

/**
 * 语言检测结果
 */
export interface LanguageDetectionResult {
    language: SupportedLanguage;
    confidence: number;
}

/**
 * 语言模式定义
 */
interface LanguagePattern {
    patterns: RegExp[];
    weight: number;
}

/**
 * 语言检测规则映射
 */
const LANGUAGE_PATTERNS: Record<string, LanguagePattern> = {
    javascript: {
        patterns: [
            /\b(function|const|let|var|class|extends|import|export|async|await)\b/g,
            /\b(console\.log|document\.|window\.)\b/g,
            /=>\s*[{(]/g,
            /\b(require|module\.exports)\b/g,
        ],
        weight: 1.0,
    },
    typescript: {
        patterns: [
            /\b(interface|type|enum|namespace|implements|declare)\b/g,
            /:\s*(string|number|boolean|object|any)\b/g,
            /<[A-Z][a-zA-Z0-9<>,\s]*>/g,
            /\b(public|private|protected|readonly)\b/g,
        ],
        weight: 1.2,
    },
    python: {
        patterns: [
            /\b(def|class|import|from|if __name__|print|len|range)\b/g,
            /^\s*#.*$/gm,
            /\b(True|False|None)\b/g,
            /:\s*$/gm,
        ],
        weight: 1.0,
    },
    java: {
        patterns: [
            /\b(public|private|protected|static|final|class|interface)\b/g,
            /\b(System\.out\.println|String|int|void)\b/g,
            /import\s+[a-zA-Z0-9_.]+;/g,
            /\b(extends|implements)\b/g,
        ],
        weight: 1.0,
    },
    html: {
        patterns: [
            /<\/?[a-zA-Z][^>]*>/g,
            /<!DOCTYPE\s+html>/gi,
            /<(div|span|p|h[1-6]|body|head|html)\b/g,
            /\s(class|id|src|href)=/g,
        ],
        weight: 1.5,
    },
    css: {
        patterns: [
            /[.#][a-zA-Z][\w-]*\s*{/g,
            /\b(color|background|margin|padding|font-size):\s*[^;]+;/g,
            /@(media|keyframes|import)\b/g,
            /\{[^}]*\}/g,
        ],
        weight: 1.3,
    },
    json: {
        patterns: [
            /^\s*[{\[][\s\S]*[}\]]\s*$/,
            /"[^"]*":\s*(".*"|[\d.]+|true|false|null)/g,
            /,\s*$/gm,
        ],
        weight: 2.0,
    },
    sql: {
        patterns: [
            /\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/gi,
            /\b(JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP BY|ORDER BY)\b/gi,
            /;\s*$/gm,
            /\b(TABLE|DATABASE|INDEX)\b/gi,
        ],
        weight: 1.4,
    },
    shell: {
        patterns: [
            /^#!/g,
            /\b(echo|cd|ls|grep|awk|sed|cat|chmod)\b/g,
            /\$\{?\w+\}?/g,
            /\|\s*\w+/g,
        ],
        weight: 1.2,
    },
    markdown: {
        patterns: [
            /^#+\s+/gm,
            /\*\*.*?\*\*/g,
            /\[.*?\]\(.*?\)/g,
            /^```/gm,
        ],
        weight: 1.1,
    },
    php: {
        patterns: [
            /<\?php/g,
            /\$\w+/g,
            /\b(function|class|extends|implements)\b/g,
            /echo\s+/g,
        ],
        weight: 1.3,
    },
    cpp: {
        patterns: [
            /#include\s*<.*>/g,
            /\b(int|char|float|double|void|class|struct)\b/g,
            /std::/g,
            /cout\s*<<|cin\s*>>/g,
        ],
        weight: 1.1,
    },
    rust: {
        patterns: [
            /\bfn\s+\w+/g,
            /\b(let|mut|struct|enum|impl|trait)\b/g,
            /println!\(/g,
            /::\w+/g,
        ],
        weight: 1.2,
    },
    go: {
        patterns: [
            /\bfunc\s+\w+/g,
            /\b(var|const|type|package|import)\b/g,
            /fmt\.\w+/g,
            /:=\s*/g,
        ],
        weight: 1.1,
    },
    ruby: {
        patterns: [
            /\b(def|class|module|end)\b/g,
            /\b(puts|print|require)\b/g,
            /@\w+/g,
            /\|\w+\|/g,
        ],
        weight: 1.0,
    },
    yaml: {
        patterns: [
            /^\s*\w+:\s*.*$/gm,           // key: value 模式
            /^\s*-\s+\w+/gm,              // 列表项
            /^---\s*$/gm,                 // 文档分隔符
            /^\s*\w+:\s*\|/gm,            // 多行字符串
            /^\s*\w+:\s*>/gm,             // 折叠字符串
            /^\s*#.*$/gm,                 // 注释
            /:\s*\[.*\]/g,                // 内联数组
            /:\s*\{.*\}/g,                // 内联对象
        ],
        weight: 1.5,
    },
    xml: {
        patterns: [
            /<\?xml/g,
            /<\/\w+>/g,
            /<\w+[^>]*\/>/g,
            /\s\w+="[^"]*"/g,
        ],
        weight: 1.3,
    },
};

/**
 * JSON 特殊检测
 * 使用更严格的规则检测 JSON
 */
function detectJSON(content: string): LanguageDetectionResult | null {
    const trimmed = content.trim();
    
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
            JSON.parse(trimmed);
            return {
                language: 'json',
                confidence: 1.0,
            };
        } catch (e) {
            // JSON 解析失败，继续其他检测
        }
    }
    
    return null;
}

/**
 * 计算文本与语言模式的匹配分数
 */
function calculateScore(content: string, pattern: LanguagePattern): number {
    let score = 0;
    const contentLength = Math.max(content.length, 1);
    
    for (const regex of pattern.patterns) {
        const matches = content.match(regex);
        if (matches) {
            score += matches.length;
        }
    }
    
    // 根据内容长度和权重标准化分数
    return (score * pattern.weight) / (contentLength / 100);
}

/**
 * 基于启发式规则检测语言
 */
export function detectLanguageHeuristic(content: string): LanguageDetectionResult {
    if (!content.trim()) {
        return { language: 'text', confidence: 1.0 };
    }
    
    // 首先尝试 JSON 特殊检测
    const jsonResult = detectJSON(content);
    if (jsonResult) {
        return jsonResult;
    }
    
    const scores: Record<string, number> = {};
    
    // 计算每种语言的匹配分数
    for (const [language, pattern] of Object.entries(LANGUAGE_PATTERNS)) {
        scores[language] = calculateScore(content, pattern);
    }
    
    // 找到最高分的语言
    const sortedScores = Object.entries(scores)
        .sort(([, a], [, b]) => b - a)
        .filter(([, score]) => score > 0);
    
    if (sortedScores.length > 0) {
        const [bestLanguage, bestScore] = sortedScores[0];
        return {
            language: bestLanguage as SupportedLanguage,
            confidence: Math.min(bestScore, 1.0),
        };
    }
    
    return { language: 'text', confidence: 1.0 };
}

/**
 * 获取所有支持的检测语言
 */
export function getSupportedDetectionLanguages(): SupportedLanguage[] {
    return Object.keys(LANGUAGE_PATTERNS) as SupportedLanguage[];
} 