/**
 * 代码块语言解析器入口
 * 导出所有语言解析相关的功能
 */

// 主要语言支持
export {
  CodeBlockLanguage,
  codeBlockLang,
  getCodeBlockLanguageExtension
} from './codeblock-lang';

// 语言映射和信息
export {
  LanguageInfo,
  LANGUAGES,
  languageMapping,
  getLanguage,
} from './languages';

// 嵌套解析器
export {
  configureNesting
} from './nested-parser';

// 解析器术语
export * from './parser.terms';

// 外部标记器
export {
  blockContent
} from './external-tokens';

// 解析器
export {
  parser
} from './parser';