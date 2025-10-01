/**
 * Block 结构
 */
export interface Block {
    language: {
        name: string;
        auto: boolean;
    };
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
 * 支持的语言类型
 */
export type SupportedLanguage =
    | 'auto'        // 自动检测
    | 'text'
    | 'json'
    | 'py'          // Python
    | 'html'
    | 'sql'
    | 'md'          // Markdown
    | 'java'
    | 'php'
    | 'css'
    | 'xml'
    | 'cpp'         // C++
    | 'rs'          // Rust
    | 'cs'          // C#
    | 'rb'          // Ruby
    | 'sh'          // Shell
    | 'yaml'
    | 'toml'
    | 'go'
    | 'clj'         // Clojure
    | 'ex'          // Elixir
    | 'erl'         // Erlang
    | 'js'          // JavaScript
    | 'ts'          // TypeScript
    | 'swift'
    | 'kt'          // Kotlin
    | 'groovy'
    | 'ps1'         // PowerShell
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

/**
 * 创建块的选项
 */
export interface CreateBlockOptions {
    language?: SupportedLanguage;
    auto?: boolean;
    content?: string;
}

/**
 * 编辑器配置选项
 */
export interface EditorOptions {
    defaultBlockToken: string;
    defaultBlockAutoDetect: boolean;
}



// 分隔符格式常量
export const DELIMITER_REGEX = /^\n∞∞∞([a-zA-Z0-9_-]+)(-a)?\n/gm;
export const DELIMITER_PREFIX = '\n∞∞∞';
export const DELIMITER_SUFFIX = '\n';
export const AUTO_DETECT_SUFFIX = '-a';
