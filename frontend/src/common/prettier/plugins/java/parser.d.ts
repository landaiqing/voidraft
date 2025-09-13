import { type JavaNode, type JavaNonTerminal, type JavaParserOptions } from "./printers/helpers.js";
declare const _default: {
    parse(text: string, options: JavaParserOptions): JavaNonTerminal;
    astFormat: string;
    hasPragma(text: string): boolean;
    locStart(node: JavaNode): number;
    locEnd(node: JavaNode): number;
};
export default _default;
