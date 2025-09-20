/**
 * Prettier Plugin for C/C++/C#/Java/Protobuf formatting using clang-format WebAssembly
 * 
 * This plugin provides support for formatting multiple languages using the clang-format WASM implementation.
 * Supported languages:
 * - C / C++
 * - Objective-C / Objective-C++
 * - C#
 * - Java
 * - Protocol Buffer (Protobuf)
 * 
 * It supports various file extensions and common clang-format styles.
 */
import type { Plugin, Parser, Printer } from 'prettier';

// Import the clang-format WASM module
import clangFormatInit, { format } from './clang-format-vite.js';

const parserName = 'clang-format';

// Language configuration
const languages = [
    {
        name: 'C',
        aliases: ['c'],
        parsers: ['c'],
        extensions: ['.c', '.h'],
        filenames: ['*.c', '*.h'],
        aceMode: 'c_cpp',
        tmScope: 'source.c',
        linguistLanguageId: 50,
        vscodeLanguageIds: ['c']
    },
    {
        name: 'C++',
        aliases: ['cpp', 'cxx', 'cc'],
        parsers: ['cpp'],
        extensions: ['.cpp', '.cxx', '.cc', '.hpp', '.hxx', '.hh', '.C', '.H'],
        filenames: ['*.cpp', '*.cxx', '*.cc', '*.hpp', '*.hxx', '*.hh', '*.C', '*.H'],
        aceMode: 'c_cpp',
        tmScope: 'source.cpp',
        linguistLanguageId: 43,
        vscodeLanguageIds: ['cpp']
    },
    {
        name: 'Objective-C',
        aliases: ['objc', 'objectivec'],
        parsers: ['objective-c'],
        extensions: ['.m'],
        filenames: ['*.m'],
        aceMode: 'objectivec',
        tmScope: 'source.objc',
        linguistLanguageId: 259,
        vscodeLanguageIds: ['objective-c']
    },
    {
        name: 'Objective-C++',
        aliases: ['objcpp', 'objectivecpp'],
        parsers: ['objective-cpp'],
        extensions: ['.mm'],
        filenames: ['*.mm'],
        aceMode: 'objectivec',
        tmScope: 'source.objcpp',
        linguistLanguageId: 260,
        vscodeLanguageIds: ['objective-cpp']
    },
    {
        name: 'C#',
        aliases: ['csharp', 'cs'],
        parsers: ['cs'],
        extensions: ['.cs'],
        filenames: ['*.cs'],
        aceMode: 'csharp',
        tmScope: 'source.cs',
        linguistLanguageId: 42,
        vscodeLanguageIds: ['csharp']
    },
    {
        name: 'Java',
        aliases: ['java'],
        parsers: ['java'],
        extensions: ['.java'],
        filenames: ['*.java'],
        aceMode: 'java',
        tmScope: 'source.java',
        linguistLanguageId: 181,
        vscodeLanguageIds: ['java']
    },
    {
        name: 'Protocol Buffer',
        aliases: ['protobuf', 'proto'],
        parsers: ['proto'],
        extensions: ['.proto'],
        filenames: ['*.proto'],
        aceMode: 'protobuf',
        tmScope: 'source.proto',
        linguistLanguageId: 297,
        vscodeLanguageIds: ['proto']
    }
];

// Parser configuration
const clangParser: Parser<string> = {
    astFormat: parserName,
    parse: (text: string) => text,
    locStart: () => 0,
    locEnd: (node: string) => node.length,
};

// Lazy initialize clang-format WASM module
let initPromise: Promise<void> | null = null;
let isInitialized = false;

function initClangFormat(): Promise<void> {
    if (isInitialized) {
        return Promise.resolve();
    }
    
    if (!initPromise) {
        initPromise = (async () => {
            try {
                await clangFormatInit();
                isInitialized = true;
            } catch (error) {
                console.warn('Failed to initialize clang-format WASM module:', error);
                initPromise = null;
                throw error;
            }
        })();
    }
    
    return initPromise;
}

// Printer configuration
const clangPrinter: Printer<string> = {
    // @ts-expect-error -- Support async printer like shell plugin
    async print(path, options) {
        try {
            // Wait for initialization to complete
            await initClangFormat();
            
            const text = (path as any).getValue ? (path as any).getValue() : path.node;
            const style = getClangStyle(options);
            
            // Format using clang-format (synchronous call)
            const formatted = format(text, options.filename, style);
            
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
    },
    filename: {
        // since: '0.1.0',
        category: 'Config',
        type: 'string',
        default: undefined,
        description: 'Custom filename to use for web_fmt processing (affects language detection)',
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
    ...options,
};

export default clangPlugin;
export { languages };
export const parsers = clangPlugin.parsers;
export const printers = clangPlugin.printers;
