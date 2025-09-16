/**
 * PowerShell 词法分析器 (Lexer)
 * 将PowerShell代码分解为tokens，用于后续的语法分析和格式化
 */

export enum TokenType {
    // 字面量
    STRING = 'STRING',
    NUMBER = 'NUMBER',
    VARIABLE = 'VARIABLE',
    
    // 关键字
    KEYWORD = 'KEYWORD',
    FUNCTION = 'FUNCTION',
    
    // 操作符
    OPERATOR = 'OPERATOR',
    ASSIGNMENT = 'ASSIGNMENT',
    COMPARISON = 'COMPARISON',
    LOGICAL = 'LOGICAL',
    ARITHMETIC = 'ARITHMETIC',
    
    // 分隔符
    LEFT_PAREN = 'LEFT_PAREN',
    RIGHT_PAREN = 'RIGHT_PAREN',
    LEFT_BRACE = 'LEFT_BRACE',
    RIGHT_BRACE = 'RIGHT_BRACE',
    LEFT_BRACKET = 'LEFT_BRACKET',
    RIGHT_BRACKET = 'RIGHT_BRACKET',
    SEMICOLON = 'SEMICOLON',
    COMMA = 'COMMA',
    DOT = 'DOT',
    PIPE = 'PIPE',
    
    // 特殊
    WHITESPACE = 'WHITESPACE',
    NEWLINE = 'NEWLINE',
    COMMENT = 'COMMENT',
    MULTILINE_COMMENT = 'MULTILINE_COMMENT',
    HERE_STRING = 'HERE_STRING',
    
    // 控制结构
    IF = 'IF',
    ELSE = 'ELSE',
    ELSEIF = 'ELSEIF',
    WHILE = 'WHILE',
    FOR = 'FOR',
    FOREACH = 'FOREACH',
    SWITCH = 'SWITCH',
    TRY = 'TRY',
    CATCH = 'CATCH',
    FINALLY = 'FINALLY',
    
    // 其他
    IDENTIFIER = 'IDENTIFIER',
    CMDLET = 'CMDLET',
    PARAMETER = 'PARAMETER',
    EOF = 'EOF',
    UNKNOWN = 'UNKNOWN'
}

export interface Token {
    type: TokenType;
    value: string;
    line: number;
    column: number;
    startIndex: number;
    endIndex: number;
}

export class PowerShellLexer {
    private code: string;
    private position: number = 0;
    private line: number = 1;
    private column: number = 1;
    private tokens: Token[] = [];

    // PowerShell关键字
    private readonly keywords = new Set([
        'if', 'else', 'elseif', 'switch', 'while', 'for', 'foreach', 'do',
        'try', 'catch', 'finally', 'throw', 'return', 'break', 'continue',
        'function', 'filter', 'param', 'begin', 'process', 'end',
        'class', 'enum', 'using', 'namespace', 'workflow', 'configuration',
        'dynamicparam', 'exit'
    ]);

    // PowerShell比较操作符
    private readonly comparisonOperators = new Set([
        '-eq', '-ne', '-lt', '-le', '-gt', '-ge',
        '-like', '-notlike', '-match', '-notmatch',
        '-contains', '-notcontains', '-in', '-notin',
        '-is', '-isnot', '-as'
    ]);

    // PowerShell逻辑操作符
    private readonly logicalOperators = new Set([
        '-and', '-or', '-not', '-xor', '-band', '-bor', '-bxor', '-bnot'
    ]);

    constructor(code: string) {
        this.code = code;
    }

    /**
     * 对代码进行词法分析，返回token数组
     */
    public tokenize(): Token[] {
        this.position = 0;
        this.line = 1;
        this.column = 1;
        this.tokens = [];

        while (this.position < this.code.length) {
            this.skipWhitespace();
            
            if (this.position >= this.code.length) {
                break;
            }

            const token = this.nextToken();
            if (token) {
                this.tokens.push(token);
            }
        }

        this.tokens.push({
            type: TokenType.EOF,
            value: '',
            line: this.line,
            column: this.column,
            startIndex: this.position,
            endIndex: this.position
        });

        return this.tokens;
    }

    private nextToken(): Token | null {
        const startPos = this.position;
        const startLine = this.line;
        const startColumn = this.column;

        const char = this.code[this.position];

        // 处理换行
        if (char === '\n') {
            this.advance();
            return this.createToken(TokenType.NEWLINE, '\n', startPos, startLine, startColumn);
        }

        // 处理注释
        if (char === '#') {
            return this.tokenizeComment(startPos, startLine, startColumn);
        }

        // 处理多行注释
        if (char === '<' && this.peek() === '#') {
            return this.tokenizeMultilineComment(startPos, startLine, startColumn);
        }

        // 处理字符串
        if (char === '"' || char === "'") {
            return this.tokenizeString(startPos, startLine, startColumn);
        }

        // 处理Here-String
        if (char === '@' && (this.peek() === '"' || this.peek() === "'")) {
            return this.tokenizeHereString(startPos, startLine, startColumn);
        }

        // 处理哈希表字面量 @{
        if (char === '@' && this.peek() === '{') {
            this.advance(); // skip '@'
            this.advance(); // skip '{'
            return this.createToken(TokenType.LEFT_BRACE, '@{', startPos, startLine, startColumn);
        }

        // 处理变量
        if (char === '$') {
            return this.tokenizeVariable(startPos, startLine, startColumn);
        }

        // 处理数字
        if (this.isDigit(char) || (char === '.' && this.isDigit(this.peek()))) {
            return this.tokenizeNumber(startPos, startLine, startColumn);
        }

        // 处理操作符和分隔符
        const operatorToken = this.tokenizeOperator(startPos, startLine, startColumn);
        if (operatorToken) {
            return operatorToken;
        }

        // 优先处理PowerShell比较操作符（以-开头）
        if (char === '-' && this.isIdentifierStart(this.peek())) {
            const potentialOperator = this.peekPowerShellOperator();
            if (potentialOperator) {
                return this.tokenizePowerShellOperator(startPos, startLine, startColumn);
            }
            // 如果不是操作符，可能是参数
            return this.tokenizeParameter(startPos, startLine, startColumn);
        }

        // 处理标识符（包括cmdlet和关键字）
        if (this.isIdentifierStart(char)) {
            return this.tokenizeIdentifier(startPos, startLine, startColumn);
        }

        // 处理PowerShell特殊字符
        if (char === '?') {
            this.advance();
            return this.createToken(TokenType.OPERATOR, char, startPos, startLine, startColumn);
        }
        
        // 处理独立的减号（可能是负数或减法）
        if (char === '-') {
            this.advance();
            return this.createToken(TokenType.ARITHMETIC, char, startPos, startLine, startColumn);
        }
        
        // 处理其他可能的特殊字符，作为标识符处理而不是未知字符
        if (this.isPrintableChar(char)) {
            this.advance();
            return this.createToken(TokenType.IDENTIFIER, char, startPos, startLine, startColumn);
        }

        // 真正的未知字符（非打印字符等）
        this.advance();
        return this.createToken(TokenType.UNKNOWN, char, startPos, startLine, startColumn);
    }

    private tokenizeComment(startPos: number, startLine: number, startColumn: number): Token {
        let value = '';
        while (this.position < this.code.length && this.code[this.position] !== '\n') {
            value += this.code[this.position];
            this.advance();
        }
        return this.createToken(TokenType.COMMENT, value, startPos, startLine, startColumn);
    }

    private tokenizeMultilineComment(startPos: number, startLine: number, startColumn: number): Token {
        let value = '';
        this.advance(); // skip '<'
        this.advance(); // skip '#'
        value += '<#';

        while (this.position < this.code.length - 1) {
            if (this.code[this.position] === '#' && this.code[this.position + 1] === '>') {
                value += '#>';
                this.advance();
                this.advance();
                break;
            }
            value += this.code[this.position];
            this.advance();
        }

        return this.createToken(TokenType.MULTILINE_COMMENT, value, startPos, startLine, startColumn);
    }

    private tokenizeString(startPos: number, startLine: number, startColumn: number): Token {
        const quote = this.code[this.position];
        let value = quote;
        this.advance();

        while (this.position < this.code.length) {
            const char = this.code[this.position];
            value += char;

            if (char === quote) {
                this.advance();
                break;
            }

            // 处理转义字符
            if (char === '`' && quote === '"') {
                this.advance();
                if (this.position < this.code.length) {
                    value += this.code[this.position];
                    this.advance();
                }
            } else {
                this.advance();
            }
        }

        return this.createToken(TokenType.STRING, value, startPos, startLine, startColumn);
    }

    private tokenizeHereString(startPos: number, startLine: number, startColumn: number): Token {
        const quote = this.code[this.position + 1]; // " or '
        let value = `@${quote}`;
        this.advance(); // skip '@'
        this.advance(); // skip quote

        while (this.position < this.code.length - 1) {
            if (this.code[this.position] === quote && this.code[this.position + 1] === '@') {
                value += `${quote}@`;
                this.advance();
                this.advance();
                break;
            }
            value += this.code[this.position];
            this.advance();
        }

        return this.createToken(TokenType.HERE_STRING, value, startPos, startLine, startColumn);
    }

    private tokenizeVariable(startPos: number, startLine: number, startColumn: number): Token {
        let value = '$';
        this.advance(); // skip '$'

        // 处理特殊变量如 $_, $$, $^
        const specialVars = ['_', '$', '^', '?'];
        if (specialVars.includes(this.code[this.position])) {
            value += this.code[this.position];
            this.advance();
            return this.createToken(TokenType.VARIABLE, value, startPos, startLine, startColumn);
        }

        // 处理大括号变量 ${variable name}
        if (this.code[this.position] === '{') {
            this.advance(); // skip '{'
            value += '{';
            while (this.position < this.code.length && this.code[this.position] !== '}') {
                value += this.code[this.position];
                this.advance();
            }
            if (this.position < this.code.length) {
                value += '}';
                this.advance(); // skip '}'
            }
            return this.createToken(TokenType.VARIABLE, value, startPos, startLine, startColumn);
        }

        // 普通变量名
        while (this.position < this.code.length && this.isIdentifierChar(this.code[this.position])) {
            value += this.code[this.position];
            this.advance();
        }

        return this.createToken(TokenType.VARIABLE, value, startPos, startLine, startColumn);
    }

    private tokenizeNumber(startPos: number, startLine: number, startColumn: number): Token {
        let value = '';
        let hasDecimal = false;

        while (this.position < this.code.length) {
            const char = this.code[this.position];
            
            if (this.isDigit(char)) {
                value += char;
                this.advance();
            } else if (char === '.' && !hasDecimal && this.isDigit(this.peek())) {
                hasDecimal = true;
                value += char;
                this.advance();
            } else {
                break;
            }
        }

        // 检查是否有PowerShell数字单位后缀（KB, MB, GB, TB, PB）
        const unitPattern = /^(KB|MB|GB|TB|PB)/i;
        const remainingCode = this.code.substring(this.position);
        const unitMatch = remainingCode.match(unitPattern);
        
        if (unitMatch) {
            value += unitMatch[0]; // 使用 [0] 获取完整匹配
            // 移动position到单位后面
            for (let i = 0; i < unitMatch[0].length; i++) {
                this.advance();
            }
        }

        return this.createToken(TokenType.NUMBER, value, startPos, startLine, startColumn);
    }

    private tokenizeOperator(startPos: number, startLine: number, startColumn: number): Token | null {
        const char = this.code[this.position];

        // 双字符操作符
        const twoChar = this.code.substring(this.position, this.position + 2);
        const doubleOperators = ['==', '!=', '<=', '>=', '++', '--', '+=', '-=', '*=', '/=', '%='];
        
        if (doubleOperators.includes(twoChar)) {
            this.advance();
            this.advance();
            return this.createToken(TokenType.OPERATOR, twoChar, startPos, startLine, startColumn);
        }

        // 单字符操作符
        switch (char) {
            case '=':
                this.advance();
                return this.createToken(TokenType.ASSIGNMENT, char, startPos, startLine, startColumn);
            case '+':
            case '*':
            case '/':
            case '%':
                this.advance();
                return this.createToken(TokenType.ARITHMETIC, char, startPos, startLine, startColumn);
            case '-':
                // 不在这里处理'-'，让PowerShell操作符检查优先处理
                return null;
            case '(':
                this.advance();
                return this.createToken(TokenType.LEFT_PAREN, char, startPos, startLine, startColumn);
            case ')':
                this.advance();
                return this.createToken(TokenType.RIGHT_PAREN, char, startPos, startLine, startColumn);
            case '{':
                this.advance();
                return this.createToken(TokenType.LEFT_BRACE, char, startPos, startLine, startColumn);
            case '}':
                this.advance();
                return this.createToken(TokenType.RIGHT_BRACE, char, startPos, startLine, startColumn);
            case '[':
                // 检查是否是PowerShell类型转换 [type]
                const typePattern = this.peekTypeConversion();
                if (typePattern) {
                    return this.tokenizeTypeConversion(startPos, startLine, startColumn);
                }
                this.advance();
                return this.createToken(TokenType.LEFT_BRACKET, char, startPos, startLine, startColumn);
            case ']':
                this.advance();
                return this.createToken(TokenType.RIGHT_BRACKET, char, startPos, startLine, startColumn);
            case ';':
                this.advance();
                return this.createToken(TokenType.SEMICOLON, char, startPos, startLine, startColumn);
            case ',':
                this.advance();
                return this.createToken(TokenType.COMMA, char, startPos, startLine, startColumn);
            case '.':
                this.advance();
                return this.createToken(TokenType.DOT, char, startPos, startLine, startColumn);
            case '|':
                this.advance();
                return this.createToken(TokenType.PIPE, char, startPos, startLine, startColumn);
        }

        return null;
    }

    private tokenizeIdentifier(startPos: number, startLine: number, startColumn: number): Token {
        let value = '';
        
        // 改进的标识符识别，支持PowerShell cmdlet格式（动词-名词）
        while (this.position < this.code.length) {
            const char = this.code[this.position];
            
            if (this.isIdentifierChar(char)) {
                value += char;
                this.advance();
            } else if (char === '-' && value.length > 0 && this.isIdentifierStart(this.peek())) {
                // 检查是否是cmdlet格式（动词-名词）
                const nextPart = this.peekIdentifierPart();
                if (nextPart && !this.isPowerShellOperator('-' + nextPart)) {
                    // 这是cmdlet名字的一部分，继续
                    value += char;
                    this.advance();
                } else {
                    // 这可能是操作符，停止
                    break;
                }
            } else {
                break;
            }
        }

        const lowerValue = value.toLowerCase();
        
        // 检查是否是关键字
        if (this.keywords.has(lowerValue)) {
            return this.createToken(this.getKeywordTokenType(lowerValue), value, startPos, startLine, startColumn);
        }

        // 检查是否是函数（以动词-名词格式）
        if (this.isCmdletName(value)) {
            return this.createToken(TokenType.CMDLET, value, startPos, startLine, startColumn);
        }

        return this.createToken(TokenType.IDENTIFIER, value, startPos, startLine, startColumn);
    }

    private tokenizeParameter(startPos: number, startLine: number, startColumn: number): Token {
        let value = '';
        
        while (this.position < this.code.length && (this.isIdentifierChar(this.code[this.position]) || this.code[this.position] === '-')) {
            value += this.code[this.position];
            this.advance();
        }

        const lowerValue = value.toLowerCase();
        
        // 检查是否是比较操作符
        if (this.comparisonOperators.has(lowerValue)) {
            return this.createToken(TokenType.COMPARISON, value, startPos, startLine, startColumn);
        }

        // 检查是否是逻辑操作符
        if (this.logicalOperators.has(lowerValue)) {
            return this.createToken(TokenType.LOGICAL, value, startPos, startLine, startColumn);
        }

        return this.createToken(TokenType.PARAMETER, value, startPos, startLine, startColumn);
    }

    private getKeywordTokenType(keyword: string): TokenType {
        switch (keyword) {
            case 'if': return TokenType.IF;
            case 'else': return TokenType.ELSE;
            case 'elseif': return TokenType.ELSEIF;
            case 'while': return TokenType.WHILE;
            case 'for': return TokenType.FOR;
            case 'foreach': return TokenType.FOREACH;
            case 'switch': return TokenType.SWITCH;
            case 'try': return TokenType.TRY;
            case 'catch': return TokenType.CATCH;
            case 'finally': return TokenType.FINALLY;
            case 'function': return TokenType.FUNCTION;
            default: return TokenType.KEYWORD;
        }
    }

    private isCmdletName(name: string): boolean {
        // PowerShell cmdlet通常遵循 Verb-Noun 格式，可能包含多个连字符
        const verbNounPattern = /^[A-Za-z]+(-[A-Za-z]+)+$/;
        return verbNounPattern.test(name);
    }

    private peekPowerShellOperator(): string | null {
        // 检查是否是PowerShell比较或逻辑操作符
        const operatorPatterns = [
            '-eq', '-ne', '-lt', '-le', '-gt', '-ge',
            '-like', '-notlike', '-match', '-notmatch',
            '-contains', '-notcontains', '-in', '-notin',
            '-is', '-isnot', '-as',
            '-and', '-or', '-not', '-xor',
            '-band', '-bor', '-bxor', '-bnot'
        ];
        
        for (const op of operatorPatterns) {
            if (this.matchesOperator(op)) {
                return op;
            }
        }
        return null;
    }
    
    private matchesOperator(operator: string): boolean {
        if (this.position + operator.length > this.code.length) {
            return false;
        }
        
        const substr = this.code.substring(this.position, this.position + operator.length);
        if (substr.toLowerCase() !== operator.toLowerCase()) {
            return false;
        }
        
        // 确保操作符后面不是字母数字字符（避免匹配部分单词）
        const nextChar = this.position + operator.length < this.code.length 
            ? this.code[this.position + operator.length] 
            : ' ';
        return !this.isIdentifierChar(nextChar);
    }
    
    private tokenizePowerShellOperator(startPos: number, startLine: number, startColumn: number): Token {
        const operator = this.peekPowerShellOperator();
        if (!operator) {
            // 如果不是操作符，作为参数处理
            return this.tokenizeParameter(startPos, startLine, startColumn);
        }
        
        // 消费操作符字符
        for (let i = 0; i < operator.length; i++) {
            this.advance();
        }
        
        const lowerOp = operator.toLowerCase();
        
        // 确定操作符类型
        if (this.comparisonOperators.has(lowerOp)) {
            return this.createToken(TokenType.COMPARISON, operator, startPos, startLine, startColumn);
        } else if (this.logicalOperators.has(lowerOp)) {
            return this.createToken(TokenType.LOGICAL, operator, startPos, startLine, startColumn);
        } else {
            return this.createToken(TokenType.OPERATOR, operator, startPos, startLine, startColumn);
        }
    }
    
    private peekIdentifierPart(): string | null {
        if (this.position + 1 >= this.code.length) {
            return null;
        }
        
        let result = '';
        let pos = this.position + 1; // 跳过连字符
        
        while (pos < this.code.length && this.isIdentifierChar(this.code[pos])) {
            result += this.code[pos];
            pos++;
        }
        
        return result.length > 0 ? result : null;
    }
    
    private isPowerShellOperator(text: string): boolean {
        const lowerText = text.toLowerCase();
        return this.comparisonOperators.has(lowerText) || this.logicalOperators.has(lowerText);
    }

    private peekTypeConversion(): string | null {
        // 检查是否是PowerShell类型转换，如 [int], [string], [datetime] 等
        if (this.code[this.position] !== '[') {
            return null;
        }

        let pos = this.position + 1; // 跳过 '['
        let typeContent = '';

        // 查找类型名称
        while (pos < this.code.length && this.code[pos] !== ']') {
            typeContent += this.code[pos];
            pos++;
        }

        if (pos >= this.code.length || this.code[pos] !== ']') {
            return null; // 没有找到匹配的 ']'
        }

        // 检查是否是有效的PowerShell类型
        const validTypes = [
            'int', 'int32', 'int64', 'string', 'bool', 'boolean', 'char', 'byte',
            'double', 'float', 'decimal', 'long', 'short', 'datetime', 'timespan',
            'array', 'hashtable', 'object', 'psobject', 'xml', 'scriptblock',
            'guid', 'uri', 'version', 'regex', 'mailaddress', 'ipaddress'
        ];

        const lowerType = typeContent.toLowerCase().trim();
        if (validTypes.includes(lowerType) || lowerType.includes('.')) {
            return `[${typeContent}]`;
        }

        return null;
    }

    private tokenizeTypeConversion(startPos: number, startLine: number, startColumn: number): Token {
        const typeConversion = this.peekTypeConversion();
        if (!typeConversion) {
            // 这不应该发生，但作为安全措施
            this.advance();
            return this.createToken(TokenType.LEFT_BRACKET, '[', startPos, startLine, startColumn);
        }

        // 消费整个类型转换
        for (let i = 0; i < typeConversion.length; i++) {
            this.advance();
        }

        return this.createToken(TokenType.IDENTIFIER, typeConversion, startPos, startLine, startColumn);
    }

    private isIdentifierStart(char: string): boolean {
        return /[a-zA-Z_]/.test(char);
    }

    private isIdentifierChar(char: string): boolean {
        return /[a-zA-Z0-9_]/.test(char);
    }

    private isDigit(char: string): boolean {
        return char >= '0' && char <= '9';
    }

    private isPrintableChar(char: string): boolean {
        // 检查是否为可打印字符（非控制字符）
        const charCode = char.charCodeAt(0);
        return charCode >= 32 && charCode <= 126;
    }

    private advance(): void {
        if (this.position < this.code.length) {
            if (this.code[this.position] === '\n') {
                this.line++;
                this.column = 1;
            } else {
                this.column++;
            }
            this.position++;
        }
    }

    private peek(): string {
        return this.position + 1 < this.code.length ? this.code[this.position + 1] : '';
    }

    private skipWhitespace(): void {
        while (this.position < this.code.length) {
            const char = this.code[this.position];
            if (char === ' ' || char === '\t' || char === '\r') {
                this.advance();
            } else {
                break;
            }
        }
    }

    private createToken(type: TokenType, value: string, startPos: number, line: number, column: number): Token {
        return {
            type,
            value,
            line,
            column,
            startIndex: startPos,
            endIndex: this.position
        };
    }
}
