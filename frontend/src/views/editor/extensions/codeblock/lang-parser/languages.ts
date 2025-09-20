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
import {dockerFile} from "@codemirror/legacy-modes/mode/dockerfile";
import {lua} from "@codemirror/legacy-modes/mode/lua";
import {SupportedLanguage} from '../types';

import typescriptPlugin from "prettier/plugins/typescript"
import babelPrettierPlugin from "prettier/plugins/babel"
import htmlPrettierPlugin from "prettier/plugins/html"
import cssPrettierPlugin from "prettier/plugins/postcss"
import markdownPrettierPlugin from "prettier/plugins/markdown"
import yamlPrettierPlugin from "prettier/plugins/yaml"
import goPrettierPlugin from "@/common/prettier/plugins/go/go.mjs"
import sqlPrettierPlugin from "@/common/prettier/plugins/sql"
import phpPrettierPlugin from "@/common/prettier/plugins/php"
import javaPrettierPlugin from "@/common/prettier/plugins/java"
import xmlPrettierPlugin from "@prettier/plugin-xml"
import * as rustPrettierPlugin from "@/common/prettier/plugins/rust";
import * as shellPrettierPlugin from "@/common/prettier/plugins/shell";
import * as dockerfilePrettierPlugin from "@/common/prettier/plugins/shell";
// import rustPrettierPlugin from "@/common/prettier/plugins/rust_fmt";
import tomlPrettierPlugin from "@/common/prettier/plugins/toml";
import clojurePrettierPlugin from "@cospaia/prettier-plugin-clojure";
import groovyPrettierPlugin from "@/common/prettier/plugins/groovy";
import scalaPrettierPlugin from "@/common/prettier/plugins/scala";
import clangPrettierPlugin from "@/common/prettier/plugins/clang";
import pythonPrettierPlugin from "@/common/prettier/plugins/python";
import dartPrettierPlugin from "@/common/prettier/plugins/dart";
import luaPrettierPlugin from "@/common/prettier/plugins/lua";
import * as prettierPluginEstree from "prettier/plugins/estree";

/**
 * 语言信息类
 */
export class LanguageInfo {
    constructor(
        public token: SupportedLanguage,
        public name: string,
        public parser: any,
        public detectIds?: string[],
        public prettier?: {
            parser: string;
            plugins: any[];
            options?: Record<string, any>; // 添加自定义配置选项
        }) {
    }
}

/**
 * 支持的语言列表（与 Worker 中的 LANGUAGES 对应）
 */
export const LANGUAGES: LanguageInfo[] = [
    new LanguageInfo("text", "Plain Text", null),
    new LanguageInfo("json", "JSON", jsonLanguage.parser, ["json"], {
        parser: "json",
        plugins: [babelPrettierPlugin, prettierPluginEstree]
    }),
    new LanguageInfo("py", "Python", pythonLanguage.parser, ["py"], {
        parser: "python",
        plugins: [pythonPrettierPlugin]
    }),
    new LanguageInfo("html", "HTML", htmlLanguage.parser, ["html"], {
        parser: "html",
        plugins: [htmlPrettierPlugin]
    }),
    new LanguageInfo("sql", "SQL", StandardSQL.language.parser, ["sql"], {
        parser: "sql",
        plugins: [sqlPrettierPlugin]
    }),
    new LanguageInfo("md", "Markdown", markdownLanguage.parser, ["md"], {
        parser: "markdown",
        plugins: [markdownPrettierPlugin]
    }),
    new LanguageInfo("java", "Java", javaLanguage.parser, ["java"], {
        parser: "java",
        plugins: [javaPrettierPlugin]
    }),
    new LanguageInfo("php", "PHP", phpLanguage.configure({top: "Program"}).parser, ["php"], {
        parser: "php",
        plugins: [phpPrettierPlugin]
    }),
    new LanguageInfo("css", "CSS", cssLanguage.parser, ["css"], {
        parser: "css",
        plugins: [cssPrettierPlugin]
    }),
    new LanguageInfo("xml", "XML", xmlLanguage.parser, ["xml"], {
        parser: "xml",
        plugins: [xmlPrettierPlugin]
    }),
    new LanguageInfo("cpp", "C++", cppLanguage.parser, ["cpp", "c"], {
        parser: "clang-format",
        plugins: [clangPrettierPlugin],
        options: {
            filename: "index.cpp"
        }
    }),
    new LanguageInfo("rs", "Rust", rustLanguage.parser, ["rs"], {
        parser: "rust",
        plugins: [rustPrettierPlugin]
    }),
    new LanguageInfo("cs", "C#", StreamLanguage.define(csharp).parser, ["cs"],{
        parser: "clang-format",
        plugins: [clangPrettierPlugin],
        options: {
            filename: "index.cs"
        }
    }),
    new LanguageInfo("rb", "Ruby", StreamLanguage.define(ruby).parser, ["rb"]),
    new LanguageInfo("sh", "Shell", StreamLanguage.define(shell).parser, ["sh", "bat"], {
        parser: "sh",
        plugins: [shellPrettierPlugin]
    }),
    new LanguageInfo("yaml", "YAML", yamlLanguage.parser, ["yaml"], {
        parser: "yaml",
        plugins: [yamlPrettierPlugin]
    }),
    new LanguageInfo("toml", "TOML", StreamLanguage.define(toml).parser, ["toml"], {
        parser: "toml",
        plugins: [tomlPrettierPlugin]
    }),
    new LanguageInfo("go", "Go", StreamLanguage.define(go).parser, ["go"], {
        parser: "go-format",
        plugins: [goPrettierPlugin]
    }),
    new LanguageInfo("clj", "Clojure", StreamLanguage.define(clojure).parser, ["clj"], {
        parser: "clojure",
        plugins: [clojurePrettierPlugin]
    }),
    new LanguageInfo("ex", "Elixir", elixir().language.parser, ["ex"]),
    new LanguageInfo("erl", "Erlang", StreamLanguage.define(erlang).parser, ["erl"]),
    new LanguageInfo("js", "JavaScript", javascriptLanguage.parser, ["js"], {
        parser: "babel",
        plugins: [babelPrettierPlugin, prettierPluginEstree]
    }),
    new LanguageInfo("ts", "TypeScript", typescriptLanguage.parser, ["ts", "js"], {
        parser: "typescript",
        plugins: [typescriptPlugin, prettierPluginEstree]
    }),
    new LanguageInfo("swift", "Swift", StreamLanguage.define(swift).parser, ["swift"]),
    new LanguageInfo("kt", "Kotlin", StreamLanguage.define(kotlin).parser, ["kt"]),
    new LanguageInfo("groovy", "Groovy", StreamLanguage.define(groovy).parser, ["groovy"], {
        parser: "groovy",
        plugins: [groovyPrettierPlugin]
    }),
    new LanguageInfo("ps1", "PowerShell", StreamLanguage.define(powerShell).parser, ["ps1"]),
    new LanguageInfo("dart", "Dart", null, ["dart"], {
        parser: "dart",
        plugins: [dartPrettierPlugin]
    }),
    new LanguageInfo("scala", "Scala", StreamLanguage.define(scala).parser, ["scala"], {
        parser: "scala",
        plugins: [scalaPrettierPlugin]
    }),
    new LanguageInfo("dockerfile", "Dockerfile", StreamLanguage.define(dockerFile).parser, ["dockerfile"], {
        parser: "dockerfile",
        plugins: [dockerfilePrettierPlugin]
    }),
    new LanguageInfo("lua", "Lua", StreamLanguage.define(lua).parser, ["lua"], {
        parser: "lua",
        plugins: [luaPrettierPlugin]
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
 * 获取完整的支持语言列表（包括 'auto'）
 */
export function getAllSupportedLanguages(): SupportedLanguage[] {
    return ['auto', ...LANGUAGES.map(lang => lang.token)];
}