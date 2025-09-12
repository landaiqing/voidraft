import { builders } from "prettier/doc";
import { call, each, hasDeclarationAnnotations, indentInParentheses, lineEndWithComments, lineStartWithComments, onlyDefinedKey, printArrayInitializer, printBlock, printClassPermits, printList, printSingle, printWithModifiers } from "./helpers.js";
const { group, hardline, indent, join, line } = builders;
export default {
    interfaceDeclaration(path, print) {
        const declarationKey = onlyDefinedKey(path.node.children, [
            "annotationInterfaceDeclaration",
            "normalInterfaceDeclaration"
        ]);
        return printWithModifiers(path, print, "interfaceModifier", call(path, print, declarationKey), true);
    },
    normalInterfaceDeclaration(path, print) {
        const { interfaceExtends, interfacePermits, typeParameters } = path.node.children;
        const header = ["interface ", call(path, print, "typeIdentifier")];
        if (typeParameters) {
            header.push(call(path, print, "typeParameters"));
        }
        if (interfaceExtends) {
            header.push(indent([line, call(path, print, "interfaceExtends")]));
        }
        if (interfacePermits) {
            header.push(indent([line, call(path, print, "interfacePermits")]));
        }
        return [group(header), " ", call(path, print, "interfaceBody")];
    },
    interfaceModifier: printSingle,
    interfaceExtends(path, print) {
        return group([
            "extends",
            indent([line, call(path, print, "interfaceTypeList")])
        ]);
    },
    interfacePermits: printClassPermits,
    interfaceBody(path, print) {
        const declarations = [];
        let previousRequiresPadding = false;
        each(path, declarationPath => {
            var _a, _b, _c, _d;
            const declaration = print(declarationPath);
            if (declaration === "") {
                return;
            }
            const { node, previous } = declarationPath;
            const constantDeclaration = (_a = node.children.constantDeclaration) === null || _a === void 0 ? void 0 : _a[0].children;
            const methodDeclaration = (_b = node.children.interfaceMethodDeclaration) === null || _b === void 0 ? void 0 : _b[0].children;
            const currentRequiresPadding = (!constantDeclaration && !methodDeclaration) ||
                (methodDeclaration === null || methodDeclaration === void 0 ? void 0 : methodDeclaration.methodBody[0].children.block) !== undefined ||
                hasDeclarationAnnotations((_d = (_c = constantDeclaration === null || constantDeclaration === void 0 ? void 0 : constantDeclaration.constantModifier) !== null && _c !== void 0 ? _c : methodDeclaration === null || methodDeclaration === void 0 ? void 0 : methodDeclaration.interfaceMethodModifier) !== null && _d !== void 0 ? _d : []);
            const blankLine = declarations.length > 0 &&
                (previousRequiresPadding ||
                    currentRequiresPadding ||
                    lineStartWithComments(node) > lineEndWithComments(previous) + 1);
            declarations.push(blankLine ? [hardline, declaration] : declaration);
            previousRequiresPadding = currentRequiresPadding;
        }, "interfaceMemberDeclaration");
        return printBlock(path, declarations);
    },
    interfaceMemberDeclaration(path, print) {
        const { children } = path.node;
        return children.Semicolon
            ? ""
            : call(path, print, onlyDefinedKey(children));
    },
    constantDeclaration(path, print) {
        const declaration = [
            call(path, print, "unannType"),
            " ",
            call(path, print, "variableDeclaratorList"),
            ";"
        ];
        return printWithModifiers(path, print, "constantModifier", declaration);
    },
    constantModifier: printSingle,
    interfaceMethodDeclaration(path, print) {
        const declaration = [
            call(path, print, "methodHeader"),
            path.node.children.methodBody[0].children.Semicolon ? "" : " ",
            call(path, print, "methodBody")
        ];
        return printWithModifiers(path, print, "interfaceMethodModifier", declaration);
    },
    interfaceMethodModifier: printSingle,
    annotationInterfaceDeclaration(path, print) {
        return join(" ", [
            "@interface",
            call(path, print, "typeIdentifier"),
            call(path, print, "annotationInterfaceBody")
        ]);
    },
    annotationInterfaceBody(path, print) {
        const declarations = [];
        each(path, declarationPath => {
            const declaration = print(declarationPath);
            if (declaration === "") {
                return;
            }
            declarations.push(declarationPath.isFirst ? declaration : [hardline, declaration]);
        }, "annotationInterfaceMemberDeclaration");
        return printBlock(path, declarations);
    },
    annotationInterfaceMemberDeclaration(path, print) {
        const { children } = path.node;
        return children.Semicolon
            ? ""
            : call(path, print, onlyDefinedKey(children));
    },
    annotationInterfaceElementDeclaration(path, print) {
        const { dims, defaultValue } = path.node.children;
        const declaration = [
            call(path, print, "unannType"),
            " ",
            call(path, print, "Identifier"),
            "()"
        ];
        if (dims) {
            declaration.push(call(path, print, "dims"));
        }
        if (defaultValue) {
            declaration.push(" ", call(path, print, "defaultValue"));
        }
        declaration.push(";");
        return printWithModifiers(path, print, "annotationInterfaceElementModifier", declaration);
    },
    annotationInterfaceElementModifier: printSingle,
    defaultValue(path, print) {
        return ["default ", call(path, print, "elementValue")];
    },
    annotation(path, print) {
        const { children } = path.node;
        const annotation = ["@", call(path, print, "typeName")];
        if (children.elementValue || children.elementValuePairList) {
            const valuesKey = onlyDefinedKey(children, [
                "elementValue",
                "elementValuePairList"
            ]);
            annotation.push(indentInParentheses(call(path, print, valuesKey)));
        }
        return annotation;
    },
    elementValuePairList(path, print) {
        return printList(path, print, "elementValuePair");
    },
    elementValuePair(path, print) {
        return join(" ", [
            call(path, print, "Identifier"),
            call(path, print, "Equals"),
            call(path, print, "elementValue")
        ]);
    },
    elementValue: printSingle,
    elementValueArrayInitializer(path, print, options) {
        return printArrayInitializer(path, print, options, "elementValueList");
    },
    elementValueList(path, print) {
        return group(printList(path, print, "elementValue"));
    }
};
