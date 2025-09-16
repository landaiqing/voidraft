/**
 * PowerShell 格式化规则引擎
 * 定义各种可配置的代码格式化规则和策略
 */

export interface FormatterOptions {
    // 基本格式化选项
    indentSize: number;                    // 缩进大小
    useTabsForIndentation: boolean;        // 使用制表符还是空格
    printWidth: number;                    // 行最大长度
    endOfLine: 'lf' | 'crlf' | 'cr' | 'auto'; // 行尾符类型
    
    // 空格和间距
    spaceAroundOperators: boolean;         // 操作符周围的空格
    spaceAfterCommas: boolean;            // 逗号后的空格
    spaceAfterSemicolons: boolean;        // 分号后的空格
    spaceInsideParentheses: boolean;      // 括号内的空格
    spaceInsideBrackets: boolean;         // 方括号内的空格
    spaceInsideBraces: boolean;           // 大括号内的空格
    
    // 换行和空行
    maxConsecutiveEmptyLines: number;      // 最大连续空行数
    insertFinalNewline: boolean;           // 文件末尾插入换行符
    trimTrailingWhitespace: boolean;       // 删除行尾空白
    blankLinesAroundFunctions: number;     // 函数前后的空行数
    blankLinesAroundClasses: number;       // 类前后的空行数
    blankLinesAroundIfStatements: boolean; // if语句前后的空行
    
    // 括号和大括号
    braceStyle: 'allman' | 'otbs' | 'stroustrup'; // 大括号风格
    alwaysParenthesizeArrowFunctions: boolean;     // 箭头函数总是用括号
    
    // PowerShell特定选项
    formatPipelines: boolean;              // 格式化管道
    pipelineStyle: 'oneline' | 'multiline' | 'auto'; // 管道风格
    formatParameters: boolean;             // 格式化参数
    parameterAlignment: 'left' | 'right' | 'auto'; // 参数对齐方式
    formatHashtables: boolean;             // 格式化哈希表
    hashtableStyle: 'compact' | 'expanded'; // 哈希表风格
    formatArrays: boolean;                 // 格式化数组
    arrayStyle: 'compact' | 'expanded';    // 数组风格
    formatComments: boolean;               // 格式化注释
    commentAlignment: 'left' | 'preserve'; // 注释对齐方式
    
    // 命名和大小写
    preferredCommandCase: 'lowercase' | 'uppercase' | 'pascalcase' | 'preserve'; // 命令大小写
    preferredParameterCase: 'lowercase' | 'uppercase' | 'pascalcase' | 'preserve'; // 参数大小写
    preferredVariableCase: 'camelcase' | 'pascalcase' | 'preserve'; // 变量大小写
    
    // 引号和字符串
    quotestyle: 'single' | 'double' | 'preserve'; // 引号风格
    escapeNonAscii: boolean;               // 转义非ASCII字符
    
    // 长度和换行
    wrapLongLines: boolean;                // 自动换行长行
    wrapParameters: boolean;               // 换行长参数列表
    wrapArrays: boolean;                   // 换行长数组
    wrapHashtables: boolean;               // 换行长哈希表
}

export const DEFAULT_OPTIONS: FormatterOptions = {
    // 基本选项
    indentSize: 4,
    useTabsForIndentation: false,
    printWidth: 120,
    endOfLine: 'auto',
    
    // 空格设置
    spaceAroundOperators: true,
    spaceAfterCommas: true,
    spaceAfterSemicolons: true,
    spaceInsideParentheses: false,
    spaceInsideBrackets: false,
    spaceInsideBraces: true,
    
    // 空行设置
    maxConsecutiveEmptyLines: 2,
    insertFinalNewline: true,
    trimTrailingWhitespace: true,
    blankLinesAroundFunctions: 1,
    blankLinesAroundClasses: 1,
    blankLinesAroundIfStatements: false,
    
    // 括号风格
    braceStyle: 'otbs', // One True Brace Style
    alwaysParenthesizeArrowFunctions: false,
    
    // PowerShell特定
    formatPipelines: true,
    pipelineStyle: 'auto',
    formatParameters: true,
    parameterAlignment: 'left',
    formatHashtables: true,
    hashtableStyle: 'compact',
    formatArrays: true,
    arrayStyle: 'compact',
    formatComments: true,
    commentAlignment: 'preserve',
    
    // 命名约定
    preferredCommandCase: 'pascalcase',
    preferredParameterCase: 'preserve',
    preferredVariableCase: 'preserve',
    
    // 字符串设置
    quotestyle: 'preserve',
    escapeNonAscii: false,
    
    // 长度处理
    wrapLongLines: true,
    wrapParameters: true,
    wrapArrays: true,
    wrapHashtables: true
};

/**
 * 格式化规则类，包含各种格式化策略的实现
 */
export class FormatterRules {
    private options: FormatterOptions;

    constructor(options: Partial<FormatterOptions> = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    /**
     * 获取缩进字符串
     */
    getIndent(level: number): string {
        if (level <= 0) return '';
        
        const indentChar = this.options.useTabsForIndentation ? '\t' : ' ';
        const indentSize = this.options.useTabsForIndentation ? 1 : this.options.indentSize;
        
        return indentChar.repeat(level * indentSize);
    }

    /**
     * 获取换行符
     */
    getNewline(): string {
        switch (this.options.endOfLine) {
            case 'lf': return '\n';
            case 'crlf': return '\r\n';
            case 'cr': return '\r';
            case 'auto': 
            default:
                // 在浏览器环境中默认使用 LF
                return '\n';
        }
    }

    /**
     * 格式化操作符周围的空格
     */
    formatOperatorSpacing(operator: string): string {
        if (!this.options.spaceAroundOperators) {
            return operator;
        }

        // PowerShell语法中绝对不能加空格的操作符（官方规范）
        const noSpaceOperators = [
            '.', '::',                    // 属性访问和静态成员访问 - 这是PowerShell面向对象的核心
            '[', ']',                     // 数组索引和类型转换
            '(', ')', '{', '}',          // 括号
            '@{',                         // 哈希表字面量开始
            ';',                          // 哈希表和语句分隔符
            '-',                          // cmdlet连字符（Get-ChildItem中的-）
            '::'                          // 静态成员访问
        ];
        
        if (noSpaceOperators.includes(operator)) {
            return operator;
        }

        // PowerShell比较操作符需要空格
        const powershellOperators = ['-eq', '-ne', '-lt', '-le', '-gt', '-ge', 
                                   '-like', '-notlike', '-match', '-notmatch',
                                   '-contains', '-notcontains', '-in', '-notin',
                                   '-is', '-isnot', '-as', '-and', '-or', '-not', '-xor'];
        
        if (powershellOperators.some(op => operator.toLowerCase() === op)) {
            return ` ${operator} `;
        }

        // 算术和赋值操作符需要空格
        const spaceOperators = ['=', '+=', '-=', '*=', '/=', '%=', '+', '*', '/', '%'];
        if (spaceOperators.includes(operator)) {
            return ` ${operator} `;
        }

        return operator;
    }

    /**
     * 格式化逗号后的空格
     */
    formatComma(): string {
        return this.options.spaceAfterCommas ? ', ' : ',';
    }

    /**
     * 格式化分号后的空格
     */
    formatSemicolon(): string {
        return this.options.spaceAfterSemicolons ? '; ' : ';';
    }

    /**
     * 格式化括号内的空格
     */
    formatParentheses(content: string): string {
        if (this.options.spaceInsideParentheses) {
            return `( ${content} )`;
        }
        return `(${content})`;
    }

    /**
     * 格式化方括号内的空格
     */
    formatBrackets(content: string): string {
        if (this.options.spaceInsideBrackets) {
            return `[ ${content} ]`;
        }
        return `[${content}]`;
    }

    /**
     * 格式化大括号内的空格
     */
    formatBraces(content: string): string {
        if (this.options.spaceInsideBraces) {
            return `{ ${content} }`;
        }
        return `{${content}}`;
    }

    /**
     * 获取大括号的开始位置
     */
    getBraceStart(): string {
        switch (this.options.braceStyle) {
            case 'allman':
                return this.getNewline() + '{';
            case 'stroustrup':
                return this.getNewline() + '{';
            case 'otbs':
            default:
                return ' {';
        }
    }

    /**
     * 格式化命令名的大小写
     */
    formatCommandCase(command: string): string {
        switch (this.options.preferredCommandCase) {
            case 'lowercase':
                return command.toLowerCase();
            case 'uppercase':
                return command.toUpperCase();
            case 'pascalcase':
                return this.toPascalCasePreservingHyphens(command);
            case 'preserve':
            default:
                return command;
        }
    }

    /**
     * 检查是否应该格式化命令大小写
     */
    shouldFormatCommandCase(): boolean {
        return this.options.preferredCommandCase !== 'preserve';
    }

    /**
     * 格式化参数名的大小写
     */
    formatParameterCase(parameter: string): string {
        switch (this.options.preferredParameterCase) {
            case 'lowercase':
                return parameter.toLowerCase();
            case 'uppercase':
                return parameter.toUpperCase();
            case 'pascalcase':
                return this.toPascalCase(parameter);
            case 'preserve':
            default:
                return parameter;
        }
    }

    /**
     * 格式化变量名的大小写
     */
    formatVariableCase(variable: string): string {
        if (!variable.startsWith('$')) {
            return variable;
        }

        const variableName = variable.substring(1);
        let formattedName: string;

        switch (this.options.preferredVariableCase) {
            case 'camelcase':
                formattedName = this.toCamelCase(variableName);
                break;
            case 'pascalcase':
                formattedName = this.toPascalCase(variableName);
                break;
            case 'preserve':
            default:
                formattedName = variableName;
                break;
        }

        return '$' + formattedName;
    }

    /**
     * 格式化字符串引号
     */
    formatQuotes(value: string): string {
        if (this.options.quotestyle === 'preserve') {
            return value;
        }

        const content = this.extractStringContent(value);
        
        switch (this.options.quotestyle) {
            case 'single':
                return `'${content.replace(/'/g, "''")}'`;
            case 'double':
                return `"${content.replace(/"/g, '""')}"`;
            default:
                return value;
        }
    }

    /**
     * 检查是否需要换行
     */
    shouldWrapLine(line: string): boolean {
        return this.options.wrapLongLines && line.length > this.options.printWidth;
    }

    /**
     * 获取管道样式
     */
    getPipelineStyle(elementCount: number): 'oneline' | 'multiline' {
        switch (this.options.pipelineStyle) {
            case 'oneline':
                return 'oneline';
            case 'multiline':
                return 'multiline';
            case 'auto':
            default:
                return elementCount > 2 ? 'multiline' : 'oneline';
        }
    }

    /**
     * 获取哈希表样式
     */
    getHashtableStyle(entryCount: number): 'compact' | 'expanded' {
        if (this.options.hashtableStyle === 'compact') {
            return 'compact';
        }
        if (this.options.hashtableStyle === 'expanded') {
            return 'expanded';
        }
        // auto logic: 对于小型哈希表默认使用compact，避免不必要的换行
        return entryCount > 5 ? 'expanded' : 'compact';
    }

    /**
     * 获取数组样式
     */
    getArrayStyle(elementCount: number): 'compact' | 'expanded' {
        if (this.options.arrayStyle === 'compact') {
            return 'compact';
        }
        if (this.options.arrayStyle === 'expanded') {
            return 'expanded';
        }
        // auto logic could be added here
        return elementCount > 5 ? 'expanded' : 'compact';
    }

    // 辅助方法
    private toPascalCase(str: string): string {
        return str.split(/[-_\s]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('');
    }

    /**
     * 转换为PascalCase但保留连字符（专门用于PowerShell cmdlet）
     */
    private toPascalCasePreservingHyphens(str: string): string {
        return str.split('-')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
            .join('-');
    }

    private toCamelCase(str: string): string {
        const pascalCase = this.toPascalCase(str);
        return pascalCase.charAt(0).toLowerCase() + pascalCase.slice(1);
    }

    private extractStringContent(str: string): string {
        if ((str.startsWith('"') && str.endsWith('"')) || 
            (str.startsWith("'") && str.endsWith("'"))) {
            return str.slice(1, -1);
        }
        return str;
    }

    // Getter methods for options
    get indentSize(): number { return this.options.indentSize; }
    get printWidth(): number { return this.options.printWidth; }
    get maxConsecutiveEmptyLines(): number { return this.options.maxConsecutiveEmptyLines; }
    get insertFinalNewline(): boolean { return this.options.insertFinalNewline; }
    get trimTrailingWhitespace(): boolean { return this.options.trimTrailingWhitespace; }
    get blankLinesAroundFunctions(): number { return this.options.blankLinesAroundFunctions; }
    get formatPipelines(): boolean { return this.options.formatPipelines; }
    get formatParameters(): boolean { return this.options.formatParameters; }
    get formatHashtables(): boolean { return this.options.formatHashtables; }
    get formatArrays(): boolean { return this.options.formatArrays; }
    get formatComments(): boolean { return this.options.formatComments; }

    /**
     * 创建规则的副本，可以重写部分选项
     */
    withOptions(overrides: Partial<FormatterOptions>): FormatterRules {
        return new FormatterRules({ ...this.options, ...overrides });
    }
}
