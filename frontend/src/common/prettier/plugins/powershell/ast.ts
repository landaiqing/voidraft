/**
 * PowerShell AST 节点定义
 * 定义抽象语法树的各种节点类型
 */

import { Token } from './lexer';

export interface ASTNode {
    type: string;
    start: number;
    end: number;
    line: number;
    column: number;
}

export interface ScriptBlockAst extends ASTNode {
    type: 'ScriptBlock';
    statements: StatementAst[];
}

export interface StatementAst extends ASTNode {
    type: string;
}

export interface ExpressionAst extends ASTNode {
    type: string;
}

// 管道表达式
export interface PipelineAst extends StatementAst {
    type: 'Pipeline';
    elements: PipelineElementAst[];
}

export interface PipelineElementAst extends ASTNode {
    type: 'PipelineElement';
    expression: ExpressionAst;
}

// 命令表达式
export interface CommandAst extends ExpressionAst {
    type: 'Command';
    commandName: string;
    parameters: ParameterAst[];
    arguments: ExpressionAst[];
}

export interface ParameterAst extends ASTNode {
    type: 'Parameter';
    name: string;
    value?: ExpressionAst;
}

// 赋值表达式
export interface AssignmentAst extends StatementAst {
    type: 'Assignment';
    left: ExpressionAst;
    operator: string;
    right: ExpressionAst;
}

// 变量表达式
export interface VariableAst extends ExpressionAst {
    type: 'Variable';
    name: string;
}

// 字面量表达式
export interface LiteralAst extends ExpressionAst {
    type: 'Literal';
    value: any;
    literalType: 'String' | 'Number' | 'Boolean' | 'Null';
}

// 数组表达式
export interface ArrayAst extends ExpressionAst {
    type: 'Array';
    elements: ExpressionAst[];
}

// 哈希表表达式
export interface HashtableAst extends ExpressionAst {
    type: 'Hashtable';
    entries: HashtableEntryAst[];
}

export interface HashtableEntryAst extends ASTNode {
    type: 'HashtableEntry';
    key: ExpressionAst;
    value: ExpressionAst;
}

// 函数定义
export interface FunctionDefinitionAst extends StatementAst {
    type: 'FunctionDefinition';
    name: string;
    parameters: ParameterAst[];
    body: ScriptBlockAst;
}

// 控制流结构
export interface IfStatementAst extends StatementAst {
    type: 'IfStatement';
    condition: ExpressionAst;
    ifBody: ScriptBlockAst;
    elseIfClauses: ElseIfClauseAst[];
    elseBody?: ScriptBlockAst;
}

export interface ElseIfClauseAst extends ASTNode {
    type: 'ElseIfClause';
    condition: ExpressionAst;
    body: ScriptBlockAst;
}

export interface WhileStatementAst extends StatementAst {
    type: 'WhileStatement';
    condition: ExpressionAst;
    body: ScriptBlockAst;
}

export interface ForStatementAst extends StatementAst {
    type: 'ForStatement';
    initializer?: ExpressionAst;
    condition?: ExpressionAst;
    iterator?: ExpressionAst;
    body: ScriptBlockAst;
}

export interface ForEachStatementAst extends StatementAst {
    type: 'ForEachStatement';
    variable: VariableAst;
    iterable: ExpressionAst;
    body: ScriptBlockAst;
}

export interface SwitchStatementAst extends StatementAst {
    type: 'SwitchStatement';
    value: ExpressionAst;
    clauses: SwitchClauseAst[];
}

export interface SwitchClauseAst extends ASTNode {
    type: 'SwitchClause';
    pattern: ExpressionAst;
    body: ScriptBlockAst;
}

export interface TryStatementAst extends StatementAst {
    type: 'TryStatement';
    body: ScriptBlockAst;
    catchClauses: CatchClauseAst[];
    finallyClause?: FinallyClauseAst;
}

export interface CatchClauseAst extends ASTNode {
    type: 'CatchClause';
    exceptionType?: string;
    body: ScriptBlockAst;
}

export interface FinallyClauseAst extends ASTNode {
    type: 'FinallyClause';
    body: ScriptBlockAst;
}

// 二元操作表达式
export interface BinaryExpressionAst extends ExpressionAst {
    type: 'BinaryExpression';
    left: ExpressionAst;
    operator: string;
    right: ExpressionAst;
}

// 一元操作表达式
export interface UnaryExpressionAst extends ExpressionAst {
    type: 'UnaryExpression';
    operator: string;
    operand: ExpressionAst;
}

// 括号表达式
export interface ParenthesizedExpressionAst extends ExpressionAst {
    type: 'ParenthesizedExpression';
    expression: ExpressionAst;
}

// 方法调用表达式
export interface MethodCallAst extends ExpressionAst {
    type: 'MethodCall';
    object: ExpressionAst;
    methodName: string;
    arguments: ExpressionAst[];
}

// 属性访问表达式
export interface PropertyAccessAst extends ExpressionAst {
    type: 'PropertyAccess';
    object: ExpressionAst;
    propertyName: string;
}

// 索引访问表达式
export interface IndexAccessAst extends ExpressionAst {
    type: 'IndexAccess';
    object: ExpressionAst;
    index: ExpressionAst;
}

// 注释节点
export interface CommentAst extends ASTNode {
    type: 'Comment';
    text: string;
    isMultiline: boolean;
}

// 空白节点
export interface WhitespaceAst extends ASTNode {
    type: 'Whitespace';
    text: string;
}

// 工厂函数，用于创建AST节点
export class ASTNodeFactory {
    static createScriptBlock(statements: StatementAst[], start: number, end: number, line: number, column: number): ScriptBlockAst {
        return {
            type: 'ScriptBlock',
            statements,
            start,
            end,
            line,
            column
        };
    }

    static createPipeline(elements: PipelineElementAst[], start: number, end: number, line: number, column: number): PipelineAst {
        return {
            type: 'Pipeline',
            elements,
            start,
            end,
            line,
            column
        };
    }

    static createCommand(commandName: string, parameters: ParameterAst[], args: ExpressionAst[], start: number, end: number, line: number, column: number): CommandAst {
        return {
            type: 'Command',
            commandName,
            parameters,
            arguments: args,
            start,
            end,
            line,
            column
        };
    }

    static createAssignment(left: ExpressionAst, operator: string, right: ExpressionAst, start: number, end: number, line: number, column: number): AssignmentAst {
        return {
            type: 'Assignment',
            left,
            operator,
            right,
            start,
            end,
            line,
            column
        };
    }

    static createVariable(name: string, start: number, end: number, line: number, column: number): VariableAst {
        return {
            type: 'Variable',
            name,
            start,
            end,
            line,
            column
        };
    }

    static createLiteral(value: any, literalType: 'String' | 'Number' | 'Boolean' | 'Null', start: number, end: number, line: number, column: number): LiteralAst {
        return {
            type: 'Literal',
            value,
            literalType,
            start,
            end,
            line,
            column
        };
    }

    static createBinaryExpression(left: ExpressionAst, operator: string, right: ExpressionAst, start: number, end: number, line: number, column: number): BinaryExpressionAst {
        return {
            type: 'BinaryExpression',
            left,
            operator,
            right,
            start,
            end,
            line,
            column
        };
    }

    static createIfStatement(condition: ExpressionAst, ifBody: ScriptBlockAst, elseIfClauses: ElseIfClauseAst[], elseBody: ScriptBlockAst | undefined, start: number, end: number, line: number, column: number): IfStatementAst {
        return {
            type: 'IfStatement',
            condition,
            ifBody,
            elseIfClauses,
            elseBody,
            start,
            end,
            line,
            column
        };
    }

    static createFunctionDefinition(name: string, parameters: ParameterAst[], body: ScriptBlockAst, start: number, end: number, line: number, column: number): FunctionDefinitionAst {
        return {
            type: 'FunctionDefinition',
            name,
            parameters,
            body,
            start,
            end,
            line,
            column
        };
    }

    static createComment(text: string, isMultiline: boolean, start: number, end: number, line: number, column: number): CommentAst {
        return {
            type: 'Comment',
            text,
            isMultiline,
            start,
            end,
            line,
            column
        };
    }
}

// AST访问者模式接口
export interface ASTVisitor<T> {
    visitScriptBlock(node: ScriptBlockAst): T;
    visitPipeline(node: PipelineAst): T;
    visitCommand(node: CommandAst): T;
    visitAssignment(node: AssignmentAst): T;
    visitVariable(node: VariableAst): T;
    visitLiteral(node: LiteralAst): T;
    visitBinaryExpression(node: BinaryExpressionAst): T;
    visitIfStatement(node: IfStatementAst): T;
    visitFunctionDefinition(node: FunctionDefinitionAst): T;
    visitComment(node: CommentAst): T;
}

// AST遍历工具类
export class ASTTraverser {
    static traverse<T>(node: ASTNode, visitor: Partial<ASTVisitor<T>>): T | undefined {
        switch (node.type) {
            case 'ScriptBlock':
                return visitor.visitScriptBlock?.(node as ScriptBlockAst);
            case 'Pipeline':
                return visitor.visitPipeline?.(node as PipelineAst);
            case 'Command':
                return visitor.visitCommand?.(node as CommandAst);
            case 'Assignment':
                return visitor.visitAssignment?.(node as AssignmentAst);
            case 'Variable':
                return visitor.visitVariable?.(node as VariableAst);
            case 'Literal':
                return visitor.visitLiteral?.(node as LiteralAst);
            case 'BinaryExpression':
                return visitor.visitBinaryExpression?.(node as BinaryExpressionAst);
            case 'IfStatement':
                return visitor.visitIfStatement?.(node as IfStatementAst);
            case 'FunctionDefinition':
                return visitor.visitFunctionDefinition?.(node as FunctionDefinitionAst);
            case 'Comment':
                return visitor.visitComment?.(node as CommentAst);
            default:
                return undefined;
        }
    }
}
