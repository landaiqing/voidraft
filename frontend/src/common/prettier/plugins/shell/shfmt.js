/**
 * Shell formatter WASM module wrapper
 * Based on the existing src implementation but adapted for browser use
 */

// Import WASM execution environment
import './wasm_exec.cjs';

// Language variants enum
export const LangVariant = {
    LangBash: 0,
    LangPOSIX: 1,
    LangMirBSDKorn: 2,
    LangBats: 3,
    LangAuto: 4,
};

// Parse error class
export class ParseError extends Error {
    constructor({ Filename, Incomplete, Text, Pos }) {
        super(Text);
        this.Filename = Filename;
        this.Incomplete = Incomplete;
        this.Text = Text;
        this.Pos = Pos;
    }
}

let encoder;
let decoder;
let wasmInstance = null;
let isInitialized = false;

// Initialize the WASM module
export default async function init(wasmUrl) {
    if (isInitialized) {
        return;
    }

    encoder = new TextEncoder();
    decoder = new TextDecoder();

    try {
        // Load WASM file
        const wasmPath = wasmUrl || new URL('./shfmt.wasm', import.meta.url).href;
        const wasmResponse = await fetch(wasmPath);
        const wasmBytes = await wasmResponse.arrayBuffer();

        // Initialize Go runtime
        const go = new ShellGo();
        const result = await WebAssembly.instantiate(wasmBytes, go.importObject);
        
        wasmInstance = result.instance;
        
        // Run the Go program
        go.run(wasmInstance);
        
        isInitialized = true;
    } catch (error) {
        console.error('Failed to initialize shfmt WASM module:', error);
        throw error;
    }
}

// Format shell code
export function format(text, config = {}) {
    if (!isInitialized || !wasmInstance) {
        throw new Error('WASM module not initialized. Call init() first.');
    }

    const {
        variant = LangVariant.LangBash,
        keepComments = true,
        useTabs = false,
        tabWidth = 2,
        binaryNextLine = true,
        switchCaseIndent = true,
        spaceRedirects = true,
        keepPadding = false,
        functionNextLine = false
    } = config;

    const indent = useTabs ? 0 : tabWidth;

    try {
        const { memory, wasmAlloc, wasmFree, process } = wasmInstance.exports;

        // Encode input text
        const encodedText = encoder.encode(text);
        const encodedFilePath = encoder.encode('input.sh');
        const encodedStopAt = encoder.encode('');

        // Allocate memory for inputs
        const filePathPointer = wasmAlloc(encodedFilePath.byteLength);
        new Uint8Array(memory.buffer).set(encodedFilePath, filePathPointer);

        const textPointer = wasmAlloc(encodedText.byteLength);
        new Uint8Array(memory.buffer).set(encodedText, textPointer);

        const stopAtPointer = wasmAlloc(encodedStopAt.byteLength);
        new Uint8Array(memory.buffer).set(encodedStopAt, stopAtPointer);

        // Call the process function
        const resultPointer = process(
            filePathPointer, encodedFilePath.byteLength, encodedFilePath.byteLength,
            textPointer, encodedText.byteLength, encodedText.byteLength,
            true, // print mode
            keepComments,
            variant,
            stopAtPointer, encodedStopAt.byteLength, encodedStopAt.byteLength,
            0, // recoverErrors
            indent,
            binaryNextLine,
            switchCaseIndent,
            spaceRedirects,
            keepPadding,
            false, // minify
            false, // singleLine
            functionNextLine
        );

        // Free allocated memory
        wasmFree(filePathPointer);
        wasmFree(textPointer);
        wasmFree(stopAtPointer);

        // Read result
        const result = new Uint8Array(memory.buffer).subarray(resultPointer);
        const end = result.indexOf(0);
        const resultString = decoder.decode(result.subarray(0, end));

        // Parse result
        if (!resultString.startsWith('{"') || !resultString.endsWith('}')) {
            throw new ParseError({
                Filename: 'input.sh',
                Incomplete: true,
                Text: resultString,
            });
        }

        const { file, text: processedText, parseError, message } = JSON.parse(resultString);

        if (parseError || message) {
            throw parseError == null
                ? new SyntaxError(message)
                : new ParseError(parseError);
        }

        return processedText || text;
    } catch (error) {
        console.warn('Shell formatting error:', error);
        throw error;
    }
}

// Parse shell code (returns AST)
export function parse(text, config = {}) {
    if (!isInitialized || !wasmInstance) {
        throw new Error('WASM module not initialized. Call init() first.');
    }

    const {
        variant = LangVariant.LangBash,
        keepComments = true,
        useTabs = false,
        tabWidth = 2,
        binaryNextLine = true,
        switchCaseIndent = true,
        spaceRedirects = true,
        keepPadding = false,
        functionNextLine = false
    } = config;

    const indent = useTabs ? 0 : tabWidth;

    try {
        const { memory, wasmAlloc, wasmFree, process } = wasmInstance.exports;

        // Encode input text
        const encodedText = encoder.encode(text);
        const encodedFilePath = encoder.encode('input.sh');
        const encodedStopAt = encoder.encode('');

        // Allocate memory for inputs
        const filePathPointer = wasmAlloc(encodedFilePath.byteLength);
        new Uint8Array(memory.buffer).set(encodedFilePath, filePathPointer);

        const textPointer = wasmAlloc(encodedText.byteLength);
        new Uint8Array(memory.buffer).set(encodedText, textPointer);

        const stopAtPointer = wasmAlloc(encodedStopAt.byteLength);
        new Uint8Array(memory.buffer).set(encodedStopAt, stopAtPointer);

        // Call the process function
        const resultPointer = process(
            filePathPointer, encodedFilePath.byteLength, encodedFilePath.byteLength,
            textPointer, encodedText.byteLength, encodedText.byteLength,
            false, // parse mode
            keepComments,
            variant,
            stopAtPointer, encodedStopAt.byteLength, encodedStopAt.byteLength,
            0, // recoverErrors
            indent,
            binaryNextLine,
            switchCaseIndent,
            spaceRedirects,
            keepPadding,
            false, // minify
            false, // singleLine
            functionNextLine
        );

        // Free allocated memory
        wasmFree(filePathPointer);
        wasmFree(textPointer);
        wasmFree(stopAtPointer);

        // Read result
        const result = new Uint8Array(memory.buffer).subarray(resultPointer);
        const end = result.indexOf(0);
        const resultString = decoder.decode(result.subarray(0, end));

        // Parse result
        if (!resultString.startsWith('{"') || !resultString.endsWith('}')) {
            throw new ParseError({
                Filename: 'input.sh',
                Incomplete: true,
                Text: resultString,
            });
        }

        const { file, text: processedText, parseError, message } = JSON.parse(resultString);

        if (parseError || message) {
            throw parseError == null
                ? new SyntaxError(message)
                : new ParseError(parseError);
        }

        return file;
    } catch (error) {
        console.warn('Shell parsing error:', error);
        throw error;
    }
}