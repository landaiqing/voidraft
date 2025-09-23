import './wasm_exec.js'
// Format options for Dockerfile
export const FormatOptions = {
    indentSize: 4,
    trailingNewline: true,
    spaceRedirects: false,
}

let wasmInstance = null;
let isInitialized = false;

// Initialize the WASM module
export default async function init(wasmUrl) {
    if (isInitialized) {
        return;
    }

    try {
        // Load WASM file
        const wasmPath = wasmUrl || new URL('./docker_fmt.wasm', import.meta.url).href;
        const wasmResponse = await fetch(wasmPath);
        const wasmBytes = await wasmResponse.arrayBuffer();

        // Initialize Go runtime
        const go = new Go();
        const result = await WebAssembly.instantiate(wasmBytes, go.importObject);
        
        wasmInstance = result.instance;
        
        // Run the Go program (don't await, as it needs to stay alive)
        go.run(wasmInstance);
        
        // Wait a bit for the Go program to initialize and register the function
        await new Promise(resolve => setTimeout(resolve, 100));
        
        isInitialized = true;
    } catch (error) {
        console.error('Failed to initialize Dockerfile WASM module:', error);
        throw error;
    }
}

// Format Dockerfile content
export function format(text, options = {}) {
    if (!isInitialized) {
        throw new Error('WASM module not initialized. Call init() first.');
    }

    if (typeof globalThis.dockerFormat !== 'function') {
        throw new Error('dockerFormat function not available. WASM module may not be properly initialized.');
    }

    const config = {
        indentSize: options.indentSize || options.indent || 4,
        trailingNewline: options.trailingNewline !== undefined ? options.trailingNewline : true,
        spaceRedirects: options.spaceRedirects !== undefined ? options.spaceRedirects : false
    };

    try {
        // Call the dockerFormat function registered by Go
        const result = globalThis.dockerFormat(text, config);
        
        // Check if there was an error
        if (result && Array.isArray(result) && result[0] === true) {
            throw new Error(result[1] || 'Unknown formatting error');
        }
        
        // Return the formatted result
        return result && Array.isArray(result) ? result[1] : result;
    } catch (error) {
        console.warn('Dockerfile formatting error:', error);
        throw error;
    }
}

// Format Dockerfile contents (alias for compatibility)
export function formatDockerfileContents(fileContents, options) {
    return format(fileContents, options);
}

// Placeholder for Node.js compatibility (not implemented in browser)
export function formatDockerfile() {
    throw new Error(
        '`formatDockerfile` is not implemented in the browser. Use `format` or `formatDockerfileContents` instead.',
    );
}