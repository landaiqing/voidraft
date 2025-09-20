/**
 * Prettier Plugin for Go formatting using gofmt WebAssembly
 * 
 * This plugin provides support for formatting Go files using the gofmt WASM implementation.
 */
import type { Plugin, Parser, Printer } from 'prettier';

// Import the gofmt WASM module
import gofmtInit, { format } from './gofmt_vite.js';

const parserName = 'go';

// Language configuration
const languages = [
    {
        name: 'Go',
        aliases: ['go', 'golang'],
        parsers: [parserName],
        extensions: ['.go'],
        aceMode: 'golang',
        tmScope: 'source.go',
        linguistLanguageId: 132,
        vscodeLanguageIds: ['go']
    }
];

// Parser configuration
const goParser: Parser<string> = {
    astFormat: parserName,
    parse: (text: string) => text,
    locStart: () => 0,
    locEnd: (node: string) => node.length,
};

// Lazy initialize gofmt WASM module
let initPromise: Promise<void> | null = null;
let isInitialized = false;

function initGofmt(): Promise<void> {
    if (isInitialized) {
        return Promise.resolve();
    }
    
    if (!initPromise) {
        initPromise = (async () => {
            try {
                await gofmtInit();
                isInitialized = true;
            } catch (error) {
                console.warn('Failed to initialize gofmt WASM module:', error);
                initPromise = null;
                throw error;
            }
        })();
    }
    
    return initPromise;
}

// Printer configuration
const goPrinter: Printer<string> = {
    // @ts-expect-error -- Support async printer like shell plugin
    async print(path, options) {
        try {
            // Wait for initialization to complete
            await initGofmt();
            
            const text = (path as any).getValue ? (path as any).getValue() : path.node;
            
            // Format using gofmt (synchronous call)
            const formatted = format(text);
            
            return formatted.trim();
        } catch (error) {
            console.warn('Go formatting failed:', error);
            // Return original text if formatting fails
            return (path as any).getValue ? (path as any).getValue() : path.node;
        }
    },
};

// Plugin options (Go doesn't need additional config options)
const options = {};

// Plugin definition
const goPlugin: Plugin = {
    languages,
    parsers: {
        [parserName]: goParser,
    },
    printers: {
        [parserName]: goPrinter,
    },
    options,
};

// Export plugin without auto-initialization
export default goPlugin;
export { languages, initGofmt as initialize };
export const parsers = goPlugin.parsers;
export const printers = goPlugin.printers;