import type { ExportsModuleDirectiveCstNode, ImportDeclarationCstNode, OpensModuleDirectiveCstNode } from "java-parser";
import type { AstPath } from "prettier";
import { builders } from "prettier/doc";
import { printSingle, type JavaPrintFn } from "./helpers.js";
declare const _default: {
    compilationUnit(path: AstPath<import("java-parser").CompilationUnitCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    ordinaryCompilationUnit(path: AstPath<import("java-parser").OrdinaryCompilationUnitCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    modularCompilationUnit(path: AstPath<import("java-parser").ModularCompilationUnitCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    packageDeclaration(path: AstPath<import("java-parser").PackageDeclarationCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    packageModifier: typeof printSingle;
    importDeclaration(path: AstPath<ImportDeclarationCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc;
    typeDeclaration(path: AstPath<import("java-parser").TypeDeclarationCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc;
    moduleDeclaration(path: AstPath<import("java-parser").ModuleDeclarationCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    moduleDirective: typeof printSingle;
    requiresModuleDirective(path: AstPath<import("java-parser").RequiresModuleDirectiveCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    exportsModuleDirective(path: AstPath<ExportsModuleDirectiveCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    opensModuleDirective(path: AstPath<OpensModuleDirectiveCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    usesModuleDirective(path: AstPath<import("java-parser").UsesModuleDirectiveCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    providesModuleDirective(path: AstPath<import("java-parser").ProvidesModuleDirectiveCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: JavaPrintFn): builders.Doc[];
    requiresModifier: typeof printSingle;
};
export default _default;
