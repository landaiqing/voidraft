/**
 * Prettier Plugin for PowerShell file formatting - Modular Version
 * 
 * This plugin provides support for formatting PowerShell files (.ps1, .psm1, .psd1)
 * using a modular architecture with lexer, parser, AST, and code generator.
 */
import type { Plugin, Parser, Printer, AstPath, Doc } from 'prettier';
import { PowerShellLexer } from './lexer';
import { PowerShellParser } from './parser';
import { ScriptBlockAst, CommentAst } from './ast';
import { formatPowerShellAST } from './code-generator';
import { FormatterOptions, DEFAULT_OPTIONS } from './formatter-rules';

// PowerShell格式化结果接口
interface PowerShellParseResult {
    ast: ScriptBlockAst;
    comments: CommentAst[];
    originalText: string;
}

const parserName = 'powershell';

// 语言配置
const languages = [
    {
        name: 'PowerShell',
        aliases: ['powershell', 'pwsh', 'posh'],
        parsers: [parserName],
        extensions: ['.ps1', '.psm1', '.psd1'],
        filenames: ['profile.ps1'],
        tmScope: 'source.powershell',
        aceMode: 'powershell',
        linguistLanguageId: 295,
        vscodeLanguageIds: ['powershell']
    },
];

// 解析器配置
const powershellParser: Parser<PowerShellParseResult> = {
    parse: parseCode,
    astFormat: 'powershell',
    locStart: (node: PowerShellParseResult) => 0,
    locEnd: (node: PowerShellParseResult) => node.originalText.length,
};

/**
 * 解析PowerShell代码
 */
async function parseCode(text: string, parsers?: any, options?: any): Promise<PowerShellParseResult> {
    try {
        // 词法分析
        const lexer = new PowerShellLexer(text);
        const tokens = lexer.tokenize();
        
        // 语法分析
        const parser = new PowerShellParser(tokens, text);
        const ast = parser.parse();
        const comments = parser.getComments();
        
        return {
            ast,
            comments,
            originalText: text
        };
    } catch (error) {
        console.warn('PowerShell parsing failed, using fallback:', error);
        
        // 解析失败时，创建一个包含原始文本的简单AST
        // 这样可以确保格式化失败时返回原始代码而不是空内容
        return {
            ast: {
                type: 'ScriptBlock',
                statements: [{
                    type: 'RawText',
                    value: text,
                    start: 0,
                    end: text.length,
                    line: 1,
                    column: 1
                } as any],
                start: 0,
                end: text.length,
                line: 1,
                column: 1
            },
            comments: [],
            originalText: text
        };
    }
}

/**
 * PowerShell代码打印器
 */
const printPowerShell = (path: AstPath<PowerShellParseResult>, options: any): Doc => {
    const parseResult = path.node;
    
    try {
        // 构建格式化选项 - 优先保持原有格式，避免破坏PowerShell语法
        const formatterOptions: Partial<FormatterOptions> = {
            indentSize: options.tabWidth || DEFAULT_OPTIONS.indentSize,
            useTabsForIndentation: options.useTabs || DEFAULT_OPTIONS.useTabsForIndentation,
            printWidth: options.printWidth || DEFAULT_OPTIONS.printWidth,
            spaceAroundOperators: true,
            formatPipelines: true,
            formatParameters: true,
            formatHashtables: true,
            hashtableStyle: 'compact',  // 强制使用紧凑格式，避免不必要的换行
            formatArrays: true,
            arrayStyle: 'compact',
            formatComments: true,
            maxConsecutiveEmptyLines: 1,
            insertFinalNewline: true,
            trimTrailingWhitespace: true,
            blankLinesAroundFunctions: 1,
            braceStyle: 'otbs',
            preferredCommandCase: 'preserve',  // 保持原有命令大小写，不破坏语法
            preferredParameterCase: 'preserve',
            preferredVariableCase: 'preserve',
            quotestyle: 'preserve',
            wrapLongLines: true
        };
        
        // 使用新的模块化格式化器
        const formattedCode = formatPowerShellAST(
            parseResult.ast, 
            parseResult.comments, 
            formatterOptions
        );
        
        return formattedCode;
    } catch (error) {
        console.warn('PowerShell formatting failed, returning original code:', error);
        return parseResult.originalText;
    }
};

// 打印器配置
const powershellPrinter: Printer<PowerShellParseResult> = {
    print: printPowerShell,
};

// 插件选项配置
const options = {
    // PowerShell特定格式化选项
    powershellBraceStyle: {
        type: 'choice' as const,
        category: 'PowerShell',
        default: DEFAULT_OPTIONS.braceStyle,
        description: 'PowerShell大括号样式',
        choices: [
            { value: 'allman', description: 'Allman风格（大括号另起一行）' },
            { value: 'otbs', description: '1TBS风格（大括号同行）' },
            { value: 'stroustrup', description: 'Stroustrup风格' }
        ]
    },
    powershellCommandCase: {
        type: 'choice' as const,
        category: 'PowerShell',
        default: DEFAULT_OPTIONS.preferredCommandCase,
        description: 'PowerShell命令大小写风格',
        choices: [
            { value: 'lowercase', description: '小写' },
            { value: 'uppercase', description: '大写' },
            { value: 'pascalcase', description: 'Pascal大小写' },
            { value: 'preserve', description: '保持原样' }
        ]
    },
    powershellPipelineStyle: {
        type: 'choice' as const,
        category: 'PowerShell',
        default: DEFAULT_OPTIONS.pipelineStyle,
        description: 'PowerShell管道样式',
        choices: [
            { value: 'oneline', description: '单行' },
            { value: 'multiline', description: '多行' },
            { value: 'auto', description: '自动' }
        ]
    },
    powershellSpaceAroundOperators: {
        type: 'boolean' as const,
        category: 'PowerShell',
        default: DEFAULT_OPTIONS.spaceAroundOperators,
        description: '在操作符周围添加空格'
    },
    powershellMaxEmptyLines: {
        type: 'int' as const,
        category: 'PowerShell',
        default: DEFAULT_OPTIONS.maxConsecutiveEmptyLines,
        description: '最大连续空行数'
    }
};

const powershellPlugin: Plugin = {
    languages,
    parsers: {
        [parserName]: powershellParser,
    },
    printers: {
        [parserName]: powershellPrinter,
    },
    options,
};

export default powershellPlugin;
export { languages };
export const parsers = powershellPlugin.parsers;
export const printers = powershellPlugin.printers;