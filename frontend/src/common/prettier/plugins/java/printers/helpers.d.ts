import type { AnnotationCstNode, ClassPermitsCstNode, ClassTypeCtx, CstElement, CstNode, ExpressionCstNode, InterfacePermitsCstNode, IToken, StatementCstNode } from "java-parser";
import type { AstPath, Doc, ParserOptions } from "prettier";
import { builders } from "prettier/doc";
import type { JavaComment } from "../comments.js";
export declare function onlyDefinedKey<T extends Record<string, any>, K extends Key<T> & string>(obj: T, options?: K[]): K;
export declare function definedKeys<T extends Record<string, any>, K extends Key<T> & string>(obj: T, options?: K[]): K[];
export declare function printWithModifiers<T extends CstNode, P extends IterProperties<T["children"]>>(path: AstPath<T>, print: JavaPrintFn, modifierChild: P, contents: Doc, noTypeAnnotations?: boolean): builders.Doc[];
export declare function hasDeclarationAnnotations(modifiers: ModifierNode[]): boolean;
export declare function call<T extends CstNode, U, P extends IterProperties<T["children"]>>(path: AstPath<T>, callback: MapCallback<IndexValue<IndexValue<T, "children">, P>, U>, child: P): U;
export declare function each<T extends CstNode, P extends IterProperties<T["children"]>>(path: AstPath<T>, callback: MapCallback<IndexValue<IndexValue<T, "children">, P>, void>, child: P): void;
export declare function map<T extends CstNode, U, P extends IterProperties<T["children"]>>(path: AstPath<T>, callback: MapCallback<IndexValue<IndexValue<T, "children">, P>, U>, child: P): U[];
export declare function flatMap<T extends CstNode, U, P extends IterProperties<T["children"]>>(path: AstPath<T>, callback: MapCallback<IndexValue<IndexValue<T, "children">, P>, U>, children: P[]): U[];
export declare function printSingle(path: AstPath<JavaNonTerminal>, print: JavaPrintFn, _?: JavaParserOptions, args?: unknown): builders.Doc;
export declare function lineStartWithComments(node: JavaNonTerminal): number;
export declare function lineEndWithComments(node: JavaNonTerminal): number;
export declare function printDanglingComments(path: AstPath<JavaNonTerminal>): builders.Doc[];
export declare function printComment(node: JavaTerminal): string | builders.Doc[];
export declare function hasLeadingComments(node: JavaNode): boolean | undefined;
export declare function indentInParentheses(contents: Doc, opts?: {
    shouldBreak?: boolean;
}): builders.Group | "()";
export declare function printArrayInitializer<T extends JavaNonTerminal, P extends IterProperties<T["children"]>>(path: AstPath<T>, print: JavaPrintFn, options: JavaParserOptions, child: P): builders.Group | "{}";
export declare function printBlock(path: AstPath<JavaNonTerminal>, contents: Doc[]): builders.Group | "{}" | (string | builders.Indent | builders.Hardline)[];
export declare function printName(path: AstPath<JavaNonTerminal & {
    children: {
        Identifier: IToken[];
    };
}>, print: JavaPrintFn): builders.Doc[];
export declare function printList<T extends JavaNonTerminal, P extends IterProperties<T["children"]>>(path: AstPath<T>, print: JavaPrintFn, child: P): builders.Doc[];
export declare function printClassPermits(path: AstPath<ClassPermitsCstNode | InterfacePermitsCstNode>, print: JavaPrintFn): builders.Group;
export declare function printClassType(path: AstPath<JavaNonTerminal & {
    children: ClassTypeCtx;
}>, print: JavaPrintFn): builders.Doc[];
export declare function isBinaryExpression(expression: ExpressionCstNode): boolean;
export declare function findBaseIndent(lines: string[]): number;
export declare function isEmptyStatement(statement: StatementCstNode): boolean;
export declare function isNonTerminal(node: CstElement): node is JavaNonTerminal;
export declare function isTerminal(node: CstElement): node is IToken;
export type JavaNode = CstElement & {
    comments?: JavaComment[];
};
export type JavaNonTerminal = Exclude<JavaNode, IToken>;
export type JavaTerminal = Exclude<JavaNode, CstNode>;
export type JavaNodePrinters = {
    [T in JavaNonTerminal["name"]]: JavaNodePrinter<T>;
};
export type JavaNodePrinter<T> = (path: AstPath<Extract<JavaNonTerminal, {
    name: T;
}>>, print: JavaPrintFn, options: JavaParserOptions, args?: unknown) => Doc;
export type JavaPrintFn = (path: AstPath<JavaNode>, args?: unknown) => Doc;
export type JavaParserOptions = ParserOptions<JavaNode> & {
    entrypoint?: string;
};
export type IterProperties<T> = T extends any[] ? IndexProperties<T> : ArrayProperties<T>;
type Key<T> = T extends T ? keyof T : never;
type ModifierNode = JavaNonTerminal & {
    children: {
        annotation?: AnnotationCstNode[];
    };
};
type IsTuple<T> = T extends [] ? true : T extends [infer _First, ...infer Remain] ? IsTuple<Remain> : false;
type IndexProperties<T extends {
    length: number;
}> = IsTuple<T> extends true ? Exclude<Partial<T>["length"], T["length"]> : number;
type ArrayProperties<T> = {
    [K in keyof T]: NonNullable<T[K]> extends readonly any[] ? K : never;
}[keyof T];
type ArrayElement<T> = T extends Array<infer E> ? E : never;
type MapCallback<T, U> = (path: AstPath<ArrayElement<T>>, index: number, value: any) => U;
type IndexValue<T, P> = T extends any[] ? P extends number ? T[P] : never : P extends keyof T ? T[P] : never;
export {};
