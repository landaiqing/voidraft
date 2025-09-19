/**
 * Prettier Plugin for Web Languages formatting using web_fmt WebAssembly
 * 
 * This plugin provides support for formatting multiple web languages using the web_fmt WASM implementation.
 * web_fmt is a comprehensive formatter for web development supporting HTML, CSS, JavaScript, and JSON.
 */
import type { Plugin, Parser, Printer, ParserOptions } from 'prettier';

// Import the web_fmt WASM module
import webInit, { format } from './web_fmt_vite.js';
import { languages } from './languages';

const parserName = 'web-fmt';

// Parser configuration  
const webParser: Parser<string> = {
    astFormat: parserName,
    parse: (text: string) => text,
    locStart: () => 0,
    locEnd: (text: string) => text.length,
};

// Initialize web_fmt WASM module
let processorInstance: any = null;

const getProcessorInstance = async () => {
    if (!processorInstance) {
        try {
            await webInit();
            processorInstance = { initialized: true };
        } catch (error) {
            console.warn('Failed to initialize web_fmt WASM module:', error);
            processorInstance = null;
        }
    }
    return processorInstance;
};

// Helper function to convert Prettier options to web_fmt config
function buildWebConfig(options: any): any {
    const config: any = {};
    
    // Basic layout options
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
    
    // Script-specific options (for JS/TS)
    if (options.singleQuote !== undefined) {
        config.script = config.script || {};
        config.script.quote_style = options.singleQuote ? 'single' : 'double';
    }
    
    if (options.jsxSingleQuote !== undefined) {
        config.script = config.script || {};
        config.script.jsx_quote_style = options.jsxSingleQuote ? 'single' : 'double';
    }
    
    if (options.trailingComma !== undefined) {
        config.script = config.script || {};
        config.script.trailing_comma = options.trailingComma;
    }
    
    if (options.semi !== undefined) {
        config.script = config.script || {};
        config.script.semicolons = options.semi ? 'always' : 'as-needed';
    }
    
    if (options.arrowParens !== undefined) {
        config.script = config.script || {};
        config.script.arrow_parentheses = options.arrowParens === 'always' ? 'always' : 'as-needed';
    }
    
    if (options.bracketSpacing !== undefined) {
        config.script = config.script || {};
        config.script.bracket_spacing = options.bracketSpacing;
    }
    
    if (options.bracketSameLine !== undefined) {
        config.script = config.script || {};
        config.script.bracket_same_line = options.bracketSameLine;
    }
    
    return config;
}


// Printer configuration
const webPrinter: Printer<string> = {
    // @ts-expect-error -- Support async printer like shell plugin
    async print(path, options) {
        const processor = await getProcessorInstance();
        const text = (path as any).getValue ? (path as any).getValue() : path.node;
        
        if (!processor) {
            console.warn('web_fmt WASM not initialized, returning original text');
            return text;
        }

        try {
            const config = buildWebConfig(options);
            
            // Format using web_fmt
            const formatted = format(text, options.filename, config);
            return formatted.trim();
        } catch (error) {
            console.warn('web_fmt formatting failed:', error);
            // Return original text if formatting fails
            return text;
        }
    },
};

// Parser and printer exports
export const parsers = {
    [parserName]: webParser,
};

export const printers = {
    [parserName]: webPrinter,
};

// Configuration options - use standard Prettier options  
const options: Plugin['options'] = {
    filename: {
        // since: '0.1.0',
        category: 'Config',
        type: 'string',
        default: undefined,
        description: 'Custom filename to use for web_fmt processing (affects language detection)',
    }
};

// Plugin object
const webPlugin: Plugin = {
    languages,
    parsers,
    printers,
    options,
};

export default webPlugin;
export { languages };
