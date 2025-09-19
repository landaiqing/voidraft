/**
 * 语言映射和解析器配置
 */

import {jsonLanguage} from "@codemirror/lang-json";
import {pythonLanguage} from "@codemirror/lang-python";
import {javascriptLanguage, typescriptLanguage} from "@codemirror/lang-javascript";
import {htmlLanguage} from "@codemirror/lang-html";
import {StandardSQL} from "@codemirror/lang-sql";
import {markdownLanguage} from "@codemirror/lang-markdown";
import {javaLanguage} from "@codemirror/lang-java";
import {phpLanguage} from "@codemirror/lang-php";
import {cssLanguage} from "@codemirror/lang-css";
import {cppLanguage} from "@codemirror/lang-cpp";
import {xmlLanguage} from "@codemirror/lang-xml";
import {rustLanguage} from "@codemirror/lang-rust";
import {yamlLanguage} from "@codemirror/lang-yaml";

import {StreamLanguage} from "@codemirror/language";
import {ruby} from "@codemirror/legacy-modes/mode/ruby";
import {shell} from "@codemirror/legacy-modes/mode/shell";
import {go} from "@codemirror/legacy-modes/mode/go";
import {csharp, kotlin, scala} from "@codemirror/legacy-modes/mode/clike";
import {clojure} from "@codemirror/legacy-modes/mode/clojure";
import {erlang} from "@codemirror/legacy-modes/mode/erlang";
import {swift} from "@codemirror/legacy-modes/mode/swift";
import {groovy} from "@codemirror/legacy-modes/mode/groovy";
import {powerShell} from "@codemirror/legacy-modes/mode/powershell";
import {toml} from "@codemirror/legacy-modes/mode/toml";
import {elixir} from "codemirror-lang-elixir";
import {SupportedLanguage} from '../types';

import typescriptPlugin from "prettier/plugins/typescript"
import babelPrettierPlugin from "prettier/plugins/babel"
import htmlPrettierPlugin from "prettier/plugins/html"
import cssPrettierPlugin from "prettier/plugins/postcss"
import markdownPrettierPlugin from "prettier/plugins/markdown"
import yamlPrettierPlugin from "prettier/plugins/yaml"
import goPrettierPlugin from "@/common/prettier/plugins/go/go.mjs"
import sqlPrettierPlugin from "@/common/prettier/plugins/sql/sql"
import phpPrettierPlugin from "@/common/prettier/plugins/php"
import javaPrettierPlugin from "@/common/prettier/plugins/java"
import xmlPrettierPlugin from "@prettier/plugin-xml"
import * as rustPrettierPlugin from "@/common/prettier/plugins/rust";
import * as shellPrettierPlugin from "@/common/prettier/plugins/shell";
import tomlPrettierPlugin from "@/common/prettier/plugins/toml";
import clojurePrettierPlugin from "@cospaia/prettier-plugin-clojure";
import groovyPrettierPlugin from "@/common/prettier/plugins/groovy";
import scalaPrettierPlugin from "@/common/prettier/plugins/scala";
import clangPrettierPlugin from "@/common/prettier/plugins/clang";
import * as prettierPluginEstree from "prettier/plugins/estree";

/**
 * 语言信息类
 */
export class LanguageInfo {
    constructor(
        public token: SupportedLanguage,
        public name: string,
        public parser: any,
        public prettier?: {
            parser: string;
            plugins: any[];
        }) {
    }
}

/**
 * 支持的语言列表（与 Worker 中的 LANGUAGES 对应）
 */
export const LANGUAGES: LanguageInfo[] = [
    new LanguageInfo("text", "Plain Text", null),
    new LanguageInfo("json", "JSON", jsonLanguage.parser, {
        parser: "json",
        plugins: [babelPrettierPlugin, prettierPluginEstree]
    }),
    new LanguageInfo("py", "Python", pythonLanguage.parser),
    new LanguageInfo("html", "HTML", htmlLanguage.parser, {
        parser: "html",
        plugins: [htmlPrettierPlugin]
    }),
    new LanguageInfo("sql", "SQL", StandardSQL.language.parser, {
        parser: "sql",
        plugins: [sqlPrettierPlugin]
    }),
    new LanguageInfo("md", "Markdown", markdownLanguage.parser, {
        parser: "markdown",
        plugins: [markdownPrettierPlugin]
    }),
    new LanguageInfo("java", "Java", javaLanguage.parser,{
        parser: "java",
        plugins: [javaPrettierPlugin]
    }),
    new LanguageInfo("php", "PHP", phpLanguage.configure({top: "Program"}).parser, {
        parser: "php",
        plugins: [phpPrettierPlugin]
    }),
    new LanguageInfo("css", "CSS", cssLanguage.parser, {
        parser: "css",
        plugins: [cssPrettierPlugin]
    }),
    new LanguageInfo("xml", "XML", xmlLanguage.parser,{
        parser: "xml",
        plugins: [xmlPrettierPlugin]
    }),
    new LanguageInfo("cpp", "C++", cppLanguage.parser,{
        parser: "clang",
        plugins: [clangPrettierPlugin]
    }),
    new LanguageInfo("rs", "Rust", rustLanguage.parser,{
        parser: "jinx-rust",
        plugins: [rustPrettierPlugin]
    }),
    new LanguageInfo("cs", "C#", StreamLanguage.define(csharp).parser),
    new LanguageInfo("rb", "Ruby", StreamLanguage.define(ruby).parser),
    new LanguageInfo("sh", "Shell", StreamLanguage.define(shell).parser,{
        parser: "sh",
        plugins: [shellPrettierPlugin]
    }),
    new LanguageInfo("yaml", "YAML", yamlLanguage.parser, {
        parser: "yaml",
        plugins: [yamlPrettierPlugin]
    }),
    new LanguageInfo("toml", "TOML", StreamLanguage.define(toml).parser,{
        parser: "toml",
        plugins: [tomlPrettierPlugin]
    }),
    new LanguageInfo("go", "Go", StreamLanguage.define(go).parser, {
        parser: "go-format",
        plugins: [goPrettierPlugin]
    }),
    new LanguageInfo("clj", "Clojure", StreamLanguage.define(clojure).parser,{
        parser: "clojure",
        plugins: [clojurePrettierPlugin]
    }),
    new LanguageInfo("ex", "Elixir", elixir().language.parser),
    new LanguageInfo("erl", "Erlang", StreamLanguage.define(erlang).parser),
    new LanguageInfo("js", "JavaScript", javascriptLanguage.parser, {
        parser: "babel",
        plugins: [babelPrettierPlugin, prettierPluginEstree]
    }),
    new LanguageInfo("ts", "TypeScript", typescriptLanguage.parser, {
        parser: "typescript",
        plugins: [typescriptPlugin, prettierPluginEstree]
    }),
    new LanguageInfo("swift", "Swift", StreamLanguage.define(swift).parser),
    new LanguageInfo("kt", "Kotlin", StreamLanguage.define(kotlin).parser),
    new LanguageInfo("groovy", "Groovy", StreamLanguage.define(groovy).parser,{
        parser: "groovy",
        plugins: [groovyPrettierPlugin]
    }),
    new LanguageInfo("ps1", "PowerShell", StreamLanguage.define(powerShell).parser),
    new LanguageInfo("dart", "Dart", null), // 暂无解析器
    new LanguageInfo("scala", "Scala", StreamLanguage.define(scala).parser,{
        parser: "scala",
        plugins: [scalaPrettierPlugin]
    }),
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