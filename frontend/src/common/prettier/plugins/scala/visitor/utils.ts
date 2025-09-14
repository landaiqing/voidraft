import type { ScalaCstNode, IToken } from "../scala-parser";

/**
 * ビジターパターンで使用する共有ユーティリティとフォーマットヘルパー
 */

export interface PrettierOptions {
  printWidth?: number;
  tabWidth?: number;
  useTabs?: boolean;
  semi?: boolean;
  singleQuote?: boolean;
  trailingComma?: "all" | "multiline" | "none";
  scalaLineWidth?: number; // Deprecated, for backward compatibility
}

// CST要素（ノードまたはトークン）のユニオン型
export type CSTNode = ScalaCstNode | IToken;

export type PrintContext = {
  path: unknown;
  options: PrettierOptions;
  print: (node: CSTNode) => string;
  indentLevel: number;
};

/**
 * nullチェック付きでノードの子要素に安全にアクセス
 * @param node - 対象ノード
 * @returns 子要素のマップ
 */
export function getChildren(node: CSTNode): Record<string, CSTNode[]> {
  if ("children" in node && node.children) {
    return node.children as Record<string, CSTNode[]>;
  }
  return {};
}

/**
 * キーで指定した子ノードを安全に取得
 * @param node - 対象ノード
 * @param key - 子ノードのキー
 * @returns 子ノードの配列
 */
export function getChildNodes(node: CSTNode, key: string): CSTNode[] {
  return getChildren(node)[key] || [];
}

/**
 * キーで指定した最初の子ノードを安全に取得
 * @param node - 対象ノード
 * @param key - 子ノードのキー
 * @returns 最初の子ノードまたはundefined
 */
export function getFirstChild(node: CSTNode, key: string): CSTNode | undefined {
  const children = getChildNodes(node, key);
  return children.length > 0 ? children[0] : undefined;
}

/**
 * ノードのimageプロパティを安全に取得
 * @param node - 対象ノード
 * @returns imageプロパティまたは空文字列
 */
export function getNodeImage(node: CSTNode): string {
  if ("image" in node && node.image) {
    return node.image;
  }
  return "";
}

/**
 * nullまたはundefinedの可能性があるノードのimageを安全に取得
 * @param node - 対象ノード（null/undefined可）
 * @returns imageプロパティまたは空文字列
 */
export function getNodeImageSafe(node: CSTNode | undefined | null): string {
  if (node && "image" in node && node.image) {
    return node.image;
  }
  return "";
}

/**
 * 有効なprintWidthを取得（scalafmt互換性をサポート）
 * @param ctx - 印刷コンテキスト
 * @returns 有効な行幅
 */
export function getPrintWidth(ctx: PrintContext): number {
  // PrettierのprintWidthを使用（scalafmtのmaxColumn互換）
  if (ctx.options.printWidth) {
    return ctx.options.printWidth;
  }

  // 後方互換性のため非推奨のscalaLineWidthにフォールバック
  if (ctx.options.scalaLineWidth) {
    // 開発環境で非推奨警告を表示
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "scalaLineWidth is deprecated. Use printWidth instead for scalafmt compatibility.",
      );
    }
    return ctx.options.scalaLineWidth;
  }

  // デフォルト値
  return 80;
}

/**
 * 有効なtabWidthを取得（scalafmt互換性をサポート）
 * @param ctx - 印刷コンテキスト
 * @returns 有効なタブ幅
 */
export function getTabWidth(ctx: PrintContext): number {
  // PrettierのtabWidthを使用（scalafmtのindent.main互換）
  if (ctx.options.tabWidth) {
    return ctx.options.tabWidth;
  }

  // デフォルト値
  return 2;
}

/**
 * セミコロンのフォーマットを処理（Prettierのsemiオプションをサポート）
 * @param statement - ステートメント文字列
 * @param ctx - 印刷コンテキスト
 * @returns フォーマット済みのステートメント
 */
export function formatStatement(statement: string, ctx: PrintContext): string {
  // Prettierのsemiオプションを使用
  // プラグインはScala用にデフォルトsemi=falseを設定するが、明示的なユーザー選択を尊重
  const useSemi = ctx.options.semi === true;

  // 既存の末尾セミコロンを削除
  const cleanStatement = statement.replace(/;\s*$/, "");

  // リクエストされた場合セミコロンを追加
  if (useSemi) {
    return cleanStatement + ";";
  }

  return cleanStatement;
}

/**
 * 文字列クォートのフォーマットを処理（PrettierのsingleQuoteオプションをサポート）
 * @param content - 文字列リテラルの内容
 * @param ctx - 印刷コンテキスト
 * @returns フォーマット済みの文字列
 */
export function formatStringLiteral(
  content: string,
  ctx: PrintContext,
): string {
  // PrettierのsingleQuoteオプションを使用
  const useSingleQuote = ctx.options.singleQuote === true;

  // 文字列補間をスキップ（s"、f"、raw"などで始まる）
  if (content.match(/^[a-zA-Z]"/)) {
    return content; // 補間文字列は変更しない
  }

  // 内容を抽出
  let innerContent = content;

  if (content.startsWith('"') && content.endsWith('"')) {
    innerContent = content.slice(1, -1);
  } else if (content.startsWith("'") && content.endsWith("'")) {
    innerContent = content.slice(1, -1);
  } else {
    return content; // Not a string literal
  }

  // Choose target quote based on option
  const targetQuote = useSingleQuote ? "'" : '"';

  // Handle escaping if necessary
  if (targetQuote === "'") {
    // Converting to single quotes: escape single quotes, unescape double quotes
    innerContent = innerContent.replace(/\\"/g, '"').replace(/'/g, "\\'");
  } else {
    // Converting to double quotes: escape double quotes, unescape single quotes
    innerContent = innerContent.replace(/\\'/g, "'").replace(/"/g, '\\"');
  }

  return targetQuote + innerContent + targetQuote;
}

/**
 * Helper method to handle indentation using configured tab width
 */
export function createIndent(level: number, ctx: PrintContext): string {
  const tabWidth = getTabWidth(ctx);
  const useTabs = ctx.options.useTabs === true;

  if (useTabs) {
    return "\t".repeat(level);
  } else {
    return " ".repeat(level * tabWidth);
  }
}

/**
 * Helper method to handle trailing comma formatting
 */
export function formatTrailingComma(
  elements: string[],
  ctx: PrintContext,
  isMultiline: boolean = false,
): string {
  if (elements.length === 0) return "";

  const trailingComma = ctx.options.trailingComma;

  if (
    trailingComma === "all" ||
    (trailingComma === "multiline" && isMultiline)
  ) {
    return elements.join(", ") + ",";
  }

  return elements.join(", ");
}

/**
 * Attach original comments to the formatted result
 */
export function attachOriginalComments(
  result: string,
  originalComments: CSTNode[],
): string {
  if (!originalComments || originalComments.length === 0) {
    return result;
  }

  const lines = result.split("\n");
  const commentMap = new Map<number, string[]>();

  // Group comments by line number
  originalComments.forEach((comment) => {
    const line = ("startLine" in comment && comment.startLine) || 1;
    if (!commentMap.has(line)) {
      commentMap.set(line, []);
    }
    let commentText = "";
    if ("image" in comment && comment.image) {
      commentText = comment.image;
    } else if ("value" in comment && comment.value) {
      commentText = String(comment.value);
    }
    if (commentText) {
      commentMap.get(line)!.push(commentText);
    }
  });

  // Insert comments into lines
  const resultLines: string[] = [];
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (commentMap.has(lineNumber)) {
      const comments = commentMap.get(lineNumber)!;
      comments.forEach((comment) => {
        resultLines.push(comment);
      });
    }
    resultLines.push(line);
  });

  return resultLines.join("\n");
}

/**
 * Format method or class parameters with proper line breaks
 */
export function formatParameterList(
  parameters: CSTNode[],
  ctx: PrintContext,
  visitFn: (param: CSTNode, ctx: PrintContext) => string,
): string {
  if (parameters.length === 0) return "";

  const paramStrings = parameters.map((param) => visitFn(param, ctx));
  const printWidth = getPrintWidth(ctx);
  const joined = paramStrings.join(", ");

  // If the line is too long, break into multiple lines
  if (joined.length > printWidth * 0.7) {
    const indent = createIndent(1, ctx);
    return "\n" + indent + paramStrings.join(",\n" + indent) + "\n";
  }

  return joined;
}
