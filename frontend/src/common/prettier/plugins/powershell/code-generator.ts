/**
 * PowerShell 代码生成器
 * 遍历AST并根据格式化规则生成格式化的PowerShell代码
 */

import { 
    ASTNode, 
    ScriptBlockAst, 
    StatementAst, 
    ExpressionAst,
    PipelineAst,
    CommandAst,
    AssignmentAst,
    VariableAst,
    LiteralAst,
    BinaryExpressionAst,
    IfStatementAst,
    FunctionDefinitionAst,
    ParameterAst,
    CommentAst,
    PipelineElementAst,
    ElseIfClauseAst,
    ASTTraverser
} from './ast';
import { FormatterRules, FormatterOptions } from './formatter-rules';

export class PowerShellCodeGenerator {
    private rules: FormatterRules;
    private indentLevel: number = 0;
    private output: string[] = [];
    private currentLineLength: number = 0;
    private needsNewline: boolean = false;
    private lastWasComment: boolean = false;

    constructor(options: Partial<FormatterOptions> = {}) {
        this.rules = new FormatterRules(options);
    }

    /**
     * 生成格式化的PowerShell代码
     */
    public generate(ast: ScriptBlockAst, comments: CommentAst[] = []): string {
        this.output = [];
        this.indentLevel = 0;
        this.currentLineLength = 0;
        this.needsNewline = false;
        this.lastWasComment = false;

        // 首先处理文档开头的注释
        this.generateLeadingComments(comments);

        // 生成主体代码
        this.generateScriptBlock(ast);

        // 处理文档末尾
        this.handleFinalNewline();

        const result = this.output.join('');
        return this.postProcess(result);
    }

    private generateScriptBlock(node: ScriptBlockAst): void {
        for (let i = 0; i < node.statements.length; i++) {
            const statement = node.statements[i];
            const nextStatement = i < node.statements.length - 1 ? node.statements[i + 1] : null;

            this.generateStatement(statement);

            // 在语句之间添加适当的空行
            if (nextStatement) {
                this.addStatementSeparation(statement, nextStatement);
            }
        }
    }

    private generateStatement(statement: StatementAst): void {
        switch (statement.type) {
            case 'Pipeline':
                this.generatePipeline(statement as PipelineAst);
                break;
            case 'Assignment':
                this.generateAssignment(statement as AssignmentAst);
                break;
            case 'IfStatement':
                this.generateIfStatement(statement as IfStatementAst);
                break;
            case 'FunctionDefinition':
                this.generateFunctionDefinition(statement as FunctionDefinitionAst);
                break;
            case 'RawText':
                // 处理解析失败时的原始文本
                this.append((statement as any).value);
                return; // 不需要添加额外的换行
            default:
                this.append(`/* Unsupported statement type: ${statement.type} */`);
                break;
        }

        this.ensureNewline();
    }

    private generatePipeline(pipeline: PipelineAst): void {
        if (!this.rules.formatPipelines) {
            // 简单连接所有元素
            for (let i = 0; i < pipeline.elements.length; i++) {
                if (i > 0) {
                    this.append(' | ');
                }
                this.generatePipelineElement(pipeline.elements[i]);
            }
            return;
        }

        const style = this.rules.getPipelineStyle(pipeline.elements.length);
        
        if (style === 'multiline') {
            this.generateMultilinePipeline(pipeline);
        } else {
            this.generateOnelinePipeline(pipeline);
        }
    }

    private generateOnelinePipeline(pipeline: PipelineAst): void {
        for (let i = 0; i < pipeline.elements.length; i++) {
            if (i > 0) {
                this.append(' | ');
            }
            this.generatePipelineElement(pipeline.elements[i]);
        }
    }

    private generateMultilinePipeline(pipeline: PipelineAst): void {
        for (let i = 0; i < pipeline.elements.length; i++) {
            if (i > 0) {
                this.appendLine(' |');
                this.appendIndent();
            }
            this.generatePipelineElement(pipeline.elements[i]);
        }
    }

    private generatePipelineElement(element: PipelineElementAst): void {
        this.generateExpression(element.expression);
    }

    private generateExpression(expression: ExpressionAst): void {
        switch (expression.type) {
            case 'Command':
                this.generateCommand(expression as CommandAst);
                break;
            case 'Variable':
                this.generateVariable(expression as VariableAst);
                break;
            case 'Literal':
                this.generateLiteral(expression as LiteralAst);
                break;
            case 'BinaryExpression':
                this.generateBinaryExpression(expression as BinaryExpressionAst);
                break;
            case 'ParenthesizedExpression':
                this.append('(');
                this.generateExpression((expression as any).expression);
                this.append(')');
                break;
            case 'Array':
                this.generateArray(expression as any);
                break;
            case 'Hashtable':
                this.generateHashtable(expression as any);
                break;
            case 'ScriptBlockExpression':
                this.generateScriptBlockExpression(expression as any);
                break;
            default:
                this.append(`/* Unsupported expression type: ${expression.type} */`);
                break;
        }
    }

    private generateCommand(command: CommandAst): void {
        // 保持cmdlet名称的连字符，不进行破坏性的格式化
        let commandName = command.commandName;
        
        // 只有在明确指定要改变大小写时才进行格式化
        // 但绝对不能删除连字符
        if (this.rules.shouldFormatCommandCase()) {
            commandName = this.rules.formatCommandCase(commandName);
        }
        
        this.append(commandName);

        // 生成参数
        for (const param of command.parameters) {
            this.append(' ');
            this.generateParameter(param);
        }

        // 生成位置参数
        for (const arg of command.arguments) {
            this.append(' ');
            this.generateExpression(arg);
        }
    }

    private generateParameter(parameter: ParameterAst): void {
        const paramName = this.rules.formatParameterCase(parameter.name);
        this.append(paramName);
        
        if (parameter.value) {
            this.append(' ');
            this.generateExpression(parameter.value);
        }
    }

    private generateVariable(variable: VariableAst): void {
        const formattedName = this.rules.formatVariableCase(variable.name);
        this.append(formattedName);
    }

    private generateLiteral(literal: LiteralAst): void {
        if (literal.literalType === 'String') {
            const formattedString = this.rules.formatQuotes(literal.value as string);
            this.append(formattedString);
        } else {
            this.append(String(literal.value));
        }
    }

    private generateBinaryExpression(expression: BinaryExpressionAst): void {
        this.generateExpression(expression.left);
        
        // 根据PowerShell官方规范，属性访问操作符绝对不能加空格
        if (expression.operator === '.' || 
            expression.operator === '::' || 
            expression.operator === '[' || 
            expression.operator === ']' ||
            expression.operator === '@{') {
            // 属性访问是PowerShell面向对象的核心，必须保持紧凑
            this.append(expression.operator);
        } else {
            // 使用格式化规则处理其他操作符
            const formattedOperator = this.rules.formatOperatorSpacing(expression.operator);
            this.append(formattedOperator);
        }
        
        this.generateExpression(expression.right);
    }

    private generateAssignment(assignment: AssignmentAst): void {
        this.generateExpression(assignment.left);
        
        const formattedOperator = this.rules.formatOperatorSpacing(assignment.operator);
        this.append(formattedOperator);
        
        this.generateExpression(assignment.right);
    }

    private generateIfStatement(ifStmt: IfStatementAst): void {
        // if 条件
        this.append('if ');
        this.append(this.rules.formatParentheses(''));
        this.append('(');
        this.generateExpression(ifStmt.condition);
        this.append(')');
        
        // if 主体
        this.append(this.rules.getBraceStart());
        this.appendLine('');
        this.indent();
        this.generateScriptBlock(ifStmt.ifBody);
        this.outdent();
        this.appendIndent();
        this.append('}');

        // elseif 子句
        for (const elseIfClause of ifStmt.elseIfClauses) {
            this.generateElseIfClause(elseIfClause);
        }

        // else 子句
        if (ifStmt.elseBody) {
            this.append(' else');
            this.append(this.rules.getBraceStart());
            this.appendLine('');
            this.indent();
            this.generateScriptBlock(ifStmt.elseBody);
            this.outdent();
            this.appendIndent();
            this.append('}');
        }
    }

    private generateElseIfClause(elseIf: ElseIfClauseAst): void {
        this.append(' elseif (');
        this.generateExpression(elseIf.condition);
        this.append(')');
        this.append(this.rules.getBraceStart());
        this.appendLine('');
        this.indent();
        this.generateScriptBlock(elseIf.body);
        this.outdent();
        this.appendIndent();
        this.append('}');
    }

    private generateFunctionDefinition(func: FunctionDefinitionAst): void {
        // 函数前的空行
        if (this.rules.blankLinesAroundFunctions > 0) {
            for (let i = 0; i < this.rules.blankLinesAroundFunctions; i++) {
                this.appendLine('');
            }
        }

        this.append('function ');
        this.append(func.name);

        // 参数列表
        if (func.parameters.length > 0) {
            this.append('(');
            for (let i = 0; i < func.parameters.length; i++) {
                if (i > 0) {
                    this.append(this.rules.formatComma());
                }
                this.generateParameter(func.parameters[i]);
            }
            this.append(')');
        }

        // 函数体
        this.append(this.rules.getBraceStart());
        this.appendLine('');
        this.indent();
        this.generateScriptBlock(func.body);
        this.outdent();
        this.appendIndent();
        this.append('}');

        // 函数后的空行
        if (this.rules.blankLinesAroundFunctions > 0) {
            for (let i = 0; i < this.rules.blankLinesAroundFunctions; i++) {
                this.appendLine('');
            }
        }
    }

    private generateLeadingComments(comments: CommentAst[]): void {
        const leadingComments = comments.filter(c => this.isLeadingComment(c));
        for (const comment of leadingComments) {
            this.generateComment(comment);
            this.appendLine('');
        }
    }

    private generateComment(comment: CommentAst): void {
        if (!this.rules.formatComments) {
            this.append(comment.text);
            return;
        }

        if (comment.isMultiline) {
            this.generateMultilineComment(comment.text);
        } else {
            this.generateSingleLineComment(comment.text);
        }
        
        this.lastWasComment = true;
    }

    private generateArray(arrayExpr: any): void {
        this.append('@(');
        if (arrayExpr.elements && arrayExpr.elements.length > 0) {
            for (let i = 0; i < arrayExpr.elements.length; i++) {
                if (i > 0) {
                    this.append(this.rules.formatComma());
                }
                this.generateExpression(arrayExpr.elements[i]);
            }
        }
        this.append(')');
    }

    private generateHashtable(hashtableExpr: any): void {
        this.append('@{');
        
        if (hashtableExpr.entries && hashtableExpr.entries.length > 0) {
            // 强制使用紧凑格式，避免换行问题
            for (let i = 0; i < hashtableExpr.entries.length; i++) {
                const entry = hashtableExpr.entries[i];
                
                this.generateExpression(entry.key);
                this.append('=');
                this.generateExpression(entry.value);
                
                // 如果不是最后一个条目，添加分号和空格
                if (i < hashtableExpr.entries.length - 1) {
                    this.append('; ');
                }
            }
        }
        
        this.append('}');
    }

    private generateScriptBlockExpression(scriptBlockExpr: any): void {
        this.append('{');
        
        // 对原始内容应用基本的格式化规则
        if (scriptBlockExpr.rawContent) {
            const formattedContent = this.formatScriptBlockContent(scriptBlockExpr.rawContent);
            this.append(formattedContent);
        } else if (scriptBlockExpr.expression) {
            // 兼容旧格式
            this.generateExpression(scriptBlockExpr.expression);
        }
        
        this.append('}');
    }

    private formatScriptBlockContent(content: string): string {
        if (!content || !content.trim()) {
            return content;
        }

        // 应用PowerShell官方规范的格式化规则
        let formatted = content.trim();
        
        // 1. 保护所有属性访问操作符 - 这是最关键的
        // 匹配所有形式的属性访问：$var.Property, $_.Property, $obj.Method.Property等
        formatted = formatted.replace(/(\$[a-zA-Z_][a-zA-Z0-9_]*|\$_)\s*\.\s*([a-zA-Z_][a-zA-Z0-9_]*)/g, '$1.$2');
        
        // 2. 保护方法调用中的点号
        formatted = formatted.replace(/(\w)\s*\.\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g, '$1.$2(');
        
        // 3. 确保数字单位不被分离
        formatted = formatted.replace(/(\d+)\s*(KB|MB|GB|TB|PB)/gi, '$1$2');
        
        // 4. PowerShell比较和逻辑操作符需要前后空格
        const powershellOps = [
            '-eq', '-ne', '-lt', '-le', '-gt', '-ge',
            '-like', '-notlike', '-match', '-notmatch', 
            '-contains', '-notcontains', '-in', '-notin',
            '-is', '-isnot', '-as', '-and', '-or', '-not', '-xor'
        ];
        
        for (const op of powershellOps) {
            const regex = new RegExp(`\\s*${op.replace('-', '\\-')}\\s*`, 'gi');
            formatted = formatted.replace(regex, ` ${op} `);
        }
        
        // 5. 清理多余空格，但保护属性访问
        formatted = formatted.replace(/\s{2,}/g, ' ').trim();
        
        // 6. 最终检查：确保没有属性访问被破坏
        formatted = formatted.replace(/(\$\w+|\$_)\s+\.\s*/g, '$1.');
        
        return formatted;
    }


    private generateSingleLineComment(text: string): void {
        // 确保单行注释以 # 开头
        const cleanText = text.startsWith('#') ? text : `# ${text}`;
        this.append(cleanText);
    }

    private generateMultilineComment(text: string): void {
        // 多行注释保持原格式
        this.append(text);
    }

    private isLeadingComment(comment: CommentAst): boolean {
        // 简单判断：如果注释在文档开头，就认为是前导注释
        return comment.line <= 3;
    }

    private addStatementSeparation(current: StatementAst, next: StatementAst): void {
        // 函数之间添加空行
        if (current.type === 'FunctionDefinition' || next.type === 'FunctionDefinition') {
            this.appendLine('');
        }
        
        // 控制结构前添加空行
        if (next.type === 'IfStatement' && !this.lastWasComment) {
            this.appendLine('');
        }
    }

    private handleFinalNewline(): void {
        if (this.rules.insertFinalNewline && this.output.length > 0) {
            const lastLine = this.output[this.output.length - 1];
            if (!lastLine.endsWith(this.rules.getNewline())) {
                this.appendLine('');
            }
        }
    }

    private postProcess(code: string): string {
        let result = code;

        // 清理多余的空行
        if (this.rules.maxConsecutiveEmptyLines >= 0) {
            const maxEmpty = this.rules.maxConsecutiveEmptyLines;
            const emptyLinePattern = new RegExp(`(${this.rules.getNewline()}){${maxEmpty + 2},}`, 'g');
            const replacement = this.rules.getNewline().repeat(maxEmpty + 1);
            result = result.replace(emptyLinePattern, replacement);
        }

        // 清理行尾空白
        if (this.rules.trimTrailingWhitespace) {
            result = result.replace(/ +$/gm, '');
        }

        return result;
    }

    // 辅助方法
    private append(text: string): void {
        this.output.push(text);
        this.currentLineLength += text.length;
        this.needsNewline = false;
        this.lastWasComment = false;
    }

    private appendLine(text: string): void {
        this.output.push(text + this.rules.getNewline());
        this.currentLineLength = 0;
        this.needsNewline = false;
        this.lastWasComment = false;
    }

    private appendIndent(): void {
        const indent = this.rules.getIndent(this.indentLevel);
        this.append(indent);
    }

    private ensureNewline(): void {
        if (!this.needsNewline) {
            this.appendLine('');
            this.needsNewline = true;
        }
    }

    private indent(): void {
        this.indentLevel++;
    }

    private outdent(): void {
        this.indentLevel = Math.max(0, this.indentLevel - 1);
    }

    private shouldWrapLine(): boolean {
        return this.currentLineLength > this.rules.printWidth;
    }
}

/**
 * 便捷函数：格式化PowerShell AST
 */
export function formatPowerShellAST(
    ast: ScriptBlockAst, 
    comments: CommentAst[] = [],
    options: Partial<FormatterOptions> = {}
): string {
    const generator = new PowerShellCodeGenerator(options);
    return generator.generate(ast, comments);
}
