import { builders } from "prettier/doc";
import { printSingle } from "./helpers.js";
declare const _default: {
    block(path: import("prettier").AstPath<import("java-parser").BlockCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Group | "{}" | (string | builders.Indent | builders.Hardline)[];
    blockStatements(path: import("prettier").AstPath<import("java-parser").BlockStatementsCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    blockStatement: typeof printSingle;
    localVariableDeclarationStatement(path: import("prettier").AstPath<import("java-parser").LocalVariableDeclarationStatementCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    localVariableDeclaration(path: import("prettier").AstPath<import("java-parser").LocalVariableDeclarationCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    localVariableType: typeof printSingle;
    statement: typeof printSingle;
    statementWithoutTrailingSubstatement: typeof printSingle;
    emptyStatement(): string;
    labeledStatement(path: import("prettier").AstPath<import("java-parser").LabeledStatementCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    expressionStatement(path: import("prettier").AstPath<import("java-parser").ExpressionStatementCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    statementExpression: typeof printSingle;
    ifStatement(path: import("prettier").AstPath<import("java-parser").IfStatementCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    assertStatement(path: import("prettier").AstPath<import("java-parser").AssertStatementCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    switchStatement(path: import("prettier").AstPath<import("java-parser").SwitchStatementCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    switchBlock(path: import("prettier").AstPath<import("java-parser").SwitchBlockCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Group | "{}" | (string | builders.Indent | builders.Hardline)[];
    switchBlockStatementGroup(path: import("prettier").AstPath<import("java-parser").SwitchBlockStatementGroupCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    switchLabel(path: import("prettier").AstPath<import("java-parser").SwitchLabelCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): "default" | builders.Group | builders.Doc[];
    switchRule(path: import("prettier").AstPath<import("java-parser").SwitchRuleCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    caseConstant: typeof printSingle;
    casePattern: typeof printSingle;
    whileStatement(path: import("prettier").AstPath<import("java-parser").WhileStatementCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    doStatement(path: import("prettier").AstPath<import("java-parser").DoStatementCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): (string | builders.Group | builders.Doc[])[];
    forStatement: typeof printSingle;
    basicForStatement(path: import("prettier").AstPath<import("java-parser").BasicForStatementCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    forInit: typeof printSingle;
    forUpdate: typeof printSingle;
    statementExpressionList(path: import("prettier").AstPath<import("java-parser").StatementExpressionListCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Group;
    enhancedForStatement(path: import("prettier").AstPath<import("java-parser").EnhancedForStatementCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Group;
    breakStatement(path: import("prettier").AstPath<import("java-parser").BreakStatementCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[] | "break;";
    continueStatement(path: import("prettier").AstPath<import("java-parser").ContinueStatementCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[] | "continue;";
    returnStatement(path: import("prettier").AstPath<import("java-parser").ReturnStatementCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    throwStatement(path: import("prettier").AstPath<import("java-parser").ThrowStatementCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    synchronizedStatement(path: import("prettier").AstPath<import("java-parser").SynchronizedStatementCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    tryStatement(path: import("prettier").AstPath<import("java-parser").TryStatementCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc;
    catches(path: import("prettier").AstPath<import("java-parser").CatchesCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    catchClause(path: import("prettier").AstPath<import("java-parser").CatchClauseCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    catchFormalParameter(path: import("prettier").AstPath<import("java-parser").CatchFormalParameterCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    catchType(path: import("prettier").AstPath<import("java-parser").CatchTypeCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    finally(path: import("prettier").AstPath<import("java-parser").FinallyCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    tryWithResourcesStatement(path: import("prettier").AstPath<import("java-parser").TryWithResourcesStatementCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    resourceSpecification(path: import("prettier").AstPath<import("java-parser").ResourceSpecificationCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Group | "()";
    resourceList(path: import("prettier").AstPath<import("java-parser").ResourceListCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    resource: typeof printSingle;
    yieldStatement(path: import("prettier").AstPath<import("java-parser").YieldStatementCstNode & {
        comments?: import("../comments.js").JavaComment[];
    }>, print: import("./helpers.js").JavaPrintFn): builders.Doc[];
    variableAccess: typeof printSingle;
};
export default _default;
