import { builders } from "prettier/doc";
import parser from "../parser.js";
const { group, hardline, ifBreak, indent, join, line, softline } = builders;
export function onlyDefinedKey(obj, options) {
    const keys = definedKeys(obj, options);
    if (keys.length === 1) {
        return keys[0];
    }
    throw new Error(keys.length > 1
        ? `More than one defined key found: ${keys}`
        : "No defined keys found");
}
export function definedKeys(obj, options) {
    return (options !== null && options !== void 0 ? options : Object.keys(obj)).filter(key => obj[key] !== undefined);
}
const indexByModifier = [
    "public",
    "protected",
    "private",
    "abstract",
    "default",
    "static",
    "final",
    "transient",
    "volatile",
    "synchronized",
    "native",
    "sealed",
    "non-sealed",
    "strictfp"
].reduce((map, name, index) => map.set(name, index), new Map());
export function printWithModifiers(path, print, modifierChild, contents, noTypeAnnotations = false) {
    const declarationAnnotations = [];
    const otherModifiers = [];
    const typeAnnotations = [];
    each(path, modifierPath => {
        const { children } = modifierPath.node;
        const modifier = print(modifierPath);
        if (children.annotation) {
            (otherModifiers.length ? typeAnnotations : declarationAnnotations).push(modifier);
        }
        else {
            otherModifiers.push(modifier);
            declarationAnnotations.push(...typeAnnotations);
            typeAnnotations.length = 0;
        }
    }, modifierChild);
    if (noTypeAnnotations) {
        declarationAnnotations.push(...typeAnnotations);
        typeAnnotations.length = 0;
    }
    otherModifiers.sort((a, b) => indexByModifier.get(a) - indexByModifier.get(b));
    return join(hardline, [
        ...declarationAnnotations,
        join(" ", [...otherModifiers, ...typeAnnotations, contents])
    ]);
}
export function hasDeclarationAnnotations(modifiers) {
    let hasAnnotation = false;
    let hasNonAnnotation = false;
    for (const modifier of modifiers) {
        if (modifier.children.annotation) {
            hasAnnotation = true;
        }
        else if (hasAnnotation) {
            return true;
        }
        else {
            hasNonAnnotation = true;
        }
    }
    return hasAnnotation && !hasNonAnnotation;
}
export function call(path, callback, child) {
    return path.map(callback, "children", child)[0];
}
export function each(path, callback, child) {
    if (path.node.children[child]) {
        path.each(callback, "children", child);
    }
}
export function map(path, callback, child) {
    return path.node.children[child] ? path.map(callback, "children", child) : [];
}
export function flatMap(path, callback, children) {
    return children
        .flatMap(child => map(path, callback, child).map((doc, index) => {
        const node = path.node.children[child][index];
        return {
            doc,
            startOffset: parser.locStart(node)
        };
    }))
        .sort((a, b) => a.startOffset - b.startOffset)
        .map(({ doc }) => doc);
}
export function printSingle(path, print, _, args) {
    return call(path, childPath => print(childPath, args), onlyDefinedKey(path.node.children));
}
export function lineStartWithComments(node) {
    const { comments, location } = node;
    return comments
        ? Math.min(location.startLine, comments[0].startLine)
        : location.startLine;
}
export function lineEndWithComments(node) {
    const { comments, location } = node;
    return comments
        ? Math.max(location.endLine, comments.at(-1).endLine)
        : location.endLine;
}
export function printDanglingComments(path) {
    if (!path.node.comments) {
        return [];
    }
    const comments = [];
    path.each(commentPath => {
        const comment = commentPath.node;
        if (comment.leading || comment.trailing) {
            return;
        }
        comment.printed = true;
        comments.push(printComment(comment));
    }, "comments");
    return join(hardline, comments);
}
export function printComment(node) {
    const { image } = node;
    const lines = image.split("\n").map(line => line.trim());
    return lines.length > 1 &&
        lines[0].startsWith("/*") &&
        lines.slice(1).every(line => line.startsWith("*")) &&
        lines.at(-1).endsWith("*/")
        ? join(hardline, lines.map((line, index) => (index === 0 ? line : ` ${line}`)))
        : image;
}
export function hasLeadingComments(node) {
    var _a;
    return (_a = node.comments) === null || _a === void 0 ? void 0 : _a.some(({ leading }) => leading);
}
export function indentInParentheses(contents, opts) {
    return !Array.isArray(contents) || contents.length
        ? group(["(", indent([softline, contents]), softline, ")"], opts)
        : "()";
}
export function printArrayInitializer(path, print, options, child) {
    const list = [];
    if (child && child in path.node.children) {
        list.push(call(path, print, child));
        if (options.trailingComma !== "none") {
            list.push(ifBreak(","));
        }
    }
    list.push(...printDanglingComments(path));
    return list.length ? group(["{", indent([line, ...list]), line, "}"]) : "{}";
}
export function printBlock(path, contents) {
    if (!contents.length) {
        const danglingComments = printDanglingComments(path);
        return danglingComments.length
            ? ["{", indent([hardline, ...danglingComments]), hardline, "}"]
            : "{}";
    }
    return group([
        "{",
        indent([hardline, ...join(hardline, contents)]),
        hardline,
        "}"
    ]);
}
export function printName(path, print) {
    return join(".", map(path, print, "Identifier"));
}
export function printList(path, print, child) {
    return join([",", line], map(path, print, child));
}
export function printClassPermits(path, print) {
    return group([
        "permits",
        indent([line, group(printList(path, print, "typeName"))])
    ]);
}
export function printClassType(path, print) {
    const { children } = path.node;
    return definedKeys(children, ["annotation", "Identifier", "typeArguments"])
        .flatMap(child => children[child].map((node, index) => ({
        child,
        index,
        startOffset: parser.locStart(node)
    })))
        .sort((a, b) => a.startOffset - b.startOffset)
        .flatMap(({ child, index: childIndex }, index, array) => {
        const node = children[child][childIndex];
        const next = array.at(index + 1);
        const nextNode = next && children[next.child][next.index];
        const docs = [path.call(print, "children", child, childIndex)];
        if (nextNode) {
            if (isNonTerminal(node)) {
                docs.push(node.name === "annotation" ? " " : ".");
            }
            else if (isTerminal(nextNode) || nextNode.name === "annotation") {
                docs.push(".");
            }
        }
        return docs;
    });
}
export function isBinaryExpression(expression) {
    var _a;
    const conditionalExpression = (_a = expression.children.conditionalExpression) === null || _a === void 0 ? void 0 : _a[0].children;
    if (!conditionalExpression) {
        return false;
    }
    const isTernary = conditionalExpression.QuestionMark !== undefined;
    if (isTernary) {
        return false;
    }
    const hasNonAssignmentOperators = Object.values(conditionalExpression.binaryExpression[0].children).some(child => {
        var _a;
        return isTerminal(child[0]) &&
            !((_a = child[0].tokenType.CATEGORIES) === null || _a === void 0 ? void 0 : _a.some(category => category.name === "AssignmentOperator"));
    });
    return hasNonAssignmentOperators;
}
export function findBaseIndent(lines) {
    return lines.length
        ? Math.min(...lines.map(line => line.search(/\S/)).filter(indent => indent >= 0))
        : 0;
}
export function isEmptyStatement(statement) {
    var _a;
    return (((_a = statement.children.statementWithoutTrailingSubstatement) === null || _a === void 0 ? void 0 : _a[0].children.emptyStatement) !== undefined);
}
export function isNonTerminal(node) {
    return !isTerminal(node);
}
export function isTerminal(node) {
    return "tokenType" in node;
}
