/**
 * Prettier Plugin for Python formatting using Ruff WebAssembly
 * 
 * This plugin provides support for formatting Python files using the Ruff WASM implementation.
 * Ruff is a fast Python linter and code formatter written in Rust.
 */
import type { Plugin, Parser, Printer } from 'prettier';

// Import the Ruff WASM module
import ruffInit, { format, type Config } from './ruff_fmt_vite.js';

const parserName = 'python';

// Language configuration
const languages = [
    {
        name: 'Python',
        aliases: ['python', 'py'],
        parsers: [parserName],
        extensions: ['.py', '.pyi', '.pyw'],
        aceMode: 'python',
        tmScope: 'source.python',
        linguistLanguageId: 303,
        vscodeLanguageIds: ['python']
    }
];

// Parser configuration
const pythonParser: Parser<string> = {
    astFormat: parserName,
    parse: (text: string) => text,
    locStart: () => 0,
    locEnd: (node: string) => node.length,
};

// Initialize Ruff WASM module
let initPromise: Promise<void> | null = null;
let isInitialized = false;

function initRuff(): Promise<void> {
    if (initPromise) {
        return initPromise;
    }
    
    initPromise = (async () => {
        if (!isInitialized) {
            await ruffInit();
            isInitialized = true;
        }
    })();
    
    return initPromise;
}

// Printer configuration
const pythonPrinter: Printer<string> = {
    print: (path, options) => {
        try {
            if (!isInitialized) {
                console.warn('Ruff WASM module not initialized, returning original text');
                return (path as any).getValue ? (path as any).getValue() : path.node;
            }
            
            const text = (path as any).getValue ? (path as any).getValue() : path.node;
            const config = getRuffConfig(options);
            
            // Format using Ruff (synchronous call)
            const formatted = format(text, undefined, config);
            
            return formatted.trim();
        } catch (error) {
            console.warn('Ruff formatting failed:', error);
            // Return original text if formatting fails
            return (path as any).getValue ? (path as any).getValue() : path.node;
        }
    },
};

// Helper function to create Ruff config from Prettier options
function getRuffConfig(options: any): Config {
    const config: Config = {};
    
    // Map Prettier options to Ruff config
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
        config.quote_style = options.singleQuote ? 'single' : 'double';
    }
    
    if (options.ruffMagicTrailingComma !== undefined) {
        config.magic_trailing_comma = options.ruffMagicTrailingComma;
    }
    
    return config;
}

// Plugin options
const options = {
    ruffMagicTrailingComma: {
        since: '0.0.1',
        category: 'Format' as const,
        type: 'choice' as const,
        default: 'respect',
        description: 'How to handle trailing commas in collections',
        choices: [
            { value: 'respect', description: 'Respect existing trailing commas' },
            { value: 'ignore', description: 'Remove trailing commas' }
        ]
    }
};

// Plugin object
const pythonPlugin: Plugin = {
    languages,
    parsers: {
        [parserName]: pythonParser,
    },
    printers: {
        [parserName]: pythonPrinter,
    },
    options,
};

// Initialize WASM module when plugin loads
initRuff().catch(error => {
    console.warn('Failed to initialize Ruff WASM module:', error);
});

export default pythonPlugin;
export { languages };
export const parsers = pythonPlugin.parsers;
export const printers = pythonPlugin.printers;
