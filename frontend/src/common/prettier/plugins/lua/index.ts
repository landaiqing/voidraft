/**
 * Prettier Plugin for Lua formatting using StyLua WebAssembly
 * 
 * This plugin provides support for formatting Lua files using the StyLua WASM implementation.
 * StyLua is a fast Lua code formatter written in Rust.
 */
import type { Plugin, Parser, Printer } from 'prettier';

// Import the StyLua WASM module
import luaInit, { format, type Config } from './lua_fmt_vite.js';

const parserName = 'lua';

// Language configuration
const languages = [
    {
        name: 'Lua',
        aliases: ['lua'],
        parsers: [parserName],
        extensions: ['.lua'],
        aceMode: 'lua',
        tmScope: 'source.lua',
        linguistLanguageId: 213,
        vscodeLanguageIds: ['lua']
    }
];

// Parser configuration
const luaParser: Parser<string> = {
    astFormat: parserName,
    parse: (text: string) => text,
    locStart: () => 0,
    locEnd: (node: string) => node.length,
};

// Initialize StyLua WASM module
let initPromise: Promise<void> | null = null;
let isInitialized = false;

function initStyLua(): Promise<void> {
    if (initPromise) {
        return initPromise;
    }
    
    initPromise = (async () => {
        if (!isInitialized) {
            await luaInit();
            isInitialized = true;
        }
    })();
    
    return initPromise;
}

// Printer configuration
const luaPrinter: Printer<string> = {
    print: (path, options) => {
        try {
            if (!isInitialized) {
                console.warn('StyLua WASM module not initialized, returning original text');
                return (path as any).getValue ? (path as any).getValue() : path.node;
            }
            
            const text = (path as any).getValue ? (path as any).getValue() : path.node;
            const config = getStyLuaConfig(options);
            
            // Format using StyLua (synchronous call)
            const formatted = format(text, "input.lua", config);
            
            return formatted.trim();
        } catch (error) {
            console.warn('StyLua formatting failed:', error);
            // Return original text if formatting fails
            return (path as any).getValue ? (path as any).getValue() : path.node;
        }
    },
};

// Helper function to create StyLua config from Prettier options
function getStyLuaConfig(options: any): Config {
    const config: Config = {};
    
    // Map Prettier options to StyLua config
    if (options.useTabs !== undefined) {
        config.indent_style = options.useTabs ? 'tab' : 'space';
    }
    
    if (options.tabWidth !== undefined) {
        config.indent_width = options.tabWidth;
    }
    
    if (options.printWidth !== undefined) {
        config.line_width = options.printWidth;
    }
    
    if (options.endOfLine !== undefined) {
        config.line_ending = options.endOfLine === 'crlf' ? 'crlf' : 'lf';
    }
    
    if (options.singleQuote !== undefined) {
        config.quote_style = options.singleQuote ? 'AutoPreferSingle' : 'AutoPreferDouble';
    }
    
    // StyLua specific options
    if (options.luaCallParentheses !== undefined) {
        config.call_parentheses = options.luaCallParentheses;
    }
    
    if (options.luaCollapseSimpleStatement !== undefined) {
        config.collapse_simple_statement = options.luaCollapseSimpleStatement;
    }
    
    if (options.luaSortRequires !== undefined) {
        config.sort_requires = options.luaSortRequires;
    }
    
    return config;
}

// Plugin options
const options = {
    luaCallParentheses: {
        since: '0.0.1',
        category: 'Format' as const,
        type: 'choice' as const,
        default: 'Always',
        description: 'How to handle function call parentheses',
        choices: [
            { value: 'Always', description: 'Always use parentheses' },
            { value: 'NoSingleString', description: 'Remove parentheses for single string argument' },
            { value: 'NoSingleTable', description: 'Remove parentheses for single table argument' },
            { value: 'None', description: 'Remove parentheses when possible' },
            { value: 'Input', description: 'Keep input formatting' }
        ]
    },
    luaCollapseSimpleStatement: {
        since: '0.0.1',
        category: 'Format' as const,
        type: 'choice' as const,
        default: 'Never',
        description: 'How to handle simple statement collapsing',
        choices: [
            { value: 'Never', description: 'Never collapse simple statements' },
            { value: 'FunctionOnly', description: 'Collapse function statements only' },
            { value: 'ConditionalOnly', description: 'Collapse conditional statements only' },
            { value: 'Always', description: 'Always collapse simple statements' }
        ]
    },
    luaSortRequires: {
        since: '0.0.1',
        category: 'Format' as const,
        type: 'boolean' as const,
        default: false,
        description: 'Sort require statements alphabetically'
    }
};

// Plugin object
const luaPlugin: Plugin = {
    languages,
    parsers: {
        [parserName]: luaParser,
    },
    printers: {
        [parserName]: luaPrinter,
    },
    options,
};

// Initialize WASM module when plugin loads
initStyLua().catch(error => {
    console.warn('Failed to initialize StyLua WASM module:', error);
});

export default luaPlugin;
export { languages };
export const parsers = luaPlugin.parsers;
export const printers = luaPlugin.printers;
