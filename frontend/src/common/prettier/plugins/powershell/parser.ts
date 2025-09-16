/**
 * PowerShell 语法分析器 (Parser)
 * 将词法分析器产生的tokens转换为抽象语法树(AST)
 */

import { Token, TokenType } from './lexer';
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
    ASTNodeFactory,
    CommentAst,
    PipelineElementAst,
    ElseIfClauseAst,
    UnaryExpressionAst,
    ParenthesizedExpressionAst
} from './ast';

export class PowerShellParser {
    private tokens: Token[];
    private currentIndex: number = 0;
    private comments: CommentAst[] = [];

    private originalCode: string;

    constructor(tokens: Token[], originalCode: string = '') {
        this.tokens = tokens;
        this.currentIndex = 0;
        this.originalCode = originalCode;
    }

    /**
     * 解析tokens生成AST
     */
    public parse(): ScriptBlockAst {
        const statements: StatementAst[] = [];
        
        while (!this.isAtEnd()) {
            // 跳过空白和换行
            this.skipWhitespaceAndNewlines();
            
            if (this.isAtEnd()) {
                break;
            }

            // 处理注释
            if (this.match(TokenType.COMMENT, TokenType.MULTILINE_COMMENT)) {
                const comment = this.parseComment();
                this.comments.push(comment);
                continue;
            }

            const statement = this.parseStatement();
            if (statement) {
                statements.push(statement);
            }
        }

        const start = this.tokens.length > 0 ? this.tokens[0].startIndex : 0;
        const end = this.tokens.length > 0 ? this.tokens[this.tokens.length - 1].endIndex : 0;
        const line = this.tokens.length > 0 ? this.tokens[0].line : 1;
        const column = this.tokens.length > 0 ? this.tokens[0].column : 1;

        return ASTNodeFactory.createScriptBlock(statements, start, end, line, column);
    }

    public getComments(): CommentAst[] {
        return this.comments;
    }

    private parseStatement(): StatementAst | null {
        // 函数定义
        if (this.check(TokenType.FUNCTION)) {
            return this.parseFunctionDefinition();
        }

        // 控制流语句
        if (this.check(TokenType.IF)) {
            return this.parseIfStatement();
        }

        // 赋值或管道
        return this.parsePipeline();
    }

    private parseFunctionDefinition(): FunctionDefinitionAst {
        const start = this.current().startIndex;
        const line = this.current().line;
        const column = this.current().column;

        this.consume(TokenType.FUNCTION, "Expected 'function'");
        
        // 函数名可能是CMDLET类型（如Get-Something）或IDENTIFIER
        let nameToken: Token;
        if (this.check(TokenType.CMDLET)) {
            nameToken = this.consume(TokenType.CMDLET, "Expected function name");
        } else {
            nameToken = this.consume(TokenType.IDENTIFIER, "Expected function name");
        }
        const name = nameToken.value;

        // 解析参数
        const parameters: ParameterAst[] = [];
        if (this.match(TokenType.LEFT_PAREN)) {
            if (!this.check(TokenType.RIGHT_PAREN)) {
                do {
                    const param = this.parseParameter();
                    if (param) {
                        parameters.push(param);
                    }
                } while (this.match(TokenType.COMMA));
            }
            this.consume(TokenType.RIGHT_PAREN, "Expected ')' after parameters");
        }

        // 解析函数体
        const body = this.parseScriptBlock();
        
        const end = this.previous().endIndex;

        return ASTNodeFactory.createFunctionDefinition(name, parameters, body, start, end, line, column);
    }

    private parseIfStatement(): IfStatementAst {
        const start = this.current().startIndex;
        const line = this.current().line;
        const column = this.current().column;

        this.consume(TokenType.IF, "Expected 'if'");
        
        // PowerShell的if语句可能有括号，也可能没有
        const hasParens = this.check(TokenType.LEFT_PAREN);
        if (hasParens) {
            this.consume(TokenType.LEFT_PAREN, "Expected '(' after 'if'");
        }
        
        const condition = this.parseExpression();
        
        if (hasParens) {
            this.consume(TokenType.RIGHT_PAREN, "Expected ')' after if condition");
        }

        const ifBody = this.parseScriptBlock();

        const elseIfClauses: ElseIfClauseAst[] = [];
        let elseBody: ScriptBlockAst | undefined;

        // 处理 elseif 子句
        while (this.match(TokenType.ELSEIF)) {
            const elseIfStart = this.previous().startIndex;
            const elseIfLine = this.previous().line;
            const elseIfColumn = this.previous().column;

            this.consume(TokenType.LEFT_PAREN, "Expected '(' after 'elseif'");
            const elseIfCondition = this.parseExpression();
            this.consume(TokenType.RIGHT_PAREN, "Expected ')' after elseif condition");
            const elseIfBody = this.parseScriptBlock();
            
            const elseIfEnd = this.previous().endIndex;

            elseIfClauses.push({
                type: 'ElseIfClause',
                condition: elseIfCondition,
                body: elseIfBody,
                start: elseIfStart,
                end: elseIfEnd,
                line: elseIfLine,
                column: elseIfColumn
            });
        }

        // 处理 else 子句
        if (this.match(TokenType.ELSE)) {
            elseBody = this.parseScriptBlock();
        }

        const end = this.previous().endIndex;

        return ASTNodeFactory.createIfStatement(condition, ifBody, elseIfClauses, elseBody, start, end, line, column);
    }

    private parsePipeline(): PipelineAst {
        const start = this.current().startIndex;
        const line = this.current().line;
        const column = this.current().column;

        const elements: PipelineElementAst[] = [];
        
        // 解析第一个元素
        const firstElement = this.parsePipelineElement();
        elements.push(firstElement);

        // 解析管道链
        while (this.match(TokenType.PIPE)) {
            const element = this.parsePipelineElement();
            elements.push(element);
        }

        const end = this.previous().endIndex;

        return ASTNodeFactory.createPipeline(elements, start, end, line, column);
    }

    private parsePipelineElement(): PipelineElementAst {
        const start = this.current().startIndex;
        const line = this.current().line;
        const column = this.current().column;

        const expression = this.parseAssignment();
        const end = this.previous().endIndex;

        return {
            type: 'PipelineElement',
            expression,
            start,
            end,
            line,
            column
        };
    }

    private parseAssignment(): ExpressionAst {
        const expr = this.parseLogicalOr();

        if (this.match(TokenType.ASSIGNMENT)) {
            const operator = this.previous().value;
            const right = this.parseAssignment();
            
            return ASTNodeFactory.createAssignment(
                expr, 
                operator, 
                right,
                expr.start,
                right.end,
                expr.line,
                expr.column
            );
        }

        return expr;
    }

    private parseLogicalOr(): ExpressionAst {
        let expr = this.parseLogicalAnd();

        while (this.match(TokenType.LOGICAL)) {
            const operator = this.previous().value.toLowerCase();
            if (operator === '-or' || operator === '-xor') {
                const right = this.parseLogicalAnd();
                expr = ASTNodeFactory.createBinaryExpression(
                    expr, 
                    this.previous().value, // 使用原始大小写
                    right,
                    expr.start,
                    right.end,
                    expr.line,
                    expr.column
                );
            } else {
                // 如果不是预期的操作符，回退
                this.currentIndex--;
                break;
            }
        }

        return expr;
    }

    private parseLogicalAnd(): ExpressionAst {
        let expr = this.parseComparison();

        while (this.match(TokenType.LOGICAL)) {
            const operator = this.previous().value.toLowerCase();
            if (operator === '-and') {
                const right = this.parseComparison();
                expr = ASTNodeFactory.createBinaryExpression(
                    expr, 
                    this.previous().value, // 使用原始大小写
                    right,
                    expr.start,
                    right.end,
                    expr.line,
                    expr.column
                );
            } else {
                // 如果不是预期的操作符，回退
                this.currentIndex--;
                break;
            }
        }

        return expr;
    }

    private parseComparison(): ExpressionAst {
        let expr = this.parseArithmetic();

        while (this.match(TokenType.COMPARISON)) {
            const operator = this.previous().value;
            const right = this.parseArithmetic();
            expr = ASTNodeFactory.createBinaryExpression(
                expr, 
                operator, 
                right,
                expr.start,
                right.end,
                expr.line,
                expr.column
            );
        }

        return expr;
    }

    private parseArithmetic(): ExpressionAst {
        let expr = this.parseMultiplicative();

        while (this.match(TokenType.ARITHMETIC)) {
            const token = this.previous();
            if (token.value === '+' || token.value === '-') {
                const operator = token.value;
                const right = this.parseMultiplicative();
                expr = ASTNodeFactory.createBinaryExpression(
                    expr, 
                    operator, 
                    right,
                    expr.start,
                    right.end,
                    expr.line,
                    expr.column
                );
            }
        }

        return expr;
    }

    private parseMultiplicative(): ExpressionAst {
        let expr = this.parseUnary();

        while (this.match(TokenType.ARITHMETIC)) {
            const token = this.previous();
            if (token.value === '*' || token.value === '/' || token.value === '%') {
                const operator = token.value;
                const right = this.parseUnary();
                expr = ASTNodeFactory.createBinaryExpression(
                    expr, 
                    operator, 
                    right,
                    expr.start,
                    right.end,
                    expr.line,
                    expr.column
                );
            }
        }

        return expr;
    }

    private parseUnary(): ExpressionAst {
        if (this.match(TokenType.LOGICAL)) {
            const token = this.previous();
            const operator = token.value.toLowerCase();
            if (operator === '-not') {
                const operand = this.parseUnary();
                return {
                    type: 'UnaryExpression',
                    operator: token.value, // 使用原始大小写
                    operand,
                    start: token.startIndex,
                    end: operand.end,
                    line: token.line,
                    column: token.column
                } as UnaryExpressionAst;
            } else {
                // 如果不是-not，回退token
                this.currentIndex--;
            }
        }

        // 处理算术一元操作符（+, -）
        if (this.match(TokenType.ARITHMETIC)) {
            const token = this.previous();
            if (token.value === '+' || token.value === '-') {
                const operand = this.parseUnary();
                return {
                    type: 'UnaryExpression',
                    operator: token.value,
                    operand,
                    start: token.startIndex,
                    end: operand.end,
                    line: token.line,
                    column: token.column
                } as UnaryExpressionAst;
            } else {
                // 如果不是一元操作符，回退
                this.currentIndex--;
            }
        }

        return this.parsePrimary();
    }

    private parsePrimary(): ExpressionAst {
        // 变量
        if (this.match(TokenType.VARIABLE)) {
            const token = this.previous();
            return ASTNodeFactory.createVariable(
                token.value,
                token.startIndex,
                token.endIndex,
                token.line,
                token.column
            );
        }

        // 字符串字面量
        if (this.match(TokenType.STRING, TokenType.HERE_STRING)) {
            const token = this.previous();
            return ASTNodeFactory.createLiteral(
                token.value,
                'String',
                token.startIndex,
                token.endIndex,
                token.line,
                token.column
            );
        }

        // 数字字面量
        if (this.match(TokenType.NUMBER)) {
            const token = this.previous();
            const value = parseFloat(token.value);
            return ASTNodeFactory.createLiteral(
                value,
                'Number',
                token.startIndex,
                token.endIndex,
                token.line,
                token.column
            );
        }

        // 命令调用 - 扩展支持更多token类型
        if (this.match(TokenType.CMDLET, TokenType.IDENTIFIER)) {
            return this.parseCommand();
        }
        
        // 处理看起来像cmdlet但被错误标记的标识符
        if (this.check(TokenType.IDENTIFIER) && this.current().value.includes('-')) {
            this.advance();
            return this.parseCommand();
        }

        // 哈希表 @{...}
        if (this.check(TokenType.LEFT_BRACE) && this.current().value === '@{') {
            return this.parseHashtable();
        }

        // 脚本块表达式 {...} - 已在parseHashtableValue中处理
        // 这里不需要处理，因为独立的脚本块很少见

        // 括号表达式
        if (this.match(TokenType.LEFT_PAREN)) {
            const expr = this.parseExpression();
            this.consume(TokenType.RIGHT_PAREN, "Expected ')' after expression");
            return {
                type: 'ParenthesizedExpression',
                expression: expr,
                start: this.previous().startIndex,
                end: this.previous().endIndex,
                line: this.previous().line,
                column: this.previous().column
            } as ParenthesizedExpressionAst;
        }

        // 对于不认识的token，作为普通标识符处理而不是抛出异常
        const token = this.advance();
        return ASTNodeFactory.createLiteral(
            token.value,
            'String', // 将未识别的token作为字符串处理
            token.startIndex,
            token.endIndex,
            token.line,
            token.column
        );
    }

    private parseCommand(): CommandAst {
        const start = this.previous().startIndex;
        const line = this.previous().line;
        const column = this.previous().column;
        const commandName = this.previous().value;

        const parameters: ParameterAst[] = [];
        const args: ExpressionAst[] = [];

        // 解析参数和参数值
        while (!this.isAtEnd() && 
               !this.check(TokenType.PIPE) && 
               !this.check(TokenType.NEWLINE) &&
               !this.check(TokenType.SEMICOLON) &&
               !this.check(TokenType.RIGHT_PAREN) &&
               !this.check(TokenType.RIGHT_BRACE)) {
            
            if (this.match(TokenType.PARAMETER)) {
                const paramToken = this.previous();
                const param: ParameterAst = {
                    type: 'Parameter',
                    name: paramToken.value,
                    start: paramToken.startIndex,
                    end: paramToken.endIndex,
                    line: paramToken.line,
                    column: paramToken.column
                };

                // 检查参数是否有值
                if (!this.check(TokenType.PARAMETER) && 
                    !this.check(TokenType.PIPE) && 
                    !this.check(TokenType.NEWLINE) &&
                    !this.check(TokenType.SEMICOLON)) {
                    param.value = this.parsePrimary();
                }

                parameters.push(param);
            } else {
                // 位置参数
                const arg = this.parsePrimary();
                args.push(arg);
            }
        }

        const end = this.previous().endIndex;

        return ASTNodeFactory.createCommand(commandName, parameters, args, start, end, line, column);
    }

    private parseParameter(): ParameterAst | null {
        if (this.match(TokenType.PARAMETER)) {
            const token = this.previous();
            const param: ParameterAst = {
                type: 'Parameter',
                name: token.value,
                start: token.startIndex,
                end: token.endIndex,
                line: token.line,
                column: token.column
            };

            // 检查是否有参数值
            if (this.match(TokenType.ASSIGNMENT)) {
                param.value = this.parseExpression();
            }

            return param;
        }
        return null;
    }

    private parseScriptBlock(): ScriptBlockAst {
        const start = this.current().startIndex;
        const line = this.current().line;
        const column = this.current().column;

        this.consume(TokenType.LEFT_BRACE, "Expected '{'");
        
        const statements: StatementAst[] = [];
        
        while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
            this.skipWhitespaceAndNewlines();
            
            if (this.check(TokenType.RIGHT_BRACE)) {
                break;
            }

            const statement = this.parseStatement();
            if (statement) {
                statements.push(statement);
            }
        }

        this.consume(TokenType.RIGHT_BRACE, "Expected '}'");
        
        const end = this.previous().endIndex;

        return ASTNodeFactory.createScriptBlock(statements, start, end, line, column);
    }

    private parseExpression(): ExpressionAst {
        return this.parseAssignment();
    }

    private parseComment(): CommentAst {
        const token = this.previous();
        const isMultiline = token.type === TokenType.MULTILINE_COMMENT;
        
        return ASTNodeFactory.createComment(
            token.value,
            isMultiline,
            token.startIndex,
            token.endIndex,
            token.line,
            token.column
        );
    }

    // 辅助方法
    private match(...types: TokenType[]): boolean {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }

    private check(type: TokenType): boolean {
        if (this.isAtEnd()) return false;
        return this.current().type === type;
    }

    private advance(): Token {
        if (!this.isAtEnd()) this.currentIndex++;
        return this.previous();
    }

    private isAtEnd(): boolean {
        return this.currentIndex >= this.tokens.length || this.current().type === TokenType.EOF;
    }

    private current(): Token {
        if (this.currentIndex >= this.tokens.length) {
            return this.tokens[this.tokens.length - 1];
        }
        return this.tokens[this.currentIndex];
    }

    private previous(): Token {
        return this.tokens[this.currentIndex - 1];
    }

    private consume(type: TokenType, message: string): Token {
        if (this.check(type)) return this.advance();
        
        const current = this.current();
        throw new Error(`${message}. Got ${current.type}(${current.value}) at line ${current.line}, column ${current.column}`);
    }


    private parseHashtable(): ExpressionAst {
        const start = this.current().startIndex;
        const line = this.current().line;
        const column = this.current().column;

        // 消费 @{
        this.advance();

        const entries: any[] = [];

        // 解析哈希表内容
        if (!this.check(TokenType.RIGHT_BRACE)) {
            do {
                // 解析键 - 只接受简单的标识符或字符串
                const key = this.parseHashtableKey();
                
                // 消费 =
                this.consume(TokenType.ASSIGNMENT, "Expected '=' after hashtable key");
                
                // 解析值
                const value = this.parseHashtableValue();
                
                entries.push({
                    type: 'HashtableEntry',
                    key,
                    value,
                    start: key.start,
                    end: value.end,
                    line: key.line,
                    column: key.column
                });

            } while (this.match(TokenType.SEMICOLON));
        }

        this.consume(TokenType.RIGHT_BRACE, "Expected '}' after hashtable entries");
        const end = this.previous().endIndex;

        return {
            type: 'Hashtable',
            entries,
            start,
            end,
            line,
            column
        } as any;
    }

    private parseHashtableKey(): ExpressionAst {
        // 哈希表键只能是简单的标识符或字符串
        if (this.match(TokenType.STRING, TokenType.HERE_STRING)) {
            const token = this.previous();
            return ASTNodeFactory.createLiteral(
                token.value,
                'String',
                token.startIndex,
                token.endIndex,
                token.line,
                token.column
            );
        }

        // 接受各种可能的标识符类型作为哈希表键
        if (this.match(TokenType.IDENTIFIER, TokenType.CMDLET, TokenType.KEYWORD)) {
            const token = this.previous();
            return ASTNodeFactory.createLiteral(
                token.value,
                'String',
                token.startIndex,
                token.endIndex,
                token.line,
                token.column
            );
        }

        // 对于任何其他类型的token，尝试作为字面量处理
        const currentToken = this.current();
        this.advance();
        return ASTNodeFactory.createLiteral(
            currentToken.value,
            'String',
            currentToken.startIndex,
            currentToken.endIndex,
            currentToken.line,
            currentToken.column
        );
    }

    private parseHashtableValue(): ExpressionAst {
        // 哈希表值可以是任何表达式
        if (this.check(TokenType.LEFT_BRACE)) {
            // 这是一个脚本块 {expression} - 完全绕过复杂解析
            const start = this.current().startIndex;
            const line = this.current().line;
            const column = this.current().column;
            
            // 直接从原始代码中提取脚本块内容
            const startPos = this.current().startIndex;
            this.advance(); // 消费 {
            
            let braceLevel = 1;
            let endPos = this.current().startIndex;
            
            // 找到匹配的右大括号位置
            while (!this.isAtEnd() && braceLevel > 0) {
                const token = this.current();
                if (token.type === TokenType.LEFT_BRACE) {
                    braceLevel++;
                } else if (token.type === TokenType.RIGHT_BRACE) {
                    braceLevel--;
                    if (braceLevel === 0) {
                        endPos = token.startIndex;
                        break;
                    }
                }
                this.advance();
            }

            this.consume(TokenType.RIGHT_BRACE, "Expected '}' after script block");
            const end = this.previous().endIndex;
            
            // 从原始代码中提取内容（从 { 后到 } 前）
            const rawContent = this.getOriginalCodeSlice(startPos + 1, endPos);
            
            return {
                type: 'ScriptBlockExpression',
                rawContent: rawContent.trim(), // 去掉首尾空白
                start,
                end,
                line,
                column
            } as any;
        }
        
        // 对于其他值，使用简单的解析
        return this.parsePrimary();
    }

    private getOriginalCodeSlice(start: number, end: number): string {
        // 直接从原始代码中提取片段
        if (this.originalCode) {
            return this.originalCode.substring(start, end);
        }
        
        // 回退到基于token重建（如果没有原始代码）
        let result = '';
        for (const token of this.tokens) {
            if (token.startIndex >= start && token.endIndex <= end) {
                result += token.value;
            }
        }
        return result;
    }

    private skipWhitespaceAndNewlines(): void {
        while (this.match(TokenType.WHITESPACE, TokenType.NEWLINE)) {
            // 继续跳过
        }
    }
}
