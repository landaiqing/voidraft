/**
 * 语言映射和解析器配置
 */

import { jsonLanguage } from "@codemirror/lang-json";
import { pythonLanguage } from "@codemirror/lang-python";
import { javascriptLanguage, typescriptLanguage } from "@codemirror/lang-javascript";
import { htmlLanguage } from "@codemirror/lang-html";
import { StandardSQL } from "@codemirror/lang-sql";
import { markdownLanguage } from "@codemirror/lang-markdown";
import { javaLanguage } from "@codemirror/lang-java";
import { phpLanguage } from "@codemirror/lang-php";
import { cssLanguage } from "@codemirror/lang-css";
import { cppLanguage } from "@codemirror/lang-cpp";
import { xmlLanguage } from "@codemirror/lang-xml";
import { rustLanguage } from "@codemirror/lang-rust";

import { StreamLanguage } from "@codemirror/language";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { go } from "@codemirror/legacy-modes/mode/go";
import { yamlLanguage } from "@codemirror/lang-yaml";

import { SupportedLanguage } from '../types';

/**
 * 语言信息类
 */
export class LanguageInfo {
  constructor(
    public token: SupportedLanguage,
    public name: string,
    public parser: any,
    public guesslang?: string | null
  ) {}
}

/**
 * 支持的语言列表
 */
export const LANGUAGES: LanguageInfo[] = [
  new LanguageInfo("text", "Plain Text", null),
  new LanguageInfo("json", "JSON", jsonLanguage.parser, "json"),
  new LanguageInfo("python", "Python", pythonLanguage.parser, "py"),
  new LanguageInfo("javascript", "JavaScript", javascriptLanguage.parser, "js"),
  new LanguageInfo("typescript", "TypeScript", typescriptLanguage.parser, "ts"),
  new LanguageInfo("html", "HTML", htmlLanguage.parser, "html"),
  new LanguageInfo("css", "CSS", cssLanguage.parser, "css"),
  new LanguageInfo("sql", "SQL", StandardSQL.language.parser, "sql"),
  new LanguageInfo("markdown", "Markdown", markdownLanguage.parser, "md"),
  new LanguageInfo("java", "Java", javaLanguage.parser, "java"),
  new LanguageInfo("php", "PHP", phpLanguage.configure({top:"Program"}).parser, "php"),
  new LanguageInfo("xml", "XML", xmlLanguage.parser, "xml"),
  new LanguageInfo("cpp", "C++", cppLanguage.parser, "cpp"),
  new LanguageInfo("c", "C", cppLanguage.parser, "c"),
  new LanguageInfo("rust", "Rust", rustLanguage.parser, "rs"),
  new LanguageInfo("ruby", "Ruby", StreamLanguage.define(ruby).parser, "rb"),
  new LanguageInfo("shell", "Shell", StreamLanguage.define(shell).parser, "sh"),
  new LanguageInfo("yaml", "YAML", yamlLanguage.parser, "yaml"),
  new LanguageInfo("go", "Go", StreamLanguage.define(go).parser, "go"),
];

/**
 * 语言映射表
 */
export const languageMapping = Object.fromEntries(
  LANGUAGES.map(l => [l.token, l.parser])
);

/**
 * 根据 token 获取语言信息
 */
export function getLanguage(token: SupportedLanguage): LanguageInfo | undefined {
  return LANGUAGES.find(lang => lang.token === token);
}

/**
 * 获取所有语言的 token 列表
 */
export function getLanguageTokens(): SupportedLanguage[] {
  return LANGUAGES.map(lang => lang.token);
} 