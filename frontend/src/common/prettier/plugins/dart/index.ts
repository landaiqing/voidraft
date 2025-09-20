/**
 * Prettier Plugin for Dart formatting using dart_fmt WebAssembly
 * 
 * This plugin provides support for formatting Dart files using the dart_fmt WASM implementation.
 * dart_fmt is the official Dart code formatter integrated into the Dart SDK.
 */
import type { Plugin, Parser, Printer } from 'prettier';

// Import the Dart formatter WASM module
import dartInit, { format } from './dart_fmt_vite.js';

const parserName = 'dart';

// Language configuration
const languages = [
    {
        name: 'Dart',
        aliases: ['dart'],
        parsers: [parserName],
        extensions: ['.dart'],
        aceMode: 'dart',
        tmScope: 'source.dart',
        linguistLanguageId: 103,
        vscodeLanguageIds: ['dart']
    }
];

// Parser configuration
const dartParser: Parser<string> = {
    astFormat: parserName,
    parse: (text: string) => text,
    locStart: () => 0,
    locEnd: (node: string) => node.length,
};

// Initialize Dart WASM module
let initPromise: Promise<void> | null = null;
let isInitialized = false;

function initDart(): Promise<void> {
    if (initPromise) {
        return initPromise;
    }
    
    initPromise = (async () => {
        if (!isInitialized) {
            await dartInit();
            isInitialized = true;
        }
    })();
    
    return initPromise;
}

// Printer configuration
const dartPrinter: Printer<string> = {
    print: (path, options) => {
        try {
            if (!isInitialized) {
                console.warn('Dart WASM module not initialized, returning original text');
                return (path as any).getValue ? (path as any).getValue() : path.node;
            }
            
            const text = (path as any).getValue ? (path as any).getValue() : path.node;
            const config = getDartConfig(options);
            
            // Format using dart_fmt (synchronous call)
            const formatted = format(text, undefined, config);
            
            return formatted.trim();
        } catch (error) {
            console.warn('Dart formatting failed:', error);
            // Return original text if formatting fails
            return (path as any).getValue ? (path as any).getValue() : path.node;
        }
    },
};


// Helper function to create Dart config from Prettier options
function getDartConfig(options: any): any {
    const config: any = {};
    
    // Map Prettier options to Dart formatter config
    if (options.printWidth !== undefined) {
        config.line_width = options.printWidth;
    }
    
    if (options.endOfLine !== undefined) {
        config.line_ending = options.endOfLine === 'crlf' ? 'crlf' : 'lf';
    }
    
    // Dart language version (if specified)
    if (options.dartLanguageVersion !== undefined) {
        config.language_version = options.dartLanguageVersion;
    }
    
    return config;
}

// Plugin options
const options = {
    dartLanguageVersion: {
        since: '0.0.1',
        category: 'Format' as const,
        type: 'string' as const,
        default: undefined,
        description: 'Dart language version (e.g., "3.0", "2.17")'
    }
};

// Plugin object
const dartPlugin: Plugin = {
    languages,
    parsers: {
        [parserName]: dartParser,
    },
    printers: {
        [parserName]: dartPrinter,
    },
    options,
};

// Initialize WASM module when plugin loads
initDart().catch(error => {
    console.warn('Failed to initialize Dart WASM module:', error);
});

export default dartPlugin;
export { languages };
export const parsers = dartPlugin.parsers;
export const printers = dartPlugin.printers;
