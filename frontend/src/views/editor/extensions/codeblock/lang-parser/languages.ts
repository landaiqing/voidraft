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
import { yamlLanguage } from "@codemirror/lang-yaml";

import { StreamLanguage } from "@codemirror/language";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { go } from "@codemirror/legacy-modes/mode/go";
import { csharp } from "@codemirror/legacy-modes/mode/clike";
import { clojure } from "@codemirror/legacy-modes/mode/clojure";
import { erlang } from "@codemirror/legacy-modes/mode/erlang";
import { swift } from "@codemirror/legacy-modes/mode/swift";
import { kotlin } from "@codemirror/legacy-modes/mode/clike";
import { groovy } from "@codemirror/legacy-modes/mode/groovy";
import { powerShell } from "@codemirror/legacy-modes/mode/powershell";
import { scala } from "@codemirror/legacy-modes/mode/clike";
import { toml } from "@codemirror/legacy-modes/mode/toml";

import { SupportedLanguage } from '../types';

/**
 * 语言信息类
 */
export class LanguageInfo {
  constructor(
    public token: SupportedLanguage,
    public name: string,
    public parser: any
  ) {}
}

/**
 * 支持的语言列表（与 Worker 中的 LANGUAGES 对应）
 */
export const LANGUAGES: LanguageInfo[] = [
  new LanguageInfo("text", "Plain Text", null),
  new LanguageInfo("json", "JSON", jsonLanguage.parser),
  new LanguageInfo("py", "Python", pythonLanguage.parser),
  new LanguageInfo("html", "HTML", htmlLanguage.parser),
  new LanguageInfo("sql", "SQL", StandardSQL.language.parser),
  new LanguageInfo("md", "Markdown", markdownLanguage.parser),
  new LanguageInfo("java", "Java", javaLanguage.parser),
  new LanguageInfo("php", "PHP", phpLanguage.configure({top:"Program"}).parser),
  new LanguageInfo("css", "CSS", cssLanguage.parser),
  new LanguageInfo("xml", "XML", xmlLanguage.parser),
  new LanguageInfo("cpp", "C++", cppLanguage.parser),
  new LanguageInfo("rs", "Rust", rustLanguage.parser),
  new LanguageInfo("cs", "C#", StreamLanguage.define(csharp).parser),
  new LanguageInfo("rb", "Ruby", StreamLanguage.define(ruby).parser),
  new LanguageInfo("sh", "Shell", StreamLanguage.define(shell).parser),
  new LanguageInfo("yaml", "YAML", yamlLanguage.parser),
  new LanguageInfo("toml", "TOML", StreamLanguage.define(toml).parser),
  new LanguageInfo("go", "Go", StreamLanguage.define(go).parser),
  new LanguageInfo("clj", "Clojure", StreamLanguage.define(clojure).parser),
  new LanguageInfo("ex", "Elixir", null), // 暂无解析器
  new LanguageInfo("erl", "Erlang", StreamLanguage.define(erlang).parser),
  new LanguageInfo("js", "JavaScript", javascriptLanguage.parser),
  new LanguageInfo("ts", "TypeScript", typescriptLanguage.parser),
  new LanguageInfo("swift", "Swift", StreamLanguage.define(swift).parser),
  new LanguageInfo("kt", "Kotlin", StreamLanguage.define(kotlin).parser),
  new LanguageInfo("groovy", "Groovy", StreamLanguage.define(groovy).parser),
  new LanguageInfo("ps1", "PowerShell", StreamLanguage.define(powerShell).parser),
  new LanguageInfo("dart", "Dart", null), // 暂无解析器
  new LanguageInfo("scala", "Scala", StreamLanguage.define(scala).parser),
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