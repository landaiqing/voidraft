import { parse } from "java-parser";
import { determineFormatterOffOnRanges } from "./comments.js";
import { isTerminal } from "./printers/helpers.js";
export default {
    parse(text, options) {
        var _a;
        const cst = parse(text, options.entrypoint);
        (_a = cst.comments) === null || _a === void 0 ? void 0 : _a.forEach(comment => {
            comment.value = comment.image;
        });
        determineFormatterOffOnRanges(cst);
        return cst;
    },
    astFormat: "java",
    hasPragma(text) {
        return /^\/\*\*\n\s+\*\s@(format|prettier)\n\s+\*\//.test(text);
    },
    locStart(node) {
        return isTerminal(node) ? node.startOffset : node.location.startOffset;
    },
    locEnd(node) {
        return (isTerminal(node) ? node.endOffset : node.location.endOffset) + 1;
    }
};
