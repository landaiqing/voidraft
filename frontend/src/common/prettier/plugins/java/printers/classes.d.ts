import type { ClassBodyCstNode, EnumBodyDeclarationsCstNode } from "java-parser";
import type { AstPath } from "prettier";
import { builders } from "prettier/doc";
import { printClassPermits, printClassType, printSingle, type JavaPrintFn } from "./helpers.js";
declare const _default: {
    classDeclaration(path: AstPath<import("java-parser").ClassDeclarationCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    normalClassDeclaration(path: AstPath<import("java-parser").NormalClassDeclarationCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    classModifier: typeof printSingle;
    typeParameters(path: AstPath<import("java-parser").TypeParametersCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Group;
    typeParameterList(path: AstPath<import("java-parser").TypeParameterListCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    classExtends(path: AstPath<import("java-parser").ClassExtendsCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    classImplements(path: AstPath<import("java-parser").ClassImplementsCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Group;
    classPermits: typeof printClassPermits;
    interfaceTypeList(path: AstPath<import("java-parser").InterfaceTypeListCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Group;
    classBody(path: AstPath<ClassBodyCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Group | "{}" | (string | builders.Indent | builders.Hardline)[];
    classBodyDeclaration: typeof printSingle;
    classMemberDeclaration(path: AstPath<import("java-parser").ClassMemberDeclarationCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc;
    fieldDeclaration(path: AstPath<import("java-parser").FieldDeclarationCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    fieldModifier: typeof printSingle;
    variableDeclaratorList(path: AstPath<import("java-parser").VariableDeclaratorListCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Group | builders.Doc[];
    variableDeclarator(path: AstPath<import("java-parser").VariableDeclaratorCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc;
    variableDeclaratorId(path: AstPath<import("java-parser").VariableDeclaratorIdCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc;
    variableInitializer: typeof printSingle;
    unannType: typeof printSingle;
    unannPrimitiveTypeWithOptionalDimsSuffix(path: AstPath<import("java-parser").UnannPrimitiveTypeWithOptionalDimsSuffixCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc;
    unannPrimitiveType: typeof printSingle;
    unannReferenceType(path: AstPath<import("java-parser").UnannReferenceTypeCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc;
    unannClassOrInterfaceType: typeof printSingle;
    unannClassType: typeof printClassType;
    unannInterfaceType: typeof printSingle;
    unannTypeVariable: typeof printSingle;
    methodDeclaration(path: AstPath<import("java-parser").MethodDeclarationCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    methodModifier: typeof printSingle;
    methodHeader(path: AstPath<import("java-parser").MethodHeaderCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Group;
    result: typeof printSingle;
    methodDeclarator(path: AstPath<import("java-parser").MethodDeclaratorCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    receiverParameter(path: AstPath<import("java-parser").ReceiverParameterCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    formalParameterList(path: AstPath<import("java-parser").FormalParameterListCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    formalParameter: typeof printSingle;
    variableParaRegularParameter(path: AstPath<import("java-parser").VariableParaRegularParameterCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    variableArityParameter(path: AstPath<import("java-parser").VariableArityParameterCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    variableModifier: typeof printSingle;
    throws(path: AstPath<import("java-parser").ThrowsCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    exceptionTypeList(path: AstPath<import("java-parser").ExceptionTypeListCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    exceptionType: typeof printSingle;
    methodBody: typeof printSingle;
    instanceInitializer: typeof printSingle;
    staticInitializer(path: AstPath<import("java-parser").StaticInitializerCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    constructorDeclaration(path: AstPath<import("java-parser").ConstructorDeclarationCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    constructorModifier: typeof printSingle;
    constructorDeclarator(path: AstPath<import("java-parser").ConstructorDeclaratorCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    simpleTypeName: typeof printSingle;
    constructorBody(path: AstPath<import("java-parser").ConstructorBodyCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Group | "{}" | (string | builders.Indent | builders.Hardline)[];
    explicitConstructorInvocation: typeof printSingle;
    unqualifiedExplicitConstructorInvocation(path: AstPath<import("java-parser").UnqualifiedExplicitConstructorInvocationCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    qualifiedExplicitConstructorInvocation(path: AstPath<import("java-parser").QualifiedExplicitConstructorInvocationCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    enumDeclaration(path: AstPath<import("java-parser").EnumDeclarationCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    enumBody(path: AstPath<import("java-parser").EnumBodyCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn, options: import("./helpers.js").JavaParserOptions): builders.Group | "{}" | (string | builders.Indent | builders.Hardline)[];
    enumConstantList(path: AstPath<import("java-parser").EnumConstantListCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    enumConstant(path: AstPath<import("java-parser").EnumConstantCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    enumConstantModifier: typeof printSingle;
    enumBodyDeclarations(path: AstPath<EnumBodyDeclarationsCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    recordDeclaration(path: AstPath<import("java-parser").RecordDeclarationCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    recordHeader(path: AstPath<import("java-parser").RecordHeaderCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Group | "()";
    recordComponentList(path: AstPath<import("java-parser").RecordComponentListCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    recordComponent(path: AstPath<import("java-parser").RecordComponentCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Group;
    variableArityRecordComponent(path: AstPath<import("java-parser").VariableArityRecordComponentCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    recordComponentModifier: typeof printSingle;
    recordBody(path: AstPath<import("java-parser").RecordBodyCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Group | "{}" | (string | builders.Indent | builders.Hardline)[];
    recordBodyDeclaration: typeof printSingle;
    compactConstructorDeclaration(path: AstPath<import("java-parser").CompactConstructorDeclarationCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
};
export default _default;
