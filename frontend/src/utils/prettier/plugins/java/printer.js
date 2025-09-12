import { canAttachComment, handleLineComment, handleRemainingComment, isFullyBetweenFormatterOffOn } from "./comments.js";
import { isNonTerminal, isTerminal, printComment } from "./printers/helpers.js";
import { printerForNodeType } from "./printers/index.js";
export default {
    print(path, options, print, args) {
        return hasTerminal(path)
            ? path.node.image
            : printerForNodeType(path.node.name)(path, print, options, args);
    },
    hasPrettierIgnore(path) {
        var _a;
        const { node } = path;
        return (((_a = node.comments) === null || _a === void 0 ? void 0 : _a.some(({ image }) => /^(\/\/\s*prettier-ignore|\/\*\s*prettier-ignore\s*\*\/)$/.test(image))) === true ||
            (canAttachComment(node) && isFullyBetweenFormatterOffOn(path)));
    },
    canAttachComment,
    isBlockComment(node) {
        return isTerminal(node) && node.tokenType.name === "TraditionalComment";
    },
    printComment(commentPath) {
        const { node } = commentPath;
        if (isNonTerminal(node) || node.tokenType.GROUP !== "comments") {
            throw new Error(`Not a comment: ${JSON.stringify(node)}`);
        }
        return printComment(node);
    },
    getCommentChildNodes(node) {
        return isNonTerminal(node)
            ? Object.values(node.children).flatMap(child => child)
            : [];
    },
    handleComments: {
        ownLine: handleLineComment,
        endOfLine: handleLineComment,
        remaining: handleRemainingComment
    }
};
function hasTerminal(path) {
    return isTerminal(path.node);
}
