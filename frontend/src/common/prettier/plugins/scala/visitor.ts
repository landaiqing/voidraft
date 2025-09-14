/**
 * CSTノードビジターのメインモジュール
 * 各種ビジターモジュールを統合して使用
 */
import {
  DeclarationVisitorMethods,
  type DeclarationVisitor,
} from "./visitor/declarations";
import {
  ExpressionVisitorMethods,
  type ExpressionVisitor,
} from "./visitor/expressions";
import { Scala3VisitorMethods, type Scala3Visitor } from "./visitor/scala3";
import {
  StatementVisitorMethods,
  type StatementVisitor,
} from "./visitor/statements";
import { TypeVisitorMethods, type TypeVisitor } from "./visitor/types";
import {
  getPrintWidth,
  getTabWidth,
  formatStatement,
  formatStringLiteral,
  createIndent,
  attachOriginalComments,
} from "./visitor/utils";
import type { PrintContext, CSTNode } from "./visitor/utils";
import type { ScalaCstNode } from "@/common/prettier/plugins/scala/scala-parser";

// 外部使用のためのユーティリティ型の再エクスポート
export type { PrintContext, CSTNode, PrettierOptions } from "./visitor/utils";

// 後方互換性のための型エイリアス
type VisitorContext = PrintContext;

/**
 * CSTノードを訪問してフォーマット済みのテキストに変換するビジター
 * 各種言語構造に対応するビジターモジュールを統合
 */
export class CstNodeVisitor
  implements
    DeclarationVisitor,
    ExpressionVisitor,
    StatementVisitor,
    TypeVisitor,
    Scala3Visitor
{
  // ビジターモジュールの初期化
  private declarations = new DeclarationVisitorMethods(this);
  private expressions = new ExpressionVisitorMethods(this);
  private statements = new StatementVisitorMethods(this);
  private types = new TypeVisitorMethods(this);
  private scala3 = new Scala3VisitorMethods(this);

  /**
   * CSTノードを訪問してフォーマット済みテキストに変換
   * @param node - 訪問対象のCSTノード
   * @param ctx - 印刷コンテキスト（オプション、パスなど）
   * @returns フォーマット済みの文字列
   */
  visit(node: ScalaCstNode, ctx: PrintContext): string {
    if (!node) return "";

    try {
      // オリジナルコメントを含むルートノードの処理
      if (
        "type" in node &&
        node.type === "compilationUnit" &&
        "originalComments" in node &&
        node.originalComments
      ) {
        const nodeResult = this.visitCore(node, ctx);
        // originalCommentsの安全な型変換
        const comments = Array.isArray(node.originalComments)
          ? (node.originalComments as unknown as CSTNode[])
          : [];
        return attachOriginalComments(nodeResult, comments);
      }

      return this.visitCore(node, ctx);
    } catch (error) {
      const nodeName = "name" in node ? node.name : "unknown";
      console.error(`Error visiting node ${nodeName}:`, error);

      // フォーマットエラー時の安全なフォールバック
      if ("image" in node && node.image) {
        return String(node.image);
      }

      return `/* FORMAT ERROR: ${nodeName} */`;
    }
  }

  /**
   * CSTノード訪問のコアロジック
   * @param node - 訪問対象のCSTノード
   * @param ctx - 印刷コンテキスト
   * @returns フォーマット済みの文字列
   */
  private visitCore(node: CSTNode, ctx: PrintContext): string {
    try {
      // トークンノードの処理
      if ("image" in node && node.image !== undefined) {
        return node.image;
      }

      // ルール名によるCSTノードの処理
      if ("name" in node && node.name) {
        // ルール名の最初の文字を大文字化
        const ruleName = node.name.charAt(0).toUpperCase() + node.name.slice(1);
        const methodName = `visit${ruleName}`;
        if (
          typeof (this as Record<string, unknown>)[methodName] === "function"
        ) {
          return (
            (this as Record<string, unknown>)[methodName] as (
              node: ScalaCstNode,
              ctx: VisitorContext,
            ) => string
          )(node, ctx);
        }
      }

      // If no specific visitor method exists, try default handling by type
      if ("children" in node && node.children) {
        return this.visitChildren(node, ctx);
      }

      return "";
    } catch (error) {
      const nodeName = "name" in node ? node.name : "unknown";
      console.error(`Error in visitCore for ${nodeName}:`, error);

      // Try to recover by visiting children directly
      if ("children" in node && node.children) {
        try {
          return this.visitChildren(node, ctx);
        } catch (childError) {
          console.error(`Error visiting children of ${nodeName}:`, childError);
          return `/* ERROR: ${nodeName} */`;
        }
      }

      return "image" in node && node.image ? node.image : "";
    }
  }

  visitChildren(node: CSTNode, ctx: PrintContext): string {
    const parts: string[] = [];

    if (!("children" in node) || !node.children) return "";

    try {
      for (const [key, children] of Object.entries(node.children)) {
        if (Array.isArray(children)) {
          for (const child of children) {
            try {
              // Type guard for ScalaCstNode
              if ("children" in child && "name" in child) {
                const part = this.visit(child as ScalaCstNode, ctx);
                if (part) {
                  parts.push(part);
                }
              } else {
                // Handle IToken
                const tokenImage = "image" in child ? child.image : "";
                if (tokenImage) {
                  parts.push(tokenImage);
                }
              }
            } catch (childError) {
              const childName = "name" in child ? child.name : "token";
              console.error(
                `Error visiting child ${childName || "unknown"} in ${key}:`,
                childError,
              );
              // Continue with next child instead of failing completely
              parts.push(`/* ERROR: ${childName || "unknown"} */`);
            }
          }
        }
      }
    } catch (error) {
      console.error(
        `Error visiting children of ${node.name || "unknown"}:`,
        error,
      );
      return `/* ERROR: ${node.name || "unknown"} children */`;
    }

    return parts.join(" ");
  }

  // Utility methods for shared functionality
  getIndentation(ctx: PrintContext): string {
    return createIndent(1, ctx);
  }

  getPrintWidth(ctx: PrintContext): number {
    return getPrintWidth(ctx);
  }

  getTabWidth(ctx: PrintContext): number {
    return getTabWidth(ctx);
  }

  formatStatement(statement: string, ctx: PrintContext): string {
    return formatStatement(statement, ctx);
  }

  formatStringLiteral(content: string, ctx: PrintContext): string {
    return formatStringLiteral(content, ctx);
  }

  // ==========================================
  // Delegation methods to modular visitors
  // ==========================================

  // Compilation unit and top-level structure
  visitCompilationUnit(node: CSTNode, ctx: PrintContext): string {
    return this.statements.visitCompilationUnit(node, ctx);
  }

  // Package and imports/exports
  visitPackageClause(node: ScalaCstNode, ctx: PrintContext): string {
    return this.statements.visitPackageClause(node, ctx);
  }

  visitImportClause(node: ScalaCstNode, ctx: PrintContext): string {
    return this.statements.visitImportClause(node, ctx);
  }

  visitImportExpression(node: ScalaCstNode, ctx: PrintContext): string {
    return this.statements.visitImportExpression(node, ctx);
  }

  visitImportSelector(node: ScalaCstNode, ctx: PrintContext): string {
    return this.statements.visitImportSelector(node, ctx);
  }

  visitExportClause(node: ScalaCstNode, ctx: PrintContext): string {
    return this.scala3.visitExportClause(node, ctx);
  }

  visitExportExpression(node: ScalaCstNode, ctx: PrintContext): string {
    return this.scala3.visitExportExpression(node, ctx);
  }

  visitExportSelector(node: ScalaCstNode, ctx: PrintContext): string {
    return this.scala3.visitExportSelector(node, ctx);
  }

  // Definitions and declarations
  visitTopLevelDefinition(node: CSTNode, ctx: PrintContext): string {
    return this.statements.visitTopLevelDefinition(node, ctx);
  }

  visitDefinition(node: CSTNode, ctx: PrintContext): string {
    return this.statements.visitDefinition(node, ctx);
  }

  visitAnnotations(annotations: CSTNode[], ctx: PrintContext): string {
    return this.statements.visitAnnotations(annotations, ctx);
  }

  visitAnnotation(node: CSTNode, ctx: PrintContext): string {
    return this.statements.visitAnnotation(node, ctx);
  }

  visitAnnotationArgument(node: CSTNode, ctx: PrintContext): string {
    return this.statements.visitAnnotationArgument(node, ctx);
  }

  visitModifiers(modifiers: CSTNode[], ctx: PrintContext): string {
    return this.statements.visitModifiers(modifiers, ctx);
  }

  // Class-related declarations
  visitClassDefinition(node: CSTNode, ctx: PrintContext): string {
    return this.declarations.visitClassDefinition(node, ctx);
  }

  visitObjectDefinition(node: CSTNode, ctx: PrintContext): string {
    return this.declarations.visitObjectDefinition(node, ctx);
  }

  visitTraitDefinition(node: CSTNode, ctx: PrintContext): string {
    return this.declarations.visitTraitDefinition(node, ctx);
  }

  visitValDefinition(node: CSTNode, ctx: PrintContext): string {
    return this.declarations.visitValDefinition(node, ctx);
  }

  visitVarDefinition(node: CSTNode, ctx: PrintContext): string {
    return this.declarations.visitVarDefinition(node, ctx);
  }

  visitDefDefinition(node: CSTNode, ctx: PrintContext): string {
    return this.declarations.visitDefDefinition(node, ctx);
  }

  visitTypeDefinition(node: CSTNode, ctx: PrintContext): string {
    return this.scala3.visitTypeDefinition(node, ctx);
  }

  visitAuxiliaryConstructor(node: CSTNode, ctx: PrintContext): string {
    return this.declarations.visitAuxiliaryConstructor(node, ctx);
  }

  visitClassParameters(node: CSTNode, ctx: PrintContext): string {
    return this.declarations.visitClassParameters(node, ctx);
  }

  visitClassParameter(node: CSTNode, ctx: PrintContext): string {
    return this.declarations.visitClassParameter(node, ctx);
  }

  visitParameterLists(node: CSTNode, ctx: PrintContext): string {
    return this.declarations.visitParameterLists(node, ctx);
  }

  visitParameterList(node: CSTNode, ctx: PrintContext): string {
    return this.declarations.visitParameterList(node, ctx);
  }

  visitParameter(node: CSTNode, ctx: PrintContext): string {
    return this.declarations.visitParameter(node, ctx);
  }

  visitTypeParameters(node: CSTNode, ctx: PrintContext): string {
    return this.declarations.visitTypeParameters(node, ctx);
  }

  visitTypeParameter(node: CSTNode, ctx: PrintContext): string {
    return this.declarations.visitTypeParameter(node, ctx);
  }

  visitExtendsClause(node: CSTNode, ctx: PrintContext): string {
    return this.declarations.visitExtendsClause(node, ctx);
  }

  visitClassBody(node: CSTNode, ctx: PrintContext): string {
    return this.declarations.visitClassBody(node, ctx);
  }

  visitClassMember(node: CSTNode, ctx: PrintContext): string {
    return this.declarations.visitClassMember(node, ctx);
  }

  // Type system
  visitType(node: CSTNode, ctx: PrintContext): string {
    return this.types.visitType(node, ctx);
  }

  visitMatchType(node: CSTNode, ctx: PrintContext): string {
    return this.types.visitMatchType(node, ctx);
  }

  visitMatchTypeCase(node: CSTNode, ctx: PrintContext): string {
    return this.types.visitMatchTypeCase(node, ctx);
  }

  visitUnionType(node: CSTNode, ctx: PrintContext): string {
    return this.types.visitUnionType(node, ctx);
  }

  visitIntersectionType(node: CSTNode, ctx: PrintContext): string {
    return this.types.visitIntersectionType(node, ctx);
  }

  visitBaseType(node: CSTNode, ctx: PrintContext): string {
    return this.types.visitBaseType(node, ctx);
  }

  visitTupleTypeOrParenthesized(node: CSTNode, ctx: PrintContext): string {
    return this.types.visitTupleTypeOrParenthesized(node, ctx);
  }

  visitSimpleType(node: CSTNode, ctx: PrintContext): string {
    return this.types.visitSimpleType(node, ctx);
  }

  visitTypeArgument(node: CSTNode, ctx: PrintContext): string {
    return this.types.visitTypeArgument(node, ctx);
  }

  visitTypeArgumentUnion(node: CSTNode, ctx: PrintContext): string {
    return this.types.visitTypeArgumentUnion(node, ctx);
  }

  visitTypeArgumentIntersection(node: CSTNode, ctx: PrintContext): string {
    return this.types.visitTypeArgumentIntersection(node, ctx);
  }

  visitTypeArgumentSimple(node: CSTNode, ctx: PrintContext): string {
    return this.types.visitTypeArgumentSimple(node, ctx);
  }

  visitTypeLambda(node: CSTNode, ctx: PrintContext): string {
    return this.types.visitTypeLambda(node, ctx);
  }

  visitTypeLambdaParameter(node: CSTNode, ctx: PrintContext): string {
    return this.types.visitTypeLambdaParameter(node, ctx);
  }

  visitDependentFunctionType(node: CSTNode, ctx: PrintContext): string {
    return this.types.visitDependentFunctionType(node, ctx);
  }

  visitDependentParameter(node: CSTNode, ctx: PrintContext): string {
    return this.types.visitDependentParameter(node, ctx);
  }

  // Expressions
  visitExpression(node: CSTNode, ctx: PrintContext): string {
    return this.expressions.visitExpression(node, ctx);
  }

  visitPostfixExpression(node: CSTNode, ctx: PrintContext): string {
    return this.expressions.visitPostfixExpression(node, ctx);
  }

  visitPrimaryExpression(node: CSTNode, ctx: PrintContext): string {
    return this.expressions.visitPrimaryExpression(node, ctx);
  }

  visitAssignmentStatement(node: CSTNode, ctx: PrintContext): string {
    return this.expressions.visitAssignmentStatement(node, ctx);
  }

  visitAssignmentOrInfixExpression(node: CSTNode, ctx: PrintContext): string {
    return this.expressions.visitAssignmentOrInfixExpression(node, ctx);
  }

  visitInfixOperator(node: ScalaCstNode, ctx: PrintContext): string {
    return this.expressions.visitInfixOperator(node, ctx);
  }

  visitLiteral(node: ScalaCstNode, ctx: PrintContext): string {
    return this.expressions.visitLiteral(node, ctx);
  }

  visitQualifiedIdentifier(node: ScalaCstNode, ctx: PrintContext): string {
    return this.expressions.visitQualifiedIdentifier(node, ctx);
  }

  visitNewExpression(node: CSTNode, ctx: PrintContext): string {
    return this.expressions.visitNewExpression(node, ctx);
  }

  visitIfExpression(node: CSTNode, ctx: PrintContext): string {
    return this.expressions.visitIfExpression(node, ctx);
  }

  visitWhileExpression(node: CSTNode, ctx: PrintContext): string {
    return this.expressions.visitWhileExpression(node, ctx);
  }

  visitTryExpression(node: CSTNode, ctx: PrintContext): string {
    return this.expressions.visitTryExpression(node, ctx);
  }

  visitForExpression(node: CSTNode, ctx: PrintContext): string {
    return this.expressions.visitForExpression(node, ctx);
  }

  visitGenerator(node: CSTNode, ctx: PrintContext): string {
    return this.expressions.visitGenerator(node, ctx);
  }

  visitCaseClause(node: CSTNode, ctx: PrintContext): string {
    return this.expressions.visitCaseClause(node, ctx);
  }

  visitBlockExpression(node: CSTNode, ctx: PrintContext): string {
    return this.expressions.visitBlockExpression(node, ctx);
  }

  visitPartialFunctionLiteral(node: CSTNode, ctx: PrintContext): string {
    return this.expressions.visitPartialFunctionLiteral(node, ctx);
  }

  // Statements
  visitBlockStatement(node: CSTNode, ctx: PrintContext): string {
    return this.statements.visitBlockStatement(node, ctx);
  }

  visitPattern(node: CSTNode, ctx: PrintContext): string {
    return this.statements.visitPattern(node, ctx);
  }

  // Scala 3 specific features
  visitEnumDefinition(node: CSTNode, ctx: PrintContext): string {
    return this.scala3.visitEnumDefinition(node, ctx);
  }

  visitEnumCase(node: CSTNode, ctx: PrintContext): string {
    return this.scala3.visitEnumCase(node, ctx);
  }

  visitExtensionDefinition(node: CSTNode, ctx: PrintContext): string {
    return this.scala3.visitExtensionDefinition(node, ctx);
  }

  visitExtensionMember(node: CSTNode, ctx: PrintContext): string {
    return this.scala3.visitExtensionMember(node, ctx);
  }

  visitGivenDefinition(node: CSTNode, ctx: PrintContext): string {
    return this.scala3.visitGivenDefinition(node, ctx);
  }

  visitQuoteExpression(node: CSTNode, ctx: PrintContext): string {
    return this.scala3.visitQuoteExpression(node, ctx);
  }

  visitSpliceExpression(node: CSTNode, ctx: PrintContext): string {
    return this.scala3.visitSpliceExpression(node, ctx);
  }

  visitPolymorphicFunctionLiteral(node: CSTNode, ctx: PrintContext): string {
    return this.scala3.visitPolymorphicFunctionLiteral(node, ctx);
  }

  visitPolymorphicFunctionType(node: CSTNode, ctx: PrintContext): string {
    return this.types.visitPolymorphicFunctionType(node, ctx);
  }

  visitPolymorphicTypeParameter(node: CSTNode, ctx: PrintContext): string {
    return this.types.visitPolymorphicTypeParameter(node, ctx);
  }

  visitContextFunctionType(node: CSTNode, ctx: PrintContext): string {
    return this.scala3.visitContextFunctionType(node, ctx);
  }
}
