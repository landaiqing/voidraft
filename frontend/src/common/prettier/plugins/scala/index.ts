import { createScalaPrinter } from "./printer";
import { parse, type ScalaCstNode, type IToken } from "./scala-parser";
import { type Plugin, type SupportOption } from "prettier";

/**
 * Prettierがサポートする言語の定義
 */
const languages = [
  {
    name: "Scala",
    parsers: ["scala"],
    extensions: [".scala", ".sc"],
    vscodeLanguageIds: ["scala"],
  },
];

/**
 * Scalaパーサーの定義
 */
const parsers = {
  scala: {
    parse: (text: string) => {
      const result = parse(text);

      // シンプルなコメント保持: ASTに格納してvisitorで処理
      const ast = {
        ...result.cst,
        comments: [], // Prettierの検証を回避
        originalComments: result.comments || [], // プラグイン独自のコメント格納
        type: "compilationUnit",
      };
      return ast;
    },
    astFormat: "scala-cst",
    locStart: (node: ScalaCstNode | IToken) => {
      // Handle comment tokens (from Chevrotain lexer)
      if ("startOffset" in node && node.startOffset !== undefined) {
        return node.startOffset;
      }
      // Handle CST nodes
      if ("location" in node && node.location?.startOffset !== undefined) {
        return node.location.startOffset;
      }
      return 0;
    },
    locEnd: (node: ScalaCstNode | IToken) => {
      // Handle comment tokens (from Chevrotain lexer)
      if ("endOffset" in node && node.endOffset !== undefined) {
        return node.endOffset + 1; // Chevrotain endOffset is inclusive, Prettier expects exclusive
      }
      // Handle CST nodes
      if ("location" in node && node.location?.endOffset !== undefined) {
        return node.location.endOffset + 1; // Chevrotain endOffset is inclusive, Prettier expects exclusive
      }
      return 1;
    },
    hasPragma: () => false,
  },
};

/**
 * プリンターの定義
 */
const printers = {
  "scala-cst": createScalaPrinter(),
};

/**
 * プラグインオプション（scalafmt互換性 - フェーズ1）
 */
const options: Record<string, SupportOption> = {
  // Prettier standard options with Scala-specific defaults
  semi: {
    type: "boolean",
    default: false, // Scala convention: omit semicolons
    description: "Add semicolons at the end of statements",
    category: "Global",
  } as const,

  // Deprecated options (backward compatibility)
  scalaLineWidth: {
    type: "int",
    default: 80,
    description: "Maximum line width (DEPRECATED: use printWidth instead)",
    category: "Scala",
  } as const,
  scalaIndentStyle: {
    type: "choice",
    default: "spaces",
    choices: [
      { value: "spaces", description: "Use spaces for indentation" },
      { value: "tabs", description: "Use tabs for indentation" },
    ],
    description: "Indentation style (DEPRECATED: use useTabs instead)",
    category: "Scala",
  } as const,
};

/**
 * Prettierプラグインのエクスポート
 */
const plugin: Plugin = {
  languages,
  parsers,
  printers,
  options,
};

export default plugin;
