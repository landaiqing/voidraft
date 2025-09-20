/**
 * Prettier Plugin for Rust formatting using rust WebAssembly
 * 
 * This plugin provides support for formatting Rust files using the rust WASM implementation.
 */
import type { Plugin, Parser, Printer } from 'prettier';

// Import the rust WASM module
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

// Lazy initialize rust WASM module
let initPromise: Promise<void> | null = null;
let isInitialized = false;

function initRustFmt(): Promise<void> {
    if (isInitialized) {
        return Promise.resolve();
    }
    
    if (!initPromise) {
        initPromise = (async () => {
            try {
                await rustFmtInit();
                isInitialized = true;
            } catch (error) {
                console.warn('Failed to initialize rust WASM module:', error);
                initPromise = null;
                throw error;
            }
        })();
    }
    
    return initPromise;
}

// Printer configuration
const rustPrinter: Printer<string> = {
    // @ts-expect-error -- Support async printer like shell plugin
    async print(path, options) {
        try {
            // Wait for initialization to complete
            await initRustFmt();
            
            const text = (path as any).getValue ? (path as any).getValue() : path.node;
            const config = getRustFmtConfig(options);
            
            // Format using rust (synchronous call)
            const formatted = format(text, config);
            
            return formatted.trim();
        } catch (error) {
            console.warn('Rust formatting failed:', error);
            // Return original text if formatting fails
            return (path as any).getValue ? (path as any).getValue() : path.node;
        }
    },
};

// Helper function to create rust config from Prettier options
function getRustFmtConfig(options: any): Config {
    const config: Config = {};
    
    // Map Prettier options to rust config
    if (options.useTabs !== undefined) {
        config.use_tabs = options.useTabs;
    }
    
    // Note: rust currently only supports use_tabs option
    // Future versions may support more options like tab_width
    
    return config;
}

// Plugin options
const options = {
    // Currently rust only supports use_tabs option
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

export default rustPlugin;
export { languages };
export const parsers = rustPlugin.parsers;
export const printers = rustPlugin.printers;
