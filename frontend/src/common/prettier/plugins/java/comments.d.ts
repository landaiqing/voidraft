import type { IToken } from "java-parser";
import { type AstPath } from "prettier";
import { type JavaNode, type JavaNonTerminal, type JavaParserOptions } from "./printers/helpers.js";
export declare function determineFormatterOffOnRanges(cst: JavaNonTerminal): void;
export declare function isFullyBetweenFormatterOffOn(path: AstPath<JavaNode>): boolean;
export declare function canAttachComment(node: JavaNode): boolean;
export declare function handleLineComment(commentNode: JavaComment, _: string, options: JavaParserOptions): boolean;
export declare function handleRemainingComment(commentNode: JavaComment): boolean;
export type JavaComment = IToken & {
    value: string;
    leading: boolean;
    trailing: boolean;
    printed: boolean;
    enclosingNode?: JavaNonTerminal;
    precedingNode?: JavaNonTerminal;
    followingNode?: JavaNonTerminal;
};
