/**
 * Prettier Plugin for PowerShell file formatting
 * 
 * This plugin provides support for formatting PowerShell files (.ps1, .psm1, .psd1)
 * using PowerShell's native AST parser for accurate syntax analysis.
 */
import type { Plugin, Parser, Printer, AstPath, Doc } from 'prettier';
import parse, { formatPowerShellCode } from './parse';

// PowerShell AST节点接口
interface PowerShellAstNode {
    type: string;
    value: string;
    start?: number;
    end?: number;
    parent?: PowerShellAstNode;
    extent?: any;
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
const powershellParser: Parser<PowerShellAstNode | PowerShellAstNode[]> = {
    parse,
    astFormat: 'powershell',
    locStart: () => 0,
    locEnd: () => 0,
};

const printPosh = (path: AstPath<PowerShellAstNode | PowerShellAstNode[]>, options: any, print: any): Doc => {
    const pathNode = path.node;

    if (Array.isArray(pathNode)) {
        return pathNode.map(node => handleAst(node, path, options, print)).join('\n');
    }

    return handleAst(pathNode, path, options, print);
};

const handleAst = (node: PowerShellAstNode, path: AstPath<any>, options: any, print: any): Doc => {
    if (typeof node === 'undefined') {
        return '';
    }
    
    // 使用修复后的PowerShell格式化器
    try {
        const formattedCode = formatPowerShellCode(node.value, {
            indentSize: options.tabWidth || 4,
            useTabsForIndentation: options.useTabs || false,
            printWidth: options.printWidth || 120,
            spaceAroundOperators: true,
            formatComments: true,
            removeExtraBlankLines: true,
            formatPipelines: true,
            formatParentheses: true,
            formatArraysAndHashtables: true,
            maxConsecutiveEmptyLines: 1,
            addBlankLinesAroundBlocks: true,
            formatLongLines: true,
            formatFunctionDefinitions: true,
            formatPowerShellSyntax: true,
        });
        
        return formattedCode;
    } catch (error) {
        console.warn('PowerShell formatting failed, returning original code:', error);
        return node.value || '';
    }
};

// 打印器配置
const powershellPrinter: Printer<PowerShellAstNode | PowerShellAstNode[]> = {
    print: printPosh,
};

// 插件选项
const options = {

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