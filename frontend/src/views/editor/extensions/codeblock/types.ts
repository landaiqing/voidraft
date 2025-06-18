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
  | 'text'
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'html'
  | 'css'
  | 'json'
  | 'markdown'
  | 'shell'
  | 'sql'
  | 'yaml'
  | 'xml'
  | 'php'
  | 'java'
  | 'cpp'
  | 'c'
  | 'go'
  | 'rust'
  | 'ruby';

/**
 * 支持的语言列表
 */
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  'text',
  'javascript',
  'typescript',
  'python',
  'html',
  'css',
  'json',
  'markdown',
  'shell',
  'sql',
  'yaml',
  'xml',
  'php',
  'java',
  'cpp',
  'c',
  'go',
  'rust',
  'ruby'
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

// 块导航方向
export type NavigationDirection = 'next' | 'previous' | 'first' | 'last';

// 语言检测结果
export interface LanguageDetectionResult {
  language: SupportedLanguage;
  confidence: number;
} 