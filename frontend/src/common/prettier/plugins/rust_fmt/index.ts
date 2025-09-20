/**
 * Prettier Plugin for Rust formatting using rust_fmt WebAssembly
 * 
 * This plugin provides support for formatting Rust files using the rust_fmt WASM implementation.
 */
import type { Plugin, Parser, Printer } from 'prettier';

// Import the rust_fmt WASM module
import rustFmtInit, { format, type Config } from './rust_fmt_vite.js';

const parserName = 'rust';

// Language configuration
const languages = [
    {
        name: 'Rust',
        aliases: ['rust', 'rs'],
        parsers: [parserName],
        extensions: ['.rs', '.rs.in'],
        aceMode: 'rust',
        tmScope: 'source.rust',
        linguistLanguageId: 327,
        vscodeLanguageIds: ['rust']
    }
];

// Parser configuration
const rustParser: Parser<string> = {
    astFormat: parserName,
    parse: (text: string) => text,
    locStart: () => 0,
    locEnd: (node: string) => node.length,
};

// Initialize rust_fmt WASM module
let initPromise: Promise<void> | null = null;
let isInitialized = false;

function initRustFmt(): Promise<void> {
    if (initPromise) {
        return initPromise;
    }
    
    initPromise = (async () => {
        if (!isInitialized) {
            await rustFmtInit();
            isInitialized = true;
        }
    })();
    
    return initPromise;
}

// Printer configuration
const rustPrinter: Printer<string> = {
    print: (path, options) => {
        try {
            if (!isInitialized) {
                console.warn('rust_fmt WASM module not initialized, returning original text');
                return (path as any).getValue ? (path as any).getValue() : path.node;
            }
            
            const text = (path as any).getValue ? (path as any).getValue() : path.node;
            const config = getRustFmtConfig(options);
            
            // Format using rust_fmt (synchronous call)
            const formatted = format(text, config);
            
            return formatted.trim();
        } catch (error) {
            console.warn('Rust formatting failed:', error);
            // Return original text if formatting fails
            return (path as any).getValue ? (path as any).getValue() : path.node;
        }
    },
};

// Helper function to create rust_fmt config from Prettier options
function getRustFmtConfig(options: any): Config {
    const config: Config = {};
    
    // Map Prettier options to rust_fmt config
    if (options.useTabs !== undefined) {
        config.use_tabs = options.useTabs;
    }
    
    // Note: rust_fmt currently only supports use_tabs option
    // Future versions may support more options like tab_width
    
    return config;
}

// Plugin options
const options = {
    // Currently rust_fmt only supports use_tabs option
    // The tab width and other formatting options are handled by prettyplease internally
};

// Plugin definition
const rustPlugin: Plugin = {
    languages,
    parsers: {
        [parserName]: rustParser,
    },
    printers: {
        [parserName]: rustPrinter,
    },
    options,
};

// Initialize the WASM module
initRustFmt().catch(error => {
    console.error('Failed to initialize rust_fmt WASM module:', error);
});

export default rustPlugin;
export { languages };
export const parsers = rustPlugin.parsers;
export const printers = rustPlugin.printers;
