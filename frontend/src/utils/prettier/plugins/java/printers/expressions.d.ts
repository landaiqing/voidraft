import type { StringTemplateCstNode, TextBlockTemplateCstNode } from "java-parser";
import type { AstPath } from "prettier";
import { builders } from "prettier/doc";
import type { JavaComment } from "../comments.js";
import { printSingle, type JavaPrintFn } from "./helpers.js";
declare const _default: {
    expression: typeof printSingle;
    lambdaExpression(path: AstPath<import("java-parser").LambdaExpressionCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn, _: import("./helpers.js").JavaParserOptions, args?: unknown): builders.Doc[];
    lambdaParameters(path: AstPath<import("java-parser").LambdaParametersCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn, options: import("./helpers.js").JavaParserOptions): builders.Doc;
    lambdaParametersWithBraces(path: AstPath<import("java-parser").LambdaParametersWithBracesCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn, options: import("./helpers.js").JavaParserOptions): builders.Doc;
    lambdaParameterList: typeof printSingle;
    conciseLambdaParameterList(path: AstPath<import("java-parser").ConciseLambdaParameterListCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    normalLambdaParameterList(path: AstPath<import("java-parser").NormalLambdaParameterListCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    normalLambdaParameter: typeof printSingle;
    regularLambdaParameter(path: AstPath<import("java-parser").RegularLambdaParameterCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    lambdaParameterType: typeof printSingle;
    conciseLambdaParameter: typeof printSingle;
    lambdaBody: typeof printSingle;
    conditionalExpression(path: AstPath<import("java-parser").ConditionalExpressionCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Doc;
    binaryExpression(path: AstPath<import("java-parser").BinaryExpressionCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn, options: import("./helpers.js").JavaParserOptions): builders.Doc;
    unaryExpression(path: AstPath<import("java-parser").UnaryExpressionCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    unaryExpressionNotPlusMinus(path: AstPath<import("java-parser").UnaryExpressionNotPlusMinusCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    primary(path: AstPath<import("java-parser").PrimaryCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Doc;
    primaryPrefix: typeof printSingle;
    primarySuffix(path: AstPath<import("java-parser").PrimarySuffixCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Doc;
    fqnOrRefType(path: AstPath<import("java-parser").FqnOrRefTypeCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn, _: import("./helpers.js").JavaParserOptions, args: unknown): builders.Doc[];
    fqnOrRefTypePartFirst(path: AstPath<import("java-parser").FqnOrRefTypePartFirstCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    fqnOrRefTypePartRest(path: AstPath<import("java-parser").FqnOrRefTypePartRestCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    fqnOrRefTypePartCommon(path: AstPath<import("java-parser").FqnOrRefTypePartCommonCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Doc;
    parenthesisExpression(path: AstPath<import("java-parser").ParenthesisExpressionCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Group | "()" | (string | builders.Indent)[];
    castExpression: typeof printSingle;
    primitiveCastExpression(path: AstPath<import("java-parser").PrimitiveCastExpressionCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    referenceTypeCastExpression(path: AstPath<import("java-parser").ReferenceTypeCastExpressionCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    newExpression: typeof printSingle;
    unqualifiedClassInstanceCreationExpression(path: AstPath<import("java-parser").UnqualifiedClassInstanceCreationExpressionCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    classOrInterfaceTypeToInstantiate(path: AstPath<import("java-parser").ClassOrInterfaceTypeToInstantiateCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    typeArgumentsOrDiamond: typeof printSingle;
    diamond(): string;
    methodInvocationSuffix(path: AstPath<import("java-parser").MethodInvocationSuffixCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Group | "()";
    argumentList(path: AstPath<import("java-parser").ArgumentListCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Group | (builders.Indent | builders.Softline)[] | (builders.BreakParent | builders.Group)[];
    arrayCreationExpression(path: AstPath<import("java-parser").ArrayCreationExpressionCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    arrayCreationExpressionWithoutInitializerSuffix(path: AstPath<import("java-parser").ArrayCreationExpressionWithoutInitializerSuffixCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Doc;
    arrayCreationWithInitializerSuffix(path: AstPath<import("java-parser").ArrayCreationWithInitializerSuffixCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    dimExprs(path: AstPath<import("java-parser").DimExprsCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    dimExpr(path: AstPath<import("java-parser").DimExprCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    classLiteralSuffix(path: AstPath<import("java-parser").ClassLiteralSuffixCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    arrayAccessSuffix(path: AstPath<import("java-parser").ArrayAccessSuffixCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    methodReferenceSuffix(path: AstPath<import("java-parser").MethodReferenceSuffixCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    templateArgument: typeof printSingle;
    template: typeof printSingle;
    stringTemplate(path: AstPath<StringTemplateCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Indent;
    textBlockTemplate(path: AstPath<TextBlockTemplateCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Indent;
    embeddedExpression: typeof printSingle;
    pattern: typeof printSingle;
    typePattern: typeof printSingle;
    recordPattern(path: AstPath<import("java-parser").RecordPatternCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    componentPatternList(path: AstPath<import("java-parser").ComponentPatternListCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    componentPattern: typeof printSingle;
    matchAllPattern: typeof printSingle;
    guard(path: AstPath<import("java-parser").GuardCstNode & {
        comments?: JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
};
export default _default;
