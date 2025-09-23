/**
 * TypeScript definitions for Shell formatter WASM module
 */

// Language variants enum
export declare const LangVariant: {
    readonly LangBash: 0;
    readonly LangPOSIX: 1;
    readonly LangMirBSDKorn: 2;
    readonly LangBats: 3;
    readonly LangAuto: 4;
};

// Configuration interface
export interface Config {
    useTabs?: boolean;
    tabWidth?: number;
    printWidth?: number;
    variant?: number;
    keepComments?: boolean;
    binaryNextLine?: boolean;
    switchCaseIndent?: boolean;
    spaceRedirects?: boolean;
    keepPadding?: boolean;
    functionNextLine?: boolean;
}

// Parse error class
export declare class ParseError extends Error {
    Filename?: string;
    Incomplete?: boolean;
    Text: string;
    Pos?: any;

    constructor(params: {
        Filename?: string;
        Incomplete?: boolean;
        Text: string;
        Pos?: any;
    });
}

// Initialize the WASM module
declare function init(wasmUrl?: string): Promise<void>;
export default init;

// Format shell code
export declare function format(text: string, config?: Config): string;

// Parse shell code (returns AST)
export declare function parse(text: string, config?: Config): any;