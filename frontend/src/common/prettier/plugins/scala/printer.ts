import { CstNodeVisitor, type CSTNode } from "./visitor";
import type { ScalaCstNode, IToken } from "./scala-parser";
import { type Doc, type Printer, type AstPath, type Options } from "prettier";

/**
 * Scala用のPrettierプリンターを作成
 * @returns Prettierプリンターオブジェクト
 */
export function createScalaPrinter(): Printer {
  return {
    /**
     * ASTノードをフォーマット済みのテキストに変換
     * @param path - 現在のノードへのパス
     * @param options - Prettierオプション
     * @param print - 子ノードを印刷するための関数
     * @returns フォーマット済みのDoc
     */
    print(
      path: AstPath<ScalaCstNode>,
      options: Options,
      print: (path: AstPath) => Doc,
    ): Doc {
      const node = path.getValue();

      const visitor = new CstNodeVisitor();
      const result = visitor.visit(node, {
        path,
        options: {
          printWidth: options.printWidth,
          tabWidth: options.tabWidth,
          useTabs: options.useTabs,
          semi: options.semi,
          singleQuote: options.singleQuote,
          trailingComma:
            options.trailingComma === "es5" ? "all" : options.trailingComma,
        },
        print: (childNode: CSTNode) => {
          // 子ノード用のモックパスを作成
          const mockPath = {
            getValue: () => childNode,
            call: (fn: () => unknown) => fn(),
          };
          return String(print(mockPath as AstPath<unknown>));
        },
        indentLevel: 0,
      });

      // 文字列結果をPrettierのDocに変換
      return result;
    },
    /**
     * コメントを印刷
     * @param path - コメントトークンへのパス
     * @returns フォーマット済みのコメント
     */
    printComment(path: AstPath<IToken>): Doc {
      const comment = path.getValue();
      if (!comment) return "";

      // Chevrotainのimageプロパティを使用
      if (typeof comment.image === "string") {
        return comment.image;
      }

      // fallback
      if (typeof comment.image === "string") {
        return comment.image;
      }

      // デバッグ: コメント構造を確認
      console.log("Unexpected comment structure in printComment:", comment);
      return "";
    },
    canAttachComment(): boolean {
      // コメント機能を一時的に無効化
      return false;
    },
    willPrintOwnComments(): boolean {
      return false; // Prettier標準のコメント処理を使用しない
    },
    insertPragma(text: string): string {
      return text;
    },
    hasPrettierIgnore(): boolean {
      return false;
    },
    isBlockComment(comment: IToken): boolean {
      return comment.tokenType?.name === "BlockComment";
    },
  };
}
