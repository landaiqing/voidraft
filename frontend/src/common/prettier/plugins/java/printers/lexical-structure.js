import { builders } from "prettier/doc";
import { findBaseIndent, map, onlyDefinedKey, printSingle } from "./helpers.js";
const { hardline, indent, join } = builders;
export default {
    literal(path, print) {
        const { TextBlock } = path.node.children;
        if (!TextBlock) {
            return printSingle(path, print);
        }
        const [open, ...lines] = TextBlock[0].image.split("\n");
        const baseIndent = findBaseIndent(lines);
        const textBlock = join(hardline, [
            open,
            ...lines.map(line => line.slice(baseIndent))
        ]);
        const ancestor = path.getNode(14);
        return (ancestor === null || ancestor === void 0 ? void 0 : ancestor.name) === "variableInitializer" ||
            ((ancestor === null || ancestor === void 0 ? void 0 : ancestor.name) === "binaryExpression" &&
                ancestor.children.AssignmentOperator)
            ? indent(textBlock)
            : textBlock;
    },
    integerLiteral: printSingle,
    floatingPointLiteral: printSingle,
    booleanLiteral: printSingle,
    shiftOperator(path, print) {
        return map(path, print, onlyDefinedKey(path.node.children));
    }
};
