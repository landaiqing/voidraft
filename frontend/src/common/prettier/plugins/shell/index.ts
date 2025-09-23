/**
 * Prettier Plugin for Shell formatting using shfmt WebAssembly
 * 
 * This plugin provides support for formatting Shell files using the shfmt WASM implementation.
 */
import type { Plugin, Parser, Printer } from 'prettier';

// Import the shell WASM module
import shfmtInit, { format, type Config } from './shfmt_vite.js';

const parserName = 'sh';

// Language configuration
const languages = [
    {
        name: 'Shell',
        aliases: ['sh', 'bash', 'shell'],
        parsers: [parserName],
        extensions: ['.sh', '.bash', '.zsh', '.fish', '.ksh'],
        aceMode: 'sh',
        tmScope: 'source.shell',
        linguistLanguageId: 302,
        vscodeLanguageIds: ['shellscript']
    }
];

// Parser configuration
const shParser: Parser<string> = {
    astFormat: parserName,
    parse: (text: string) => text,
    locStart: () => 0,
    locEnd: (node: string) => node.length,
};

// Lazy initialize shfmt WASM module
let initPromise: Promise<void> | null = null;
let isInitialized = false;

function initShfmt(): Promise<void> {
    if (isInitialized) {
        return Promise.resolve();
    }
    
    if (!initPromise) {
        initPromise = (async () => {
            try {
                await shfmtInit();
                isInitialized = true;
            } catch (error) {
                console.warn('Failed to initialize shfmt WASM module:', error);
                initPromise = null;
                throw error;
            }
        })();
    }
    
    return initPromise;
}

// Printer configuration
const shPrinter: Printer<string> = {
    // @ts-expect-error -- Support async printer like shell plugin
    async print(path, options) {
        try {
            // Wait for initialization to complete
            await initShfmt();
            
            const text = (path as any).getValue ? (path as any).getValue() : path.node;
            const config = getShfmtConfig(options);
            
            // Format using shfmt (synchronous call)
            const formatted = format(text, config);
            
            return formatted.trim();
        } catch (error) {
            console.warn('Shell formatting failed:', error);
            // Return original text if formatting fails
            return (path as any).getValue ? (path as any).getValue() : path.node;
        }
    },
};

// Helper function to create shfmt config from Prettier options
function getShfmtConfig(options: any): Config {
    const config: Config = {};
    
    // Map Prettier options to shfmt config
    if (options.useTabs !== undefined) {
        config.useTabs = options.useTabs;
    }
    
    if (options.tabWidth !== undefined) {
        config.tabWidth = options.tabWidth;
    }
    
    if (options.printWidth !== undefined) {
        config.printWidth = options.printWidth;
    }
    
    // Shell-specific options
    if (options.shVariant !== undefined) {
        config.variant = options.shVariant;
    }
    
    if (options.shKeepComments !== undefined) {
        config.keepComments = options.shKeepComments;
    }
    
    if (options.shBinaryNextLine !== undefined) {
        config.binaryNextLine = options.shBinaryNextLine;
    }
    
    if (options.shSwitchCaseIndent !== undefined) {
        config.switchCaseIndent = options.shSwitchCaseIndent;
    }
    
    if (options.shSpaceRedirects !== undefined) {
        config.spaceRedirects = options.shSpaceRedirects;
    }
    
    if (options.shKeepPadding !== undefined) {
        config.keepPadding = options.shKeepPadding;
    }
    
    if (options.shFunctionNextLine !== undefined) {
        config.functionNextLine = options.shFunctionNextLine;
    }
    
    return config;
}

// Plugin options
const options = {
    shVariant: {
        since: '0.0.1',
        category: 'Format' as const,
        type: 'choice' as const,
        default: 'bash',
        description: 'Shell variant to use for formatting',
        choices: [
            { value: 'bash', description: 'Bash shell' },
            { value: 'posix', description: 'POSIX shell' },
            { value: 'mksh', description: 'MirBSD Korn shell' },
            { value: 'bats', description: 'Bats testing framework' }
        ]
    },
    shKeepComments: {
        since: '0.0.1',
        category: 'Format' as const,
        type: 'boolean' as const,
        default: true,
        description: 'Keep comments in formatted output'
    },
    shBinaryNextLine: {
        since: '0.0.1',
        category: 'Format' as const,
        type: 'boolean' as const,
        default: true,
        description: 'Place binary operators on next line'
    },
    shSwitchCaseIndent: {
        since: '0.0.1',
        category: 'Format' as const,
        type: 'boolean' as const,
        default: true,
        description: 'Indent switch case statements'
    },
    shSpaceRedirects: {
        since: '0.0.1',
        category: 'Format' as const,
        type: 'boolean' as const,
        default: true,
        description: 'Add spaces around redirects'
    },
    shKeepPadding: {
        since: '0.0.1',
        category: 'Format' as const,
        type: 'boolean' as const,
        default: false,
        description: 'Keep padding in column alignment'
    },
    shFunctionNextLine: {
        since: '0.0.1',
        category: 'Format' as const,
        type: 'boolean' as const,
        default: false,
        description: 'Place function opening brace on next line'
    }
};

// Plugin definition
const shPlugin: Plugin = {
    languages,
    parsers: {
        [parserName]: shParser,
    },
    printers: {
        [parserName]: shPrinter,
    },
    options,
};

// Export plugin without auto-initialization
export default shPlugin;
export { languages, initShfmt as initialize };
export const parsers = shPlugin.parsers;
export const printers = shPlugin.printers;