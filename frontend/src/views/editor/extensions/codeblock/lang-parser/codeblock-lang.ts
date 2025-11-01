/**
 * 代码块语言支持
 * 提供多语言代码块支持
 */

import { parser } from "./parser";
import { configureNesting } from "./nested-parser";

import {
  LRLanguage,
  LanguageSupport,
  foldNodeProp,
} from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";

import { json } from "@codemirror/lang-json";

/**
 * 折叠节点函数
 */
function foldNode(node: any) {
  return { from: node.from, to: node.to - 1 };
}

/**
 * 代码块语言定义
 */
export const CodeBlockLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [
      styleTags({
        BlockDelimiter: t.tagName,
      }),

      foldNodeProp.add({
        BlockContent(node: any) {
          return { from: node.from, to: node.to - 1 };
        },
      }),
    ],
    wrap: configureNesting(),
  }),
  languageData: {
    commentTokens: { line: ";" }
  }
});

/**
 * 创建代码块语言支持
 */
export function codeBlockLang() {
  const wrap = configureNesting();
  const lang = CodeBlockLanguage.configure({ dialect: "", wrap: wrap });
  
  return [
    new LanguageSupport(lang, [json().support]),
  ];
}

/**
 * 获取代码块语言扩展
 */
export function getCodeBlockLanguageExtension() {
  return codeBlockLang();
} 