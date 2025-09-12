import { builders } from "prettier/doc";
import { printClassPermits, printSingle } from "./helpers.js";
declare const _default: {
    interfaceDeclaration(path: import("prettier").AstPath<import("java-parser").InterfaceDeclarationCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    normalInterfaceDeclaration(path: import("prettier").AstPath<import("java-parser").NormalInterfaceDeclarationCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    interfaceModifier: typeof printSingle;
    interfaceExtends(path: import("prettier").AstPath<import("java-parser").InterfaceExtendsCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Group;
    interfacePermits: typeof printClassPermits;
    interfaceBody(path: import("prettier").AstPath<import("java-parser").InterfaceBodyCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Group | "{}" | (string | builders.Indent | builders.Hardline)[];
    interfaceMemberDeclaration(path: import("prettier").AstPath<import("java-parser").InterfaceMemberDeclarationCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc;
    constantDeclaration(path: import("prettier").AstPath<import("java-parser").ConstantDeclarationCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    constantModifier: typeof printSingle;
    interfaceMethodDeclaration(path: import("prettier").AstPath<import("java-parser").InterfaceMethodDeclarationCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    interfaceMethodModifier: typeof printSingle;
    annotationInterfaceDeclaration(path: import("prettier").AstPath<import("java-parser").AnnotationInterfaceDeclarationCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    annotationInterfaceBody(path: import("prettier").AstPath<import("java-parser").AnnotationInterfaceBodyCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Group | "{}" | (string | builders.Indent | builders.Hardline)[];
    annotationInterfaceMemberDeclaration(path: import("prettier").AstPath<import("java-parser").AnnotationInterfaceMemberDeclarationCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc;
    annotationInterfaceElementDeclaration(path: import("prettier").AstPath<import("java-parser").AnnotationInterfaceElementDeclarationCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    annotationInterfaceElementModifier: typeof printSingle;
    defaultValue(path: import("prettier").AstPath<import("java-parser").DefaultValueCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    annotation(path: import("prettier").AstPath<import("java-parser").AnnotationCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    elementValuePairList(path: import("prettier").AstPath<import("java-parser").ElementValuePairListCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    elementValuePair(path: import("prettier").AstPath<import("java-parser").ElementValuePairCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    elementValue: typeof printSingle;
    elementValueArrayInitializer(path: import("prettier").AstPath<import("java-parser").ElementValueArrayInitializerCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn, options: import("./helpers.js").JavaParserOptions): builders.Group | "{}";
    elementValueList(path: import("prettier").AstPath<import("java-parser").ElementValueListCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Group;
};
export default _default;
