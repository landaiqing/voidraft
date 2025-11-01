import { LRLanguage, LanguageSupport, foldNodeProp, foldInside, indentNodeProp } from '@codemirror/language';
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
 */
export function http() {
  return new LanguageSupport(httpLanguage);
}
