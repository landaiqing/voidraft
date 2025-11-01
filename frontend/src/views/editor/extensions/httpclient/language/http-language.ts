import { LRLanguage, LanguageSupport, foldNodeProp, foldInside, indentNodeProp } from '@codemirror/language';
import { CompletionContext } from '@codemirror/autocomplete';
import { parser } from './http.parser';
import { httpHighlighting } from './http.highlight';

/**
 * HTTP Client 语言定义
 */

// 配置折叠规则和高亮
const httpParserWithMetadata = parser.configure({
  props: [
    // 应用语法高亮
    httpHighlighting,
    
    // 折叠规则：允许折叠块结构
    foldNodeProp.add({
      RequestStatement: foldInside,
      Block: foldInside,
      AtRule: foldInside,
      Document: foldInside,
    }),
    
    // 缩进规则
    indentNodeProp.add({
      Block: () => 2,
      Declaration: () => 0,
      AtRule: () => 0,
    }),
  ],
});

// 创建 LR 语言实例
export const httpLanguage = LRLanguage.define({
  parser: httpParserWithMetadata,
  languageData: {
    
    //自动闭合括号
    closeBrackets: { brackets: ['(', '[', '{', '"', "'"] },
    
    // 单词字符定义
    wordChars: '-_',
  },
});

/**
 * HTTP Client 语言支持
 * 包含语法高亮、折叠、缩进、自动补全等完整功能
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
function httpCompletion(context: CompletionContext) {
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
      
      // @ 规则
      { label: '@json', type: 'keyword', detail: 'Body Type' },
      { label: '@formdata', type: 'keyword', detail: 'Body Type' },
      { label: '@urlencoded', type: 'keyword', detail: 'Body Type' },
      { label: '@text', type: 'keyword', detail: 'Body Type' },
      { label: '@res', type: 'keyword', detail: 'Response' },
      
      // 常用 Headers
      { label: 'content-type', type: 'property', detail: 'Header' },
      { label: 'authorization', type: 'property', detail: 'Header' },
      { label: 'accept', type: 'property', detail: 'Header' },
      { label: 'user-agent', type: 'property', detail: 'Header' },
      { label: 'host', type: 'property', detail: 'Header' },
      
      // 常用 Content-Type
      { label: '"application/json"', type: 'constant', detail: 'Content Type' },
      { label: '"text/plain"', type: 'constant', detail: 'Content Type' },
      { label: '"multipart/form-data"', type: 'constant', detail: 'Content Type' },
      { label: '"application/x-www-form-urlencoded"', type: 'constant', detail: 'Content Type' },
      
      // 布尔值
      { label: 'true', type: 'constant', detail: 'Boolean' },
      { label: 'false', type: 'constant', detail: 'Boolean' },
    ],
  };
}

/**
 * 导出语言定义和高亮配置
 */
export { httpHighlighting };
