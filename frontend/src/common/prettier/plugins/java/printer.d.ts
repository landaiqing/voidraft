import type { AstPath } from "prettier";
import { canAttachComment, handleLineComment, handleRemainingComment } from "./comments.js";
import { type JavaNode } from "./printers/helpers.js";
declare const _default: {
    print(path: DistributedAstPath<JavaNode>, options: import("prettier").ParserOptions<JavaNode>, print: (path: AstPath<JavaNode>) => import("prettier").Doc, args: unknown): import("prettier/doc.js").builders.Doc;
    hasPrettierIgnore(path: AstPath<JavaNode>): boolean;
    canAttachComment: typeof canAttachComment;
    isBlockComment(node: JavaNode): boolean;
    printComment(commentPath: AstPath<JavaNode>): string | import("prettier/doc.js").builders.Doc[];
    getCommentChildNodes(node: JavaNode): any[];
    handleComments: {
        ownLine: typeof handleLineComment;
        endOfLine: typeof handleLineComment;
        remaining: typeof handleRemainingComment;
    };
};
export default _default;
type DistributedAstPath<T> = T extends any ? AstPath<T> : never;
