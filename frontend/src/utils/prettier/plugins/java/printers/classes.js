import { builders } from "prettier/doc";
import { call, each, hasDeclarationAnnotations, hasLeadingComments, indentInParentheses, isBinaryExpression, lineEndWithComments, lineStartWithComments, map, onlyDefinedKey, printBlock, printClassPermits, printClassType, printDanglingComments, printList, printSingle, printWithModifiers } from "./helpers.js";
const { group, hardline, indent, indentIfBreak, join, line, softline } = builders;
export default {
    classDeclaration(path, print) {
        const declarationKey = onlyDefinedKey(path.node.children, [
            "enumDeclaration",
            "normalClassDeclaration",
            "recordDeclaration"
        ]);
        const declaration = call(path, print, declarationKey);
        return printWithModifiers(path, print, "classModifier", declaration, true);
    },
    normalClassDeclaration(path, print) {
        const { classExtends, classImplements, classPermits, typeParameters } = path.node.children;
        const header = ["class ", call(path, print, "typeIdentifier")];
        if (typeParameters) {
            header.push(call(path, print, "typeParameters"));
        }
        if (classExtends) {
            header.push(indent([line, call(path, print, "classExtends")]));
        }
        if (classImplements) {
            header.push(indent([line, call(path, print, "classImplements")]));
        }
        if (classPermits) {
            header.push(indent([line, call(path, print, "classPermits")]));
        }
        return [group(header), " ", call(path, print, "classBody")];
    },
    classModifier: printSingle,
    typeParameters(path, print) {
        return group([
            "<",
            indent([softline, call(path, print, "typeParameterList")]),
            softline,
            ">"
        ]);
    },
    typeParameterList(path, print) {
        return printList(path, print, "typeParameter");
    },
    classExtends(path, print) {
        return ["extends ", call(path, print, "classType")];
    },
    classImplements(path, print) {
        return group([
            "implements",
            indent([line, call(path, print, "interfaceTypeList")])
        ]);
    },
    classPermits: printClassPermits,
    interfaceTypeList(path, print) {
        return group(printList(path, print, "interfaceType"));
    },
    classBody(path, print) {
        return printBlock(path, printClassBodyDeclarations(path, print));
    },
    classBodyDeclaration: printSingle,
    classMemberDeclaration(path, print) {
        const { children } = path.node;
        return children.Semicolon
            ? ""
            : call(path, print, onlyDefinedKey(children));
    },
    fieldDeclaration(path, print) {
        const declaration = [
            call(path, print, "unannType"),
            " ",
            call(path, print, "variableDeclaratorList"),
            ";"
        ];
        return printWithModifiers(path, print, "fieldModifier", declaration);
    },
    fieldModifier: printSingle,
    variableDeclaratorList(path, print) {
        var _a;
        const declarators = map(path, print, "variableDeclarator");
        return declarators.length > 1 &&
            path.node.children.variableDeclarator.some(({ children }) => children.Equals)
            ? group(indent(join([",", line], declarators)), {
                shouldBreak: ((_a = path.getNode(4)) === null || _a === void 0 ? void 0 : _a.name) !== "forInit"
            })
            : join(", ", declarators);
    },
    variableDeclarator(path, print) {
        var _a, _b;
        const { children } = path.node;
        const variableInitializer = (_a = children.variableInitializer) === null || _a === void 0 ? void 0 : _a[0];
        const declaratorId = call(path, print, "variableDeclaratorId");
        if (!variableInitializer) {
            return declaratorId;
        }
        const expression = (_b = variableInitializer.children.expression) === null || _b === void 0 ? void 0 : _b[0];
        const declarator = [declaratorId, " ", call(path, print, "Equals")];
        const initializer = call(path, print, "variableInitializer");
        if (hasLeadingComments(variableInitializer) ||
            (expression && isBinaryExpression(expression))) {
            declarator.push(group(indent([line, initializer])));
        }
        else {
            const groupId = Symbol("assignment");
            declarator.push(group(indent(line), { id: groupId }), indentIfBreak(initializer, { groupId }));
        }
        return group(declarator);
    },
    variableDeclaratorId(path, print) {
        const { dims, Underscore } = path.node.children;
        if (Underscore) {
            return "_";
        }
        const identifier = call(path, print, "Identifier");
        return dims ? [identifier, call(path, print, "dims")] : identifier;
    },
    variableInitializer: printSingle,
    unannType: printSingle,
    unannPrimitiveTypeWithOptionalDimsSuffix(path, print) {
        const type = call(path, print, "unannPrimitiveType");
        return path.node.children.dims ? [type, call(path, print, "dims")] : type;
    },
    unannPrimitiveType: printSingle,
    unannReferenceType(path, print) {
        const type = call(path, print, "unannClassOrInterfaceType");
        return path.node.children.dims ? [type, call(path, print, "dims")] : type;
    },
    unannClassOrInterfaceType: printSingle,
    unannClassType: printClassType,
    unannInterfaceType: printSingle,
    unannTypeVariable: printSingle,
    methodDeclaration(path, print) {
        const declaration = [
            call(path, print, "methodHeader"),
            path.node.children.methodBody[0].children.Semicolon ? "" : " ",
            call(path, print, "methodBody")
        ];
        return printWithModifiers(path, print, "methodModifier", declaration);
    },
    methodModifier: printSingle,
    methodHeader(path, print) {
        const { typeParameters, annotation, throws } = path.node.children;
        const header = [];
        if (typeParameters) {
            header.push(call(path, print, "typeParameters"));
        }
        if (annotation) {
            header.push(join(line, map(path, print, "annotation")));
        }
        header.push(call(path, print, "result"), call(path, print, "methodDeclarator"));
        return throws
            ? group([
                ...join(" ", header),
                group(indent([line, call(path, print, "throws")]))
            ])
            : group(join(" ", header));
    },
    result: printSingle,
    methodDeclarator(path, print) {
        const { dims, formalParameterList, receiverParameter } = path.node.children;
        const declarator = [call(path, print, "Identifier")];
        const parameters = [];
        if (receiverParameter) {
            parameters.push(call(path, print, "receiverParameter"));
        }
        if (formalParameterList) {
            parameters.push(call(path, print, "formalParameterList"));
        }
        const items = parameters.length
            ? join([",", line], parameters)
            : printDanglingComments(path);
        declarator.push(items.length ? indentInParentheses(items) : "()");
        if (dims) {
            declarator.push(call(path, print, "dims"));
        }
        return declarator;
    },
    receiverParameter(path, print) {
        return join(" ", [
            ...map(path, print, "annotation"),
            call(path, print, "unannType"),
            path.node.children.Identifier
                ? [call(path, print, "Identifier"), ".this"]
                : "this"
        ]);
    },
    formalParameterList(path, print) {
        return printList(path, print, "formalParameter");
    },
    formalParameter: printSingle,
    variableParaRegularParameter(path, print) {
        return join(" ", [
            ...map(path, print, "variableModifier"),
            call(path, print, "unannType"),
            call(path, print, "variableDeclaratorId")
        ]);
    },
    variableArityParameter(path, print) {
        const type = join(" ", [
            ...map(path, print, "variableModifier"),
            call(path, print, "unannType"),
            ...map(path, print, "annotation")
        ]);
        return [type, "... ", call(path, print, "Identifier")];
    },
    variableModifier: printSingle,
    throws(path, print) {
        return ["throws ", call(path, print, "exceptionTypeList")];
    },
    exceptionTypeList(path, print) {
        return join(", ", map(path, print, "exceptionType"));
    },
    exceptionType: printSingle,
    methodBody: printSingle,
    instanceInitializer: printSingle,
    staticInitializer(path, print) {
        return ["static ", call(path, print, "block")];
    },
    constructorDeclaration(path, print) {
        const declaration = [call(path, print, "constructorDeclarator")];
        if (path.node.children.throws) {
            declaration.push(group(indent([line, call(path, print, "throws")])));
        }
        declaration.push(" ", call(path, print, "constructorBody"));
        return printWithModifiers(path, print, "constructorModifier", declaration, true);
    },
    constructorModifier: printSingle,
    constructorDeclarator(path, print) {
        const { children } = path.node;
        const parameters = [];
        if (children.receiverParameter) {
            parameters.push(call(path, print, "receiverParameter"));
        }
        if (children.formalParameterList) {
            parameters.push(call(path, print, "formalParameterList"));
        }
        const header = [call(path, print, "simpleTypeName")];
        header.push(parameters.length
            ? indentInParentheses(join([",", line], parameters))
            : "()");
        return children.typeParameters
            ? [call(path, print, "typeParameters"), " ", ...header]
            : header;
    },
    simpleTypeName: printSingle,
    constructorBody(path, print) {
        const { children } = path.node;
        const statements = [];
        if (children.explicitConstructorInvocation) {
            statements.push(call(path, print, "explicitConstructorInvocation"));
        }
        if (children.blockStatements) {
            statements.push(call(path, print, "blockStatements"));
        }
        return printBlock(path, statements);
    },
    explicitConstructorInvocation: printSingle,
    unqualifiedExplicitConstructorInvocation(path, print) {
        const { children } = path.node;
        const invocation = [];
        if (children.typeArguments) {
            invocation.push(call(path, print, "typeArguments"));
        }
        invocation.push(children.Super ? "super" : "this");
        if (children.argumentList) {
            invocation.push(group(["(", call(path, print, "argumentList"), ")"]));
        }
        else {
            invocation.push(indentInParentheses(printDanglingComments(path), { shouldBreak: true }));
        }
        invocation.push(";");
        return invocation;
    },
    qualifiedExplicitConstructorInvocation(path, print) {
        const { children } = path.node;
        const invocation = [call(path, print, "expressionName"), "."];
        if (children.typeArguments) {
            invocation.push(call(path, print, "typeArguments"));
        }
        invocation.push("super");
        if (children.argumentList) {
            invocation.push(group(["(", call(path, print, "argumentList"), ")"]));
        }
        else {
            invocation.push(indentInParentheses(printDanglingComments(path), { shouldBreak: true }));
        }
        invocation.push(";");
        return invocation;
    },
    enumDeclaration(path, print) {
        const header = ["enum", call(path, print, "typeIdentifier")];
        if (path.node.children.classImplements) {
            header.push(call(path, print, "classImplements"));
        }
        return join(" ", [...header, call(path, print, "enumBody")]);
    },
    enumBody(path, print, options) {
        var _a;
        const { children } = path.node;
        const contents = [];
        const hasNonEmptyDeclaration = ((_a = children.enumBodyDeclarations) !== null && _a !== void 0 ? _a : [])
            .flatMap(({ children }) => { var _a; return (_a = children.classBodyDeclaration) !== null && _a !== void 0 ? _a : []; })
            .some(({ children }) => { var _a; return !((_a = children.classMemberDeclaration) === null || _a === void 0 ? void 0 : _a[0].children.Semicolon); });
        if (children.enumConstantList) {
            contents.push(call(path, print, "enumConstantList"));
            if (!hasNonEmptyDeclaration && options.trailingComma !== "none") {
                contents.push(",");
            }
        }
        if (hasNonEmptyDeclaration) {
            contents.push(";", hardline, call(path, print, "enumBodyDeclarations"));
        }
        return printBlock(path, contents.length ? [contents] : []);
    },
    enumConstantList(path, print) {
        return join([",", hardline], map(path, constantPath => {
            const constant = print(constantPath);
            const { node, previous } = constantPath;
            return !previous ||
                lineStartWithComments(node) <= lineEndWithComments(previous) + 1
                ? constant
                : [hardline, constant];
        }, "enumConstant"));
    },
    enumConstant(path, print) {
        const { argumentList, classBody } = path.node.children;
        const initializer = [call(path, print, "Identifier")];
        if (argumentList) {
            initializer.push(group(["(", call(path, print, "argumentList"), ")"]));
        }
        if (classBody) {
            initializer.push(" ", call(path, print, "classBody"));
        }
        return printWithModifiers(path, print, "enumConstantModifier", initializer);
    },
    enumConstantModifier: printSingle,
    enumBodyDeclarations(path, print) {
        return join(hardline, printClassBodyDeclarations(path, print));
    },
    recordDeclaration(path, print) {
        const { children } = path.node;
        const header = ["record ", call(path, print, "typeIdentifier")];
        if (children.typeParameters) {
            header.push(call(path, print, "typeParameters"));
        }
        header.push(call(path, print, "recordHeader"));
        if (children.classImplements) {
            header.push(" ", call(path, print, "classImplements"));
        }
        return [group(header), " ", call(path, print, "recordBody")];
    },
    recordHeader(path, print) {
        return path.node.children.recordComponentList
            ? indentInParentheses(call(path, print, "recordComponentList"))
            : indentInParentheses(printDanglingComments(path), { shouldBreak: true });
    },
    recordComponentList(path, print) {
        return join([",", line], map(path, componentPath => {
            const { node, previous } = componentPath;
            const blankLine = previous &&
                lineStartWithComments(node) > lineEndWithComments(previous) + 1;
            const component = print(componentPath);
            return blankLine ? [softline, component] : component;
        }, "recordComponent"));
    },
    recordComponent(path, print) {
        const { children } = path.node;
        const component = [call(path, print, "unannType")];
        if (children.Identifier ||
            children.variableArityRecordComponent[0].children.annotation) {
            component.push(" ");
        }
        const suffixKey = onlyDefinedKey(children, [
            "Identifier",
            "variableArityRecordComponent"
        ]);
        component.push(call(path, print, suffixKey));
        return group(join(line, [...map(path, print, "recordComponentModifier"), component]));
    },
    variableArityRecordComponent(path, print) {
        return [
            ...join(" ", map(path, print, "annotation")),
            "... ",
            call(path, print, "Identifier")
        ];
    },
    recordComponentModifier: printSingle,
    recordBody(path, print) {
        const declarations = [];
        let previousRequiresPadding = false;
        each(path, declarationPath => {
            var _a, _b, _c, _d;
            const declaration = print(declarationPath);
            if (declaration === "") {
                return;
            }
            const { node, previous } = declarationPath;
            const fieldDeclaration = (_c = (_b = (_a = node.children.classBodyDeclaration) === null || _a === void 0 ? void 0 : _a[0].children.classMemberDeclaration) === null || _b === void 0 ? void 0 : _b[0].children.fieldDeclaration) === null || _c === void 0 ? void 0 : _c[0].children;
            const currentRequiresPadding = !fieldDeclaration ||
                hasDeclarationAnnotations((_d = fieldDeclaration.fieldModifier) !== null && _d !== void 0 ? _d : []);
            const blankLine = declarations.length > 0 &&
                (previousRequiresPadding ||
                    currentRequiresPadding ||
                    lineStartWithComments(node) > lineEndWithComments(previous) + 1);
            declarations.push(blankLine ? [hardline, declaration] : declaration);
            previousRequiresPadding = currentRequiresPadding;
        }, "recordBodyDeclaration");
        return printBlock(path, declarations);
    },
    recordBodyDeclaration: printSingle,
    compactConstructorDeclaration(path, print) {
        const declaration = [
            call(path, print, "simpleTypeName"),
            " ",
            call(path, print, "constructorBody")
        ];
        return printWithModifiers(path, print, "constructorModifier", declaration, true);
    }
};
function printClassBodyDeclarations(path, print) {
    var _a;
    if (!path.node.children.classBodyDeclaration) {
        return [];
    }
    const declarations = [];
    let previousRequiresPadding = path.node.name === "enumBodyDeclarations" ||
        ((_a = path.grandparent) === null || _a === void 0 ? void 0 : _a.name) ===
            "normalClassDeclaration";
    each(path, declarationPath => {
        var _a, _b, _c;
        const declaration = print(declarationPath);
        if (declaration === "") {
            return;
        }
        const { node, previous } = declarationPath;
        const fieldDeclaration = (_b = (_a = node.children.classMemberDeclaration) === null || _a === void 0 ? void 0 : _a[0].children.fieldDeclaration) === null || _b === void 0 ? void 0 : _b[0].children;
        const currentRequiresPadding = fieldDeclaration
            ? hasDeclarationAnnotations((_c = fieldDeclaration.fieldModifier) !== null && _c !== void 0 ? _c : [])
            : true;
        const blankLine = previousRequiresPadding ||
            (declarations.length > 0 &&
                (currentRequiresPadding ||
                    lineStartWithComments(node) > lineEndWithComments(previous) + 1));
        declarations.push(blankLine ? [hardline, declaration] : declaration);
        previousRequiresPadding = currentRequiresPadding;
    }, "classBodyDeclaration");
    return declarations;
}
