import { builders } from "prettier/doc";
import { printSingle } from "./helpers.js";
declare const _default: {
    literal(path: import("prettier").AstPath<import("java-parser").LiteralCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc;
    integerLiteral: typeof printSingle;
    floatingPointLiteral: typeof printSingle;
    booleanLiteral: typeof printSingle;
    shiftOperator(path: import("prettier").AstPath<import("java-parser").ShiftOperatorCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
};
export default _default;
