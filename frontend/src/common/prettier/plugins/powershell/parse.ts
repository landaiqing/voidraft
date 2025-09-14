/**
 * PowerShell 代码解析器和格式化器
 */

// PowerShell AST节点类型
interface PowerShellAstNode {
    type: string;
    value: string;
    start?: number;
    end?: number;
    parent?: PowerShellAstNode;
    extent?: any;
}

// 解析器函数类型
type PowerShellParserResult = PowerShellAstNode | PowerShellAstNode[];

// PowerShell格式化选项
export interface PowerShellFormatterOptions {
    /** 缩进大小，默认为4 */
    indentSize?: number;
    /** 使用制表符还是空格，默认为空格 */
    useTabsForIndentation?: boolean;
    /** 行最大长度，默认为120 */
    printWidth?: number;
    /** 是否在操作符周围添加空格，默认为true */
    spaceAroundOperators?: boolean;
    /** 是否格式化注释，默认为true */
    formatComments?: boolean;
    /** 是否去除多余的空行，默认为true */
    removeExtraBlankLines?: boolean;
    /** 是否格式化管道符，默认为true */
    formatPipelines?: boolean;
    /** 是否格式化括号内空格，默认为true */
    formatParentheses?: boolean;
    /** 是否格式化数组和哈希表，默认为true */
    formatArraysAndHashtables?: boolean;
    /** 最大连续空行数，默认为1 */
    maxConsecutiveEmptyLines?: number;
    /** 是否在代码块前后添加空行，默认为true */
    addBlankLinesAroundBlocks?: boolean;
    /** 是否格式化长行（自动换行），默认为true */
    formatLongLines?: boolean;
    /** 是否格式化函数定义，默认为true */
    formatFunctionDefinitions?: boolean;
    /** 是否格式化PowerShell特有语法（switch、try-catch、param等），默认为true */
    formatPowerShellSyntax?: boolean;
}

/**
 * PowerShell代码格式化器 - 修复版本
 */
class PowerShellFormatter {
    private options: Required<PowerShellFormatterOptions>;

    constructor(options: PowerShellFormatterOptions = {}) {
        this.options = {
            indentSize: options.indentSize ?? 4,
            useTabsForIndentation: options.useTabsForIndentation ?? false,
            printWidth: options.printWidth ?? 120,
            spaceAroundOperators: options.spaceAroundOperators ?? true,
            formatComments: options.formatComments ?? true,
            removeExtraBlankLines: options.removeExtraBlankLines ?? true,
            formatPipelines: options.formatPipelines ?? true,
            formatParentheses: options.formatParentheses ?? true,
            formatArraysAndHashtables: options.formatArraysAndHashtables ?? true,
            maxConsecutiveEmptyLines: options.maxConsecutiveEmptyLines ?? 1,
            addBlankLinesAroundBlocks: options.addBlankLinesAroundBlocks ?? true,
            formatLongLines: options.formatLongLines ?? true,
            formatFunctionDefinitions: options.formatFunctionDefinitions ?? true,
            formatPowerShellSyntax: options.formatPowerShellSyntax ?? true,
        };
    }

    /**
     * 格式化PowerShell代码
     */
    format(code: string): string {
        if (!code || code.trim().length === 0) {
            return code;
        }

        try {
            const lines = code.split('\n');
            let formattedLines = this.formatLines(lines);
            
            // 处理多余空行
            if (this.options.removeExtraBlankLines) {
                formattedLines = this.removeExtraBlankLines(formattedLines);
            }
            
            // 在代码块前后添加适当的空行
            if (this.options.addBlankLinesAroundBlocks) {
                formattedLines = this.addBlankLinesAroundBlocks(formattedLines);
            }
            
            return formattedLines.join('\n');
        } catch (error) {
            console.warn('PowerShell formatting failed:', error);
            return code; // 返回原始代码
        }
    }

    private formatLines(lines: string[]): string[] {
        const result: string[] = [];
        let indentLevel = 0;
        let inMultiLineComment = false;
        let inHereString = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            // 检查 Here-String (@"..."@ 或 @'...'@)
            if (trimmedLine.startsWith('@"') || trimmedLine.startsWith("@'")) {
                if (!trimmedLine.endsWith('"@') && !trimmedLine.endsWith("'@")) {
                    inHereString = true;
                }
            }
            if (inHereString && (trimmedLine.endsWith('"@') || trimmedLine.endsWith("'@"))) {
                inHereString = false;
                result.push(line); // Here-String 结束行保持原样
                continue;
            }

            // 在 Here-String 内部不处理
            if (inHereString) {
                result.push(line);
                continue;
            }

            // 检查多行注释
            if (trimmedLine.includes('<#')) {
                inMultiLineComment = true;
            }
            if (trimmedLine.includes('#>')) {
                inMultiLineComment = false;
                result.push(this.getIndent(indentLevel) + trimmedLine);
                continue;
            }
            if (inMultiLineComment) {
                result.push(this.getIndent(indentLevel) + trimmedLine);
                continue;
            }

            // 处理空行
            if (trimmedLine.length === 0) {
                result.push('');
                continue;
            }

            // 检查是否需要减少缩进级别
            if (this.shouldDecreaseIndent(trimmedLine)) {
                indentLevel = Math.max(0, indentLevel - 1);
            }

            // 格式化当前行
            const formattedLine = this.formatLine(trimmedLine);
            result.push(this.getIndent(indentLevel) + formattedLine);

            // 检查是否需要增加缩进级别
            if (this.shouldIncreaseIndent(trimmedLine)) {
                indentLevel++;
            }
        }

        return result;
    }

    private formatLine(line: string): string {
        let formatted = line;

        // 处理操作符周围的空格
        if (this.options.spaceAroundOperators) {
            formatted = this.addSpacesAroundOperators(formatted);
        }

        // 格式化注释
        if (this.options.formatComments) {
            formatted = this.formatComment(formatted);
        }

        // 格式化管道符
        if (this.options.formatPipelines) {
            formatted = this.formatPipelines(formatted);
        }

        // 格式化括号
        if (this.options.formatParentheses) {
            formatted = this.formatParentheses(formatted);
        }

        // 格式化数组和哈希表
        if (this.options.formatArraysAndHashtables) {
            formatted = this.formatArraysAndHashtables(formatted);
        }

        // 格式化函数定义
        if (this.options.formatFunctionDefinitions) {
            formatted = this.formatFunctionDefinitions(formatted);
        }

        // 格式化PowerShell特有语法
        if (this.options.formatPowerShellSyntax) {
            formatted = this.formatPowerShellSyntax(formatted);
        }

        // 格式化长行（如果需要）
        if (this.options.formatLongLines && formatted.length > this.options.printWidth) {
            formatted = this.formatLongLine(formatted);
        }

        return formatted;
    }

    private addSpacesAroundOperators(line: string): string {
        // 定义PowerShell操作符映射 - 修复版本
        const operatorMappings = [
            // 赋值操作符
            { pattern: /\s*=\s*/g, replacement: ' = ' },
            { pattern: /\s*\+=\s*/g, replacement: ' += ' },
            { pattern: /\s*-=\s*/g, replacement: ' -= ' },
            { pattern: /\s*\*=\s*/g, replacement: ' *= ' },
            { pattern: /\s*\/=\s*/g, replacement: ' /= ' },
            { pattern: /\s*%=\s*/g, replacement: ' %= ' },
            
            // 算术操作符 (避免与参数冲突)
            { pattern: /(\w)\s*\+\s*(\w)/g, replacement: '$1 + $2' },
            { pattern: /(\w)\s*-\s*(\w)/g, replacement: '$1 - $2' },
            { pattern: /(\w)\s*\*\s*(\w)/g, replacement: '$1 * $2' },
            { pattern: /(\w)\s*\/\s*(\w)/g, replacement: '$1 / $2' },
            { pattern: /(\w)\s*%\s*(\w)/g, replacement: '$1 % $2' },
            
            // 比较操作符
            { pattern: /\s*-eq\s*/g, replacement: ' -eq ' },
            { pattern: /\s*-ne\s*/g, replacement: ' -ne ' },
            { pattern: /\s*-lt\s*/g, replacement: ' -lt ' },
            { pattern: /\s*-le\s*/g, replacement: ' -le ' },
            { pattern: /\s*-gt\s*/g, replacement: ' -gt ' },
            { pattern: /\s*-ge\s*/g, replacement: ' -ge ' },
            { pattern: /\s*-like\s*/g, replacement: ' -like ' },
            { pattern: /\s*-notlike\s*/g, replacement: ' -notlike ' },
            { pattern: /\s*-match\s*/g, replacement: ' -match ' },
            { pattern: /\s*-notmatch\s*/g, replacement: ' -notmatch ' },
            { pattern: /\s*-contains\s*/g, replacement: ' -contains ' },
            { pattern: /\s*-notcontains\s*/g, replacement: ' -notcontains ' },
            { pattern: /\s*-in\s*/g, replacement: ' -in ' },
            { pattern: /\s*-notin\s*/g, replacement: ' -notin ' },
            
            // 逻辑操作符
            { pattern: /\s*-and\s*/g, replacement: ' -and ' },
            { pattern: /\s*-or\s*/g, replacement: ' -or ' },
            { pattern: /\s*-not\s*/g, replacement: ' -not ' },
            { pattern: /\s*-xor\s*/g, replacement: ' -xor ' },
        ];

        let result = line;

        // 先保护字符串字面量
        const strings: string[] = [];
        let stringIndex = 0;
        
        // 保护双引号字符串
        result = result.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match) => {
            const placeholder = `__STRING_${stringIndex++}__`;
            strings.push(match);
            return placeholder;
        });
        
        // 保护单引号字符串
        result = result.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, (match) => {
            const placeholder = `__STRING_${stringIndex++}__`;
            strings.push(match);
            return placeholder;
        });

        // 应用操作符格式化
        operatorMappings.forEach(({ pattern, replacement }) => {
            result = result.replace(pattern, replacement);
        });

        // 清理多余的空格，但不要合并所有空格
        result = result.replace(/\s{2,}/g, ' ');

        // 还原字符串
        strings.forEach((str, index) => {
            result = result.replace(`__STRING_${index}__`, str);
        });

        return result.trim();
    }

    private removeExtraBlankLines(lines: string[]): string[] {
        const result: string[] = [];
        let consecutiveEmptyLines = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const isEmptyLine = line.trim() === '';

            if (isEmptyLine) {
                consecutiveEmptyLines++;
                // 只保留指定数量的连续空行
                if (consecutiveEmptyLines <= this.options.maxConsecutiveEmptyLines) {
                    result.push(line);
                }
            } else {
                consecutiveEmptyLines = 0;
                result.push(line);
            }
        }

        // 去除文件开头和结尾的空行
        while (result.length > 0 && result[0].trim() === '') {
            result.shift();
        }
        while (result.length > 0 && result[result.length - 1].trim() === '') {
            result.pop();
        }

        return result;
    }

    private formatPipelines(line: string): string {
        // 格式化管道符 |
        let result = line;

        // 保护字符串字面量
        const strings: string[] = [];
        let stringIndex = 0;
        
        result = result.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, (match) => {
            const placeholder = `__STRING_${stringIndex++}__`;
            strings.push(match);
            return placeholder;
        });

        // 格式化管道符，确保前后有空格
        result = result.replace(/\s*\|\s*/g, ' | ');

        // 还原字符串
        strings.forEach((str, index) => {
            result = result.replace(`__STRING_${index}__`, str);
        });

        return result;
    }

    private formatParentheses(line: string): string {
        // 格式化括号内的空格
        let result = line;

        // 保护字符串字面量
        const strings: string[] = [];
        let stringIndex = 0;
        
        result = result.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, (match) => {
            const placeholder = `__STRING_${stringIndex++}__`;
            strings.push(match);
            return placeholder;
        });

        // 格式化括号：( 后和 ) 前不要多余空格，但参数之间要有空格
        result = result.replace(/\(\s+/g, '(');
        result = result.replace(/\s+\)/g, ')');
        
        // 格式化逗号：逗号后加空格
        result = result.replace(/,\s*/g, ', ');

        // 格式化分号：分号后加空格
        result = result.replace(/;\s*/g, '; ');

        // 还原字符串
        strings.forEach((str, index) => {
            result = result.replace(`__STRING_${index}__`, str);
        });

        return result;
    }

    private formatArraysAndHashtables(line: string): string {
        // 格式化数组 @() 和哈希表 @{}
        let result = line;

        // 保护字符串字面量
        const strings: string[] = [];
        let stringIndex = 0;
        
        result = result.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, (match) => {
            const placeholder = `__STRING_${stringIndex++}__`;
            strings.push(match);
            return placeholder;
        });

        // 格式化数组符号
        result = result.replace(/@\(\s*/g, '@(');
        result = result.replace(/\s*\)/g, ')');

        // 格式化哈希表符号
        result = result.replace(/@\{\s*/g, '@{');
        result = result.replace(/\s*\}/g, '}');

        // 格式化方括号
        result = result.replace(/\[\s+/g, '[');
        result = result.replace(/\s+\]/g, ']');

        // 还原字符串
        strings.forEach((str, index) => {
            result = result.replace(`__STRING_${index}__`, str);
        });

        return result;
    }

    private addBlankLinesAroundBlocks(lines: string[]): string[] {
        const result: string[] = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            const previousLine = i > 0 ? lines[i - 1].trim() : '';
            const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';

            // 在函数定义前添加空行（除非是文件开头或前面已经有空行）
            if (this.isFunctionDefinition(trimmedLine)) {
                if (i > 0 && previousLine !== '' && result.length > 0) {
                    result.push('');
                }
            }

            // 在控制结构前添加空行（if, while, for, foreach, switch等）
            if (this.isControlStructure(trimmedLine)) {
                if (i > 0 && previousLine !== '' && !this.isElseOrElseIf(trimmedLine) && result.length > 0) {
                    result.push('');
                }
            }

            result.push(line);

            // 在函数定义后的右大括号后添加空行
            if (trimmedLine === '}' && this.isPreviousLineFunctionEnd(lines, i)) {
                if (i < lines.length - 1 && nextLine !== '') {
                    result.push('');
                }
            }
        }

        return result;
    }

    private formatFunctionDefinitions(line: string): string {
        // 格式化函数定义
        let result = line;

        // 函数定义的模式匹配
        const functionPattern = /^(\s*)(function\s+)([^\s\(]+)(\s*)(\(.*?\))(\s*)(\{?)(.*)$/i;
        const match = result.match(functionPattern);

        if (match) {
            const [, indent, funcKeyword, funcName, , params, , openBrace, rest] = match;
            
            // 标准化函数定义格式：function FunctionName(Parameters) {
            if (openBrace === '{' && rest.trim() === '') {
                // 单独一行的开括号
                result = `${indent}${funcKeyword}${funcName}${params} {`;
            } else if (openBrace === '' && rest.trim().startsWith('{')) {
                // 括号在下一行，移到同一行
                result = `${indent}${funcKeyword}${funcName}${params} {`;
            } else {
                // 标准格式化
                result = `${indent}${funcKeyword}${funcName}${params} {`;
            }
        }

        return result;
    }

    private formatLongLine(line: string): string {
        // 处理长行，在适当的位置换行
        if (line.length <= this.options.printWidth) {
            return line;
        }

        const indent = line.match(/^\s*/)?.[0] || '';
        const content = line.trim();

        // 查找可以换行的位置：管道符、逗号、操作符等
        const breakPoints = [
            { char: ' | ', priority: 1 },
            { char: ', ', priority: 2 },
            { char: ' -and ', priority: 3 },
            { char: ' -or ', priority: 3 },
            { char: ' = ', priority: 4 },
            { char: ' + ', priority: 5 },
            { char: ' -', priority: 6 }
        ];

        // 寻找最佳换行点
        for (const breakPoint of breakPoints) {
            const index = content.lastIndexOf(breakPoint.char, this.options.printWidth - indent.length);
            if (index > 0) {
                const firstPart = content.substring(0, index + breakPoint.char.length).trim();
                const secondPart = content.substring(index + breakPoint.char.length).trim();
                
                if (secondPart.length > 0) {
                    const continuationIndent = indent + '    '; // 额外缩进
                    return `${indent}${firstPart}\n${continuationIndent}${secondPart}`;
                }
            }
        }

        return line; // 如果找不到合适的断点，保持原样
    }

    private isFunctionDefinition(line: string): boolean {
        return /^\s*function\s+\w+/i.test(line);
    }

    private isControlStructure(line: string): boolean {
        const controlKeywords = [
            /^\s*if\s*\(/i,
            /^\s*while\s*\(/i,
            /^\s*for\s*\(/i,
            /^\s*foreach\s*\(/i,
            /^\s*switch\s*\(/i,
            /^\s*try\s*\{?$/i,
            /^\s*do\s*\{?$/i
        ];

        return controlKeywords.some(pattern => pattern.test(line));
    }

    private isElseOrElseIf(line: string): boolean {
        return /^\s*(else|elseif)\b/i.test(line);
    }

    private isPreviousLineFunctionEnd(lines: string[], currentIndex: number): boolean {
        // 检查是否是函数结束的大括号
        let braceCount = 0;
        let foundFunction = false;

        for (let i = currentIndex - 1; i >= 0; i--) {
            const line = lines[i].trim();
            
            if (line.includes('}')) {
                braceCount += (line.match(/\}/g) || []).length;
            }
            if (line.includes('{')) {
                braceCount -= (line.match(/\{/g) || []).length;
            }
            
            if (this.isFunctionDefinition(line)) {
                foundFunction = true;
                break;
            }
            
            if (braceCount < 0) break; // 遇到不匹配的括号
        }

        return foundFunction && braceCount === 1;
    }

    private formatPowerShellSyntax(line: string): string {
        let result = line;

        // 格式化switch语句
        result = this.formatSwitchStatement(result);
        
        // 格式化try-catch-finally语句
        result = this.formatTryCatchFinally(result);
        
        // 格式化param块
        result = this.formatParamBlock(result);
        
        // 格式化PowerShell操作符和关键字
        result = this.formatPowerShellKeywords(result);
        
        // 格式化变量声明
        result = this.formatVariableDeclarations(result);

        return result;
    }

    private formatSwitchStatement(line: string): string {
        let result = line;

        // 格式化switch语句: switch ($variable) {
        const switchPattern = /^(\s*)(switch)\s*(\(.*?\))\s*(\{?)(.*)$/i;
        const match = result.match(switchPattern);

        if (match) {
            const [, indent, switchKeyword, condition, brace, rest] = match;
            result = `${indent}${switchKeyword} ${condition} {`;
        }

        // 格式化switch case标签
        if (/^\s*\{?\s*[^}]*\s*\{\s*$/.test(result) || /^\s*default\s*\{\s*$/.test(result)) {
            result = result.replace(/\s*\{\s*$/, ' {');
        }

        return result;
    }

    private formatTryCatchFinally(line: string): string {
        let result = line;

        // 格式化try语句
        if (/^\s*try\s*\{?/i.test(result)) {
            result = result.replace(/^(\s*)(try)\s*\{?(.*)$/i, '$1$2 {$3');
        }

        // 格式化catch语句
        const catchPattern = /^(\s*)(catch)\s*(\[[^\]]*\])?\s*\{?(.*)$/i;
        const catchMatch = result.match(catchPattern);
        if (catchMatch) {
            const [, indent, catchKeyword, exceptionType, rest] = catchMatch;
            const exception = exceptionType || '';
            result = `${indent}${catchKeyword}${exception} {${rest}`;
        }

        // 格式化finally语句
        if (/^\s*finally\s*\{?/i.test(result)) {
            result = result.replace(/^(\s*)(finally)\s*\{?(.*)$/i, '$1$2 {$3');
        }

        return result;
    }

    private formatParamBlock(line: string): string {
        let result = line;

        // 格式化param块开始
        if (/^\s*param\s*\(/i.test(result)) {
            result = result.replace(/^(\s*)(param)\s*\(/i, '$1$2(');
        }

        // 格式化参数属性
        const paramAttributePattern = /^\s*(\[Parameter\([^\]]*\)\])\s*(.*)$/i;
        const attrMatch = result.match(paramAttributePattern);
        if (attrMatch) {
            const [, attribute, rest] = attrMatch;
            result = `    ${attribute}\n    ${rest}`;
        }

        return result;
    }

    private formatPowerShellKeywords(line: string): string {
        let result = line;

        // PowerShell关键字列表
        const keywords = [
            'begin', 'process', 'end', 'filter', 'class', 'enum',
            'using', 'namespace', 'return', 'throw', 'break', 'continue',
            'exit', 'param', 'dynamicparam', 'workflow', 'configuration'
        ];

        // 确保关键字后有适当的空格
        keywords.forEach(keyword => {
            const pattern = new RegExp(`\\b(${keyword})\\s*`, 'gi');
            result = result.replace(pattern, `$1 `);
        });

        // 特殊处理某些关键字
        result = result.replace(/\breturn\s+/gi, 'return ');
        result = result.replace(/\bthrow\s+/gi, 'throw ');

        return result;
    }

    private formatVariableDeclarations(line: string): string {
        let result = line;

        // 格式化变量类型声明: [string]$variable = value
        const typeVarPattern = /^(\s*)(\[[^\]]+\])\s*(\$\w+)\s*(=.*)?$/;
        const match = result.match(typeVarPattern);

        if (match) {
            const [, indent, type, variable, assignment] = match;
            result = `${indent}${type}${variable}${assignment || ''}`;
        }

        return result;
    }

    private formatComment(line: string): string {
        // 单行注释格式化
        if (line.includes('#') && !line.includes('<#') && !line.includes('#>')) {
            const commentIndex = line.indexOf('#');
            const beforeComment = line.substring(0, commentIndex).trim();
            const comment = line.substring(commentIndex).trim();
            
            if (beforeComment.length > 0) {
                // 确保注释前有适当的空格
                return `${beforeComment} ${comment}`;
            }
            return comment;
        }
        return line;
    }

    private shouldIncreaseIndent(line: string): boolean {
        // PowerShell 块开始模式
        const blockStartPatterns = [
            /\{\s*$/,  // 单独的大括号
            /\bif\s*\([^)]*\)\s*\{\s*$/i,
            /\belseif\s*\([^)]*\)\s*\{\s*$/i,
            /\belse\s*\{\s*$/i,
            /\bwhile\s*\([^)]*\)\s*\{\s*$/i,
            /\bfor\s*\([^)]*\)\s*\{\s*$/i,
            /\bforeach\s*\([^)]*\)\s*\{\s*$/i,
            /\bdo\s*\{\s*$/i,
            /\btry\s*\{\s*$/i,
            /\bcatch\s*(\[[^\]]*\])?\s*\{\s*$/i,
            /\bfinally\s*\{\s*$/i,
            /\bfunction\s+\w+.*\{\s*$/i,
        ];

        return blockStartPatterns.some(pattern => pattern.test(line));
    }

    private shouldDecreaseIndent(line: string): boolean {
        // PowerShell 块结束模式
        const blockEndPatterns = [
            /^\s*\}\s*$/,  // 单独的右大括号
            /^\s*\}\s*else/i,
            /^\s*\}\s*elseif/i,
            /^\s*\}\s*catch/i,
            /^\s*\}\s*finally/i,
        ];

        return blockEndPatterns.some(pattern => pattern.test(line));
    }

    private getIndent(level: number): string {
        if (level <= 0) return '';
        const indentChar = this.options.useTabsForIndentation ? '\t' : ' ';
        const indentSize = this.options.useTabsForIndentation ? 1 : this.options.indentSize;
        return indentChar.repeat(level * indentSize);
    }
}

/**
 * 便捷的格式化函数
 */
export function formatPowerShellCode(
    code: string, 
    options?: PowerShellFormatterOptions
): string {
    const formatter = new PowerShellFormatter(options);
    return formatter.format(code);
}

/**
 * PowerShell代码解析器
 */
const parser = (scriptContent: string): Promise<PowerShellParserResult> => {
    return new Promise((resolve) => {
        try {
            const astNode: PowerShellAstNode = {
                type: 'ScriptBlockAst',
                value: scriptContent,
                start: 0,
                end: scriptContent.length
            };
            
            resolve(astNode);
        } catch (error) {
            console.warn('PowerShell parsing fallback used:', error);
            resolve({
                type: 'ScriptBlockAst',
                value: scriptContent,
                start: 0,
                end: scriptContent.length
            });
        }
    });
};

/**
 * Prettier解析函数
 */
const parse = async (scriptContent: string, parsers?: any, opts?: any): Promise<PowerShellParserResult> => {
    return await parser(scriptContent);
};

export default parse;