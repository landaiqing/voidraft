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
  | 'scala';

/**
 * 支持的语言列表
 */
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  'auto',
  'text',
  'json',
  'py',
  'html',
  'sql',
  'md',
  'java',
  'php',
  'css',
  'xml',
  'cpp',
  'rs',
  'cs',
  'rb',
  'sh',
  'yaml',
  'toml',
  'go',
  'clj',
  'ex',
  'erl',
  'js',
  'ts',
  'swift',
  'kt',
  'groovy',
  'ps1',
  'dart',
  'scala'
];

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

// 语言信息接口
export interface LanguageInfo {
  name: SupportedLanguage;
  auto: boolean; // 是否自动检测语言
}

// 位置范围接口
export interface Range {
  from: number;
  to: number;
}

// 代码块核心接口
export interface CodeBlock {
  language: LanguageInfo;
  content: Range;    // 内容区域
  delimiter: Range;  // 分隔符区域
  range: Range;      // 整个块区域（包括分隔符和内容）
}

// 代码块解析选项
export interface ParseOptions {
  fallbackLanguage?: SupportedLanguage;
  enableAutoDetection?: boolean;
}

// 分隔符格式常量
export const DELIMITER_REGEX = /^\n∞∞∞([a-zA-Z0-9_-]+)(-a)?\n/gm;
export const DELIMITER_PREFIX = '\n∞∞∞';
export const DELIMITER_SUFFIX = '\n';
export const AUTO_DETECT_SUFFIX = '-a';

// 代码块操作类型
export type BlockOperation = 
  | 'insert-after'
  | 'insert-before' 
  | 'delete'
  | 'move-up'
  | 'move-down'
  | 'change-language';

// 代码块状态更新事件
export interface BlockStateUpdate {
  blocks: CodeBlock[];
  activeBlockIndex: number;
  operation?: BlockOperation;
}

// 语言检测结果
export interface LanguageDetectionResult {
  language: SupportedLanguage;
  confidence: number;
} 