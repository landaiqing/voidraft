import { ScalaLexer } from "./lexer";
import { parserInstance } from "./parser";
import type {
  ParseResult,
  ScalaCstNode,
  TokenBounds,
  LineColumn,
} from "./types";
import type { IToken, CstElement } from "chevrotain";

export { ScalaLexer, allTokens } from "./lexer";
export { ScalaParser, parserInstance } from "./parser";
export type {
  ParseResult,
  ScalaCstNode,
  TokenBounds,
  LineColumn,
} from "./types";
export type { IToken } from "chevrotain";

/**
 * CSTノードに位置情報を自動設定するヘルパー関数
 * @param cst - 処理対象のCSTノード
 * @param tokens - 解析で使用されたトークンの配列
 * @param text - 元のソースコードテキスト
 * @returns 位置情報が付与されたCSTノード
 */
function addLocationToCST(
  cst: ScalaCstNode,
  tokens: IToken[],
  text: string,
): ScalaCstNode {
  if (!cst || !tokens) return cst;

  // テキストから行の開始位置を計算
  const lineStarts = [0]; // 最初の行は0から始まる
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") {
      lineStarts.push(i + 1);
    }
  }

  // オフセットから行番号と列番号を取得
  function getLineAndColumn(offset: number): LineColumn {
    let line = 1;
    for (let i = 0; i < lineStarts.length - 1; i++) {
      if (offset >= lineStarts[i] && offset < lineStarts[i + 1]) {
        line = i + 1;
        break;
      }
    }
    if (offset >= lineStarts[lineStarts.length - 1]) {
      line = lineStarts.length;
    }

    const column = offset - lineStarts[line - 1] + 1;
    return { line, column };
  }

  // トークンから最小・最大位置を計算
  function findTokenBounds(node: ScalaCstNode): TokenBounds | null {
    if (!node) return null;

    let minStart = Infinity;
    let maxEnd = -1;

    function findTokensInNode(n: ScalaCstNode | IToken): void {
      if (!n) return;

      // トークンの場合
      if (
        "startOffset" in n &&
        "endOffset" in n &&
        n.startOffset !== undefined &&
        n.endOffset !== undefined
      ) {
        minStart = Math.min(minStart, n.startOffset);
        maxEnd = Math.max(maxEnd, n.endOffset);
        return;
      }

      // CSTノードの場合
      if ("children" in n && n.children) {
        for (const children of Object.values(n.children)) {
          if (Array.isArray(children)) {
            children.forEach((child) => {
              // CstElementをScalaCstNode | ITokenに安全に変換
              if ("children" in child) {
                findTokensInNode(child as ScalaCstNode);
              } else {
                findTokensInNode(child as IToken);
              }
            });
          }
        }
      }
    }

    findTokensInNode(node);

    if (minStart === Infinity || maxEnd === -1) {
      return null;
    }

    return { start: minStart, end: maxEnd };
  }

  // 再帰的にCSTノードに位置情報を設定
  function setCSTLocation(node: ScalaCstNode): ScalaCstNode {
    if (!node) return node;

    // トークンの場合はそのまま返す
    if (node.startOffset !== undefined) {
      return node;
    }

    // CSTノードの場合
    if (node.children) {
      // 子ノードを先に処理
      const processedChildren: Record<string, CstElement[]> = {};
      for (const [key, children] of Object.entries(node.children)) {
        if (Array.isArray(children)) {
          processedChildren[key] = children.map((child) => {
            if ("children" in child) {
              return setCSTLocation(child as ScalaCstNode);
            }
            return child; // IToken
          });
        }
      }

      // このノードの位置を計算
      const bounds = findTokenBounds({ ...node, children: processedChildren });

      if (bounds) {
        const startLoc = getLineAndColumn(bounds.start);
        const endLoc = getLineAndColumn(bounds.end);

        return {
          ...node,
          children: processedChildren,
          location: {
            startOffset: bounds.start,
            endOffset: bounds.end,
            startLine: startLoc.line,
            endLine: endLoc.line,
            startColumn: startLoc.column,
            endColumn: endLoc.column,
          },
        };
      } else {
        return {
          ...node,
          children: processedChildren,
        };
      }
    }

    return node;
  }

  return setCSTLocation(cst);
}

export function parse(text: string): ParseResult {
  // Use legacy parser for now until modular parser is fixed
  return parseLegacy(text);
}

// Legacy parser function (has left recursion issues)
export function parseLegacy(text: string): ParseResult {
  // Tokenize
  const lexResult = ScalaLexer.tokenize(text);

  if (lexResult.errors.length > 0) {
    throw new Error(
      `Lexing errors: ${lexResult.errors.map((e) => e.message).join(", ")}`,
    );
  }

  // Parse
  parserInstance.input = lexResult.tokens;
  const cst = parserInstance.compilationUnit();

  if (parserInstance.errors.length > 0) {
    throw new Error(
      `Parsing errors: ${parserInstance.errors.map((e) => e.message).join(", ")}`,
    );
  }

  // CSTに位置情報を追加
  const cstWithLocation = addLocationToCST(
    cst as ScalaCstNode,
    lexResult.tokens,
    text,
  );

  return {
    cst: cstWithLocation,
    errors: [],
    comments: lexResult.groups.comments || [],
  };
}

// Note: parseModular function was removed as the modular parser integration
// is still in development. Use the main parse() function instead.
