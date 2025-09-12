import { util } from "prettier";
import parser from "./parser.js";
import { isEmptyStatement, isNonTerminal, isTerminal } from "./printers/helpers.js";
const formatterOffOnRangesByCst = new WeakMap();
export function determineFormatterOffOnRanges(cst) {
    const { comments } = cst;
    if (!comments) {
        return;
    }
    const ranges = comments
        .filter(({ image }) => /^(\/\/\s*@formatter:(off|on)\s*|\/\*\s*@formatter:(off|on)\s*\*\/)$/.test(image))
        .reduce((ranges, { image, startOffset }) => {
        const previous = ranges.at(-1);
        if (image.endsWith("off")) {
            if ((previous === null || previous === void 0 ? void 0 : previous.on) !== Infinity) {
                ranges.push({ off: startOffset, on: Infinity });
            }
        }
        else if ((previous === null || previous === void 0 ? void 0 : previous.on) === Infinity) {
            previous.on = startOffset;
        }
        return ranges;
    }, new Array());
    formatterOffOnRangesByCst.set(cst, ranges);
}
export function isFullyBetweenFormatterOffOn(path) {
    var _a;
    const { node, root } = path;
    const start = parser.locStart(node);
    const end = parser.locEnd(node);
    return (((_a = formatterOffOnRangesByCst
        .get(root)) === null || _a === void 0 ? void 0 : _a.some(range => range.off < start && end < range.on)) === true);
}
export function canAttachComment(node) {
    var _a, _b, _c;
    if (isTerminal(node)) {
        const { name, CATEGORIES } = node.tokenType;
        return (name === "Identifier" ||
            (CATEGORIES === null || CATEGORIES === void 0 ? void 0 : CATEGORIES.find(({ name }) => name === "BinaryOperator")) !== undefined);
    }
    const { children, name } = node;
    switch (name) {
        case "argumentList":
        case "blockStatements":
        case "emptyStatement":
        case "enumBodyDeclarations":
            return false;
        case "annotationInterfaceMemberDeclaration":
        case "classMemberDeclaration":
        case "interfaceMemberDeclaration":
        case "methodBody":
            return !children.Semicolon;
        case "blockStatement":
            return !children.statement || !isEmptyStatement(children.statement[0]);
        case "classBodyDeclaration":
            return !((_a = children.classMemberDeclaration) === null || _a === void 0 ? void 0 : _a[0].children.Semicolon);
        case "recordBodyDeclaration":
            return !((_c = (_b = children.classBodyDeclaration) === null || _b === void 0 ? void 0 : _b[0].children.classMemberDeclaration) === null || _c === void 0 ? void 0 : _c[0].children.Semicolon);
        case "statement":
            return !isEmptyStatement(node);
        case "statementWithoutTrailingSubstatement":
            return !children.emptyStatement;
        default:
            return true;
    }
}
export function handleLineComment(commentNode, _, options) {
    return [
        handleBinaryExpressionComments,
        handleFqnOrRefTypeComments,
        handleIfStatementComments,
        handleJumpStatementComments,
        handleLabeledStatementComments,
        handleNameComments
    ].some(fn => fn(commentNode, options));
}
export function handleRemainingComment(commentNode) {
    return [
        handleFqnOrRefTypeComments,
        handleMethodDeclaratorComments,
        handleNameComments,
        handleJumpStatementComments
    ].some(fn => fn(commentNode));
}
function handleBinaryExpressionComments(commentNode, options) {
    const { enclosingNode, precedingNode, followingNode } = commentNode;
    if (enclosingNode &&
        isNonTerminal(enclosingNode) &&
        enclosingNode.name === "binaryExpression") {
        if (isBinaryOperator(followingNode)) {
            if (options.experimentalOperatorPosition === "start") {
                util.addLeadingComment(followingNode, commentNode);
            }
            else {
                util.addTrailingComment(followingNode, commentNode);
            }
            return true;
        }
        else if (options.experimentalOperatorPosition === "start" &&
            isBinaryOperator(precedingNode)) {
            util.addLeadingComment(precedingNode, commentNode);
            return true;
        }
    }
    return false;
}
function handleFqnOrRefTypeComments(commentNode) {
    const { enclosingNode, followingNode } = commentNode;
    if (enclosingNode &&
        isNonTerminal(enclosingNode) &&
        enclosingNode.name === "fqnOrRefType" &&
        followingNode) {
        util.addLeadingComment(followingNode, commentNode);
        return true;
    }
    return false;
}
function handleIfStatementComments(commentNode) {
    const { enclosingNode, precedingNode } = commentNode;
    if (enclosingNode &&
        isNonTerminal(enclosingNode) &&
        enclosingNode.name === "ifStatement" &&
        precedingNode &&
        isNonTerminal(precedingNode) &&
        precedingNode.name === "statement") {
        util.addDanglingComment(enclosingNode, commentNode, undefined);
        return true;
    }
    return false;
}
function handleJumpStatementComments(commentNode) {
    const { enclosingNode, precedingNode, followingNode } = commentNode;
    if (enclosingNode &&
        !precedingNode &&
        !followingNode &&
        isNonTerminal(enclosingNode) &&
        ["breakStatement", "continueStatement", "returnStatement"].includes(enclosingNode.name)) {
        util.addTrailingComment(enclosingNode, commentNode);
        return true;
    }
    return false;
}
function handleLabeledStatementComments(commentNode) {
    const { enclosingNode, precedingNode } = commentNode;
    if (enclosingNode &&
        precedingNode &&
        isNonTerminal(enclosingNode) &&
        enclosingNode.name === "labeledStatement" &&
        isTerminal(precedingNode) &&
        precedingNode.tokenType.name === "Identifier") {
        util.addLeadingComment(precedingNode, commentNode);
        return true;
    }
    return false;
}
function handleMethodDeclaratorComments(commentNode) {
    const { enclosingNode } = commentNode;
    if (enclosingNode &&
        isNonTerminal(enclosingNode) &&
        enclosingNode.name === "methodDeclarator" &&
        !enclosingNode.children.receiverParameter &&
        !enclosingNode.children.formalParameterList &&
        enclosingNode.children.LBrace[0].startOffset < commentNode.startOffset &&
        commentNode.startOffset < enclosingNode.children.RBrace[0].startOffset) {
        util.addDanglingComment(enclosingNode, commentNode, undefined);
        return true;
    }
    return false;
}
function handleNameComments(commentNode) {
    const { enclosingNode, precedingNode } = commentNode;
    if (enclosingNode &&
        precedingNode &&
        isNonTerminal(enclosingNode) &&
        isTerminal(precedingNode) &&
        precedingNode.tokenType.name === "Identifier" &&
        [
            "ambiguousName",
            "classOrInterfaceTypeToInstantiate",
            "expressionName",
            "moduleDeclaration",
            "moduleName",
            "packageDeclaration",
            "packageName",
            "packageOrTypeName",
            "typeName"
        ].includes(enclosingNode.name)) {
        util.addTrailingComment(precedingNode, commentNode);
        return true;
    }
    return false;
}
function isBinaryOperator(node) {
    var _a;
    return (node !== undefined &&
        (isNonTerminal(node)
            ? node.name === "shiftOperator"
            : (_a = node.tokenType.CATEGORIES) === null || _a === void 0 ? void 0 : _a.some(({ name }) => name === "BinaryOperator")));
}
