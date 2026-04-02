/**
 * Block 结构
 */
export interface Block {
    language: {
        name: string;
        auto: boolean;
    };
    access: BlockAccess;
    content: {
        from: number;
        to: number;
    };
    delimiter: {
        from: number;
        to: number;
    };
    range: {
        from: number;
        to: number;
    };
}

/**
 * 代码块访问模式
 */
export type BlockAccess = 'read' | 'write';

/**
 * 分隔符解析结果
 */
export interface BlockDelimiterInfo {
    language: SupportedLanguage;
    auto: boolean;
    access: BlockAccess;
}

/**
 * 支持的语言类型
 */
export type SupportedLanguage =
    | 'auto'
    | 'text'
    | 'json'
    | 'py'
    | 'html'
    | 'sql'
    | 'md'
    | 'java'
    | 'php'
    | 'css'
    | 'xml'
    | 'cpp'
    | 'rs'
    | 'cs'
    | 'rb'
    | 'sh'
    | 'yaml'
    | 'toml'
    | 'go'
    | 'clj'
    | 'ex'
    | 'erl'
    | 'js'
    | 'ts'
    | 'swift'
    | 'kt'
    | 'groovy'
    | 'ps1'
    | 'dart'
    | 'scala'
    | 'dockerfile'
    | 'lua'
    | 'math'
    | 'vue'
    | 'lezer'
    | 'liquid'
    | 'wast'
    | 'sass'
    | 'less'
    | 'angular'
    | 'svelte'
    | 'http'
    | 'mermaid'
    | 'image';

/**
 * 创建块的选项
 */
export interface CreateBlockOptions {
    language?: SupportedLanguage;
    auto?: boolean;
    access?: BlockAccess;
    content?: string;
}

/**
 * 编辑器配置选项
 */
export interface EditorOptions {
    defaultBlockToken: string;
    defaultBlockAutoDetect: boolean;
    defaultBlockAccess?: BlockAccess;
}

export const DELIMITER_PREFIX = '\n∞∞∞';
export const DELIMITER_SUFFIX = '\n';
export const AUTO_DETECT_SUFFIX = '-a';
export const READONLY_SUFFIX = '-r';
export const WRITABLE_SUFFIX = '-w';

export const DELIMITER_REGEX = /^\n∞∞∞([a-zA-Z0-9_]+)((?:-(?:a|r|w))*)\n$/m;
