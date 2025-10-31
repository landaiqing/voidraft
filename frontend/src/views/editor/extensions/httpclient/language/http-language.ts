import { LRLanguage, LanguageSupport, foldNodeProp, foldInside, indentNodeProp } from '@codemirror/language';
import { parser } from './http.grammar.js';
import { httpHighlighting } from './http-highlight';

/**
 * HTTP Client 语言定义
 */

// 配置折叠规则和高亮
const httpParserWithMetadata = parser.configure({
  props: [
    // 应用语法高亮
    httpHighlighting,
    
    // 折叠规则：允许折叠多行 Body、Variables、Headers 等
    foldNodeProp.add({
      BodyStatement: foldInside,
      VariablesStatement: foldInside,
      Document: foldInside,
    }),
    
    // 缩进规则
    indentNodeProp.add({
      BodyStatement: () => 2,
      HeaderStatement: () => 0,
      VariableDeclaration: () => 0,
    }),
  ],
});

// 创建 LR 语言实例
export const httpLanguage = LRLanguage.define({
  parser: httpParserWithMetadata,
  languageData: {
    // 注释配置
    commentTokens: { line: '#' },
    
    // 自动闭合括号
    closeBrackets: { brackets: ['(', '[', '{', '"', "'"] },
    
    // 单词字符定义
    wordChars: '-_',
  },
});

/**
 * HTTP Client 语言支持
 * 包含语法高亮、折叠、缩进等完整功能
 */
export function http() {
  return new LanguageSupport(httpLanguage, [
    httpLanguage.data.of({
      autocomplete: httpCompletion,
    }),
  ]);
}

/**
 * HTTP Client 自动补全
 */
function httpCompletion(context: any) {
  const word = context.matchBefore(/\w*/);
  if (!word || (word.from === word.to && !context.explicit)) {
    return null;
  }

  return {
    from: word.from,
    options: [
      // HTTP 方法
      { label: 'GET', type: 'keyword', detail: 'HTTP Method' },
      { label: 'POST', type: 'keyword', detail: 'HTTP Method' },
      { label: 'PUT', type: 'keyword', detail: 'HTTP Method' },
      { label: 'DELETE', type: 'keyword', detail: 'HTTP Method' },
      { label: 'PATCH', type: 'keyword', detail: 'HTTP Method' },
      { label: 'HEAD', type: 'keyword', detail: 'HTTP Method' },
      { label: 'OPTIONS', type: 'keyword', detail: 'HTTP Method' },
      
      // 关键字
      { label: 'HEADER', type: 'keyword', detail: 'Header Statement' },
      { label: 'BODY', type: 'keyword', detail: 'Body Statement' },
      { label: 'VARIABLES', type: 'keyword', detail: 'Variables Statement' },
      
      // Body 类型
      { label: 'TEXT', type: 'keyword', detail: 'Body Type' },
      { label: 'JSON', type: 'keyword', detail: 'Body Type' },
      { label: 'XML', type: 'keyword', detail: 'Body Type' },
      { label: 'FORM', type: 'keyword', detail: 'Body Type' },
      { label: 'URLENCODED', type: 'keyword', detail: 'Body Type' },
      { label: 'GRAPHQL', type: 'keyword', detail: 'Body Type' },
      { label: 'BINARY', type: 'keyword', detail: 'Body Type' },
      
      // HTTP 版本
      { label: 'HTTP/1.0', type: 'constant', detail: 'HTTP Version' },
      { label: 'HTTP/1.1', type: 'constant', detail: 'HTTP Version' },
      { label: 'HTTP/2.0', type: 'constant', detail: 'HTTP Version' },
      
      // 常用 Headers
      { label: 'Content-Type', type: 'property', detail: 'Header Name' },
      { label: 'Authorization', type: 'property', detail: 'Header Name' },
      { label: 'Accept', type: 'property', detail: 'Header Name' },
      { label: 'User-Agent', type: 'property', detail: 'Header Name' },
      { label: 'Cookie', type: 'property', detail: 'Header Name' },
      
      // 常用 Content-Type
      { label: 'application/json', type: 'constant', detail: 'Content Type' },
      { label: 'application/xml', type: 'constant', detail: 'Content Type' },
      { label: 'text/html', type: 'constant', detail: 'Content Type' },
      { label: 'text/plain', type: 'constant', detail: 'Content Type' },
      { label: 'multipart/form-data', type: 'constant', detail: 'Content Type' },
      { label: 'application/x-www-form-urlencoded', type: 'constant', detail: 'Content Type' },
      
      // 特殊标记
      { label: '@timestamp', type: 'keyword', detail: 'Timestamp' },
      { label: '@file', type: 'keyword', detail: 'File Reference' },
      
      // 内置函数
      { label: '$timestamp()', type: 'function', detail: 'Current Timestamp' },
      { label: '$uuid()', type: 'function', detail: 'Generate UUID' },
      { label: '$randomInt()', type: 'function', detail: 'Random Integer' },
      { label: '$hash()', type: 'function', detail: 'Hash Function' },
    ],
  };
}

/**
 * 导出语言定义和高亮配置
 */
export { httpHighlighting };

