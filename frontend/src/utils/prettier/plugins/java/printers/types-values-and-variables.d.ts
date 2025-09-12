import { builders } from "prettier/doc";
import { printClassType, printSingle } from "./helpers.js";
declare const _default: {
    primitiveType(path: import("prettier").AstPath<import("java-parser").PrimitiveTypeCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    numericType: typeof printSingle;
    integralType: typeof printSingle;
    floatingPointType: typeof printSingle;
    referenceType(path: import("prettier").AstPath<import("java-parser").ReferenceTypeCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    classOrInterfaceType: typeof printSingle;
    classType: typeof printClassType;
    interfaceType: typeof printSingle;
    typeVariable(path: import("prettier").AstPath<import("java-parser").TypeVariableCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    dims(path: import("prettier").AstPath<import("java-parser").DimsCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    typeParameter(path: import("prettier").AstPath<import("java-parser").TypeParameterCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    typeParameterModifier: typeof printSingle;
    typeBound(path: import("prettier").AstPath<import("java-parser").TypeBoundCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    additionalBound(path: import("prettier").AstPath<import("java-parser").AdditionalBoundCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    typeArguments(path: import("prettier").AstPath<import("java-parser").TypeArgumentsCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Group;
    typeArgumentList(path: import("prettier").AstPath<import("java-parser").TypeArgumentListCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    typeArgument: typeof printSingle;
    wildcard(path: import("prettier").AstPath<import("java-parser").WildcardCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    wildcardBounds(path: import("prettier").AstPath<import("java-parser").WildcardBoundsCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
};
export default _default;
