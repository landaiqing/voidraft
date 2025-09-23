/**
 * Prettier Plugin for SQL formatting using SQL Format WebAssembly
 * 
 * This plugin provides support for formatting SQL files using the SQL Format WASM implementation.
 */
import type { Plugin, Parser, Printer } from 'prettier';

// Import the SQL Format WASM module
import sqlFmtInit, { format, type Config } from './sql_fmt_vite.js';

const parserName = 'sql';

// Language configuration
const languages = [
    {
        name: 'SQL',
        aliases: ['sql'],
        parsers: [parserName],
        extensions: ['.sql'],
        aceMode: 'sql',
        tmScope: 'source.sql',
        linguistLanguageId: 316,
        vscodeLanguageIds: ['sql']
    }
];

// Parser configuration
const sqlParser: Parser<string> = {
    astFormat: parserName,
    parse: (text: string) => text,
    locStart: () => 0,
    locEnd: (node: string) => node.length,
};

// Lazy initialize SQL Format WASM module
let initPromise: Promise<void> | null = null;
let isInitialized = false;

function initSqlFmt(): Promise<void> {
    if (isInitialized) {
        return Promise.resolve();
    }
    
    if (!initPromise) {
        initPromise = (async () => {
            try {
                await sqlFmtInit();
                isInitialized = true;
            } catch (error) {
                console.warn('Failed to initialize SQL Format WASM module:', error);
                initPromise = null;
                throw error;
            }
        })();
    }
    
    return initPromise;
}

// Printer configuration
const sqlPrinter: Printer<string> = {
    // @ts-expect-error -- Support async printer like shell plugin
    async print(path, options) {
        try {
            // Wait for initialization to complete
            await initSqlFmt();
            
            const text = (path as any).getValue ? (path as any).getValue() : path.node;
            const config = getSqlFmtConfig(options);
            
            // Format using SQL Format (synchronous call)
            const formatted = format(text, 'index.sql', config);
            
            return formatted.trim();
        } catch (error) {
            console.warn('SQL formatting failed:', error);
            // Return original text if formatting fails
            return (path as any).getValue ? (path as any).getValue() : path.node;
        }
    },
};

// Helper function to create SQL Format config from Prettier options
function getSqlFmtConfig(options: any): Config {
    const config: Config = {};
    
    // Map Prettier options to SQL Format config
    if (options.useTabs !== undefined) {
        config.indent_style = options.useTabs ? 'tab' : 'space';
    }
    
    if (options.tabWidth !== undefined) {
        config.indent_width = options.tabWidth;
    }
    
    if (options.sqlUppercase !== undefined) {
        config.uppercase = options.sqlUppercase;
    }
    
    if (options.sqlLinesBetweenQueries !== undefined) {
        config.lines_between_queries = options.sqlLinesBetweenQueries;
    }
    
    return config;
}

// Plugin options
const options = {
    sqlUppercase: {
        since: '0.0.1',
        category: 'Format' as const,
        type: 'boolean' as const,
        default: true,
        description: 'When set, changes reserved keywords to ALL CAPS'
    },
    sqlLinesBetweenQueries: {
        since: '0.0.1',
        category: 'Format' as const,
        type: 'int' as const,
        default: 1,
        description: 'Controls the number of line breaks after a query'
    }
};

// Plugin definition
const sqlPlugin: Plugin = {
    languages,
    parsers: {
        [parserName]: sqlParser,
    },
    printers: {
        [parserName]: sqlPrinter,
    },
    options,
};

export default sqlPlugin;
export { languages };
export const parsers = sqlPlugin.parsers;
export const printers = sqlPlugin.printers;