/**
 * Prettier Plugin for C/C++ formatting using clang-format WebAssembly
 * 
 * This plugin provides support for formatting C/C++ files using the clang-format WASM implementation.
 * It supports various C/C++ file extensions and common clang-format styles.
 */
import type { Plugin, Parser, Printer } from 'prettier';

// Import the clang-format WASM module
import clangFormatInit, { format } from './clang-format-vite.js';

const parserName = 'clang';

// Language configuration
const languages = [
    {
        name: 'C',
        aliases: ['c'],
        parsers: [parserName],
        extensions: ['.c', '.h'],
        aceMode: 'c_cpp',
        tmScope: 'source.c',
        linguistLanguageId: 50,
        vscodeLanguageIds: ['c']
    },
    {
        name: 'C++',
        aliases: ['cpp', 'cxx', 'cc'],
        parsers: [parserName],
        extensions: ['.cpp', '.cxx', '.cc', '.hpp', '.hxx', '.hh', '.C', '.H'],
        aceMode: 'c_cpp',
        tmScope: 'source.cpp',
        linguistLanguageId: 43,
        vscodeLanguageIds: ['cpp']
    },
    {
        name: 'Objective-C',
        aliases: ['objc', 'objectivec'],
        parsers: [parserName],
        extensions: ['.m', '.mm'],
        aceMode: 'objectivec',
        tmScope: 'source.objc',
        linguistLanguageId: 259,
        vscodeLanguageIds: ['objective-c']
    }
];

// Parser configuration
const clangParser: Parser<string> = {
    astFormat: parserName,
    parse: (text: string) => text,
    locStart: () => 0,
    locEnd: (node: string) => node.length,
};

// Initialize clang-format WASM module
let initPromise: Promise<void> | null = null;
let isInitialized = false;

function initClangFormat(): Promise<void> {
    if (initPromise) {
        return initPromise;
    }
    
    initPromise = (async () => {
        if (!isInitialized) {
            await clangFormatInit();
            isInitialized = true;
        }
    })();
    
    return initPromise;
}

// Printer configuration
const clangPrinter: Printer<string> = {
    print: (path, options) => {
        try {
            if (!isInitialized) {
                console.warn('clang-format WASM module not initialized, returning original text');
                return (path as any).getValue ? (path as any).getValue() : path.node;
            }
            
            const text = (path as any).getValue ? (path as any).getValue() : path.node;
            const style = getClangStyle(options);
            
            // Format using clang-format (synchronous call)
            const formatted = format(text, undefined, style);
            
            return formatted.trim();
        } catch (error) {
            console.warn('clang-format failed:', error);
            // Return original text if formatting fails
            return (path as any).getValue ? (path as any).getValue() : path.node;
        }
    },
};


// Helper function to determine clang-format style
function getClangStyle(options: any): string {
    // You can extend this to support more options
    const style = options.clangStyle || 'LLVM';
    
    // Support common styles
    const validStyles = ['LLVM', 'Google', 'Chromium', 'Mozilla', 'WebKit', 'Microsoft', 'GNU'];
    if (validStyles.includes(style)) {
        return style;
    }
    
    // Default to LLVM style
    return 'LLVM';
}

// Plugin options
const options = {
    clangStyle: {
        since: '0.0.1',
        category: 'Format' as const,
        type: 'choice' as const,
        default: 'LLVM',
        description: 'The clang-format style to use',
        choices: [
            { value: 'LLVM', description: 'LLVM coding standards' },
            { value: 'Google', description: "Google's C++ style guide" },
            { value: 'Chromium', description: "Chromium's style guide" },
            { value: 'Mozilla', description: "Mozilla's style guide" },
            { value: 'WebKit', description: "WebKit's style guide" },
            { value: 'Microsoft', description: "Microsoft's style guide" },
            { value: 'GNU', description: 'GNU coding standards' }
        ]
    }
};

// Plugin object
const clangPlugin: Plugin = {
    languages,
    parsers: {
        [parserName]: clangParser,
    },
    printers: {
        [parserName]: clangPrinter,
    },
    options,
};

// Initialize WASM module when plugin loads
initClangFormat().catch(error => {
    console.warn('Failed to initialize clang-format WASM module:', error);
});

export default clangPlugin;
export { languages };
export const parsers = clangPlugin.parsers;
export const printers = clangPlugin.printers;
