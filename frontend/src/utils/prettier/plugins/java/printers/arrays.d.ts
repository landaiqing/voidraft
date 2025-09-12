declare const _default: {
    arrayInitializer(path: import("prettier").AstPath<import("java-parser").ArrayInitializerCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn, options: import("./helpers.js").JavaParserOptions): import("prettier/doc.js").builders.Group | "{}";
    variableInitializerList(path: import("prettier").AstPath<import("java-parser").VariableInitializerListCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): import("prettier/doc.js").builders.Doc[];
};
export default _default;
