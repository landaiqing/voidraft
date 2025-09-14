/**
 * Go Prettier Plugin - Universal Implementation
 * WebAssembly-based Go code formatter for Prettier
 * Supports both Node.js and Browser environments
 */

let initializePromise = null;

// Environment detection
const isNode = () => {
    return typeof process !== 'undefined' && 
           process.versions != null && 
           process.versions.node != null;
};

const isBrowser = () => {
    return typeof window !== 'undefined' && 
           typeof document !== 'undefined';
};

// Node.js WASM loading
const loadWasmNode = async () => {
    try {
        const fs = await import('fs');
        const path = await import('path');
        const { fileURLToPath } = await import('url');
        
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const wasmPath = path.join(__dirname, 'go.wasm');
        
        return fs.readFileSync(wasmPath);
    } catch (error) {
        console.error('Node.js WASM loading failed:', error);
        throw error;
    }
};

// Browser WASM loading
const loadWasmBrowser = async () => {
    try {
        const response = await fetch('/go.wasm');
        if (!response.ok) {
            throw new Error(`Failed to load WASM file: ${response.status} ${response.statusText}`);
        }
        return await response.arrayBuffer();
    } catch (error) {
        console.error('Browser WASM loading failed:', error);
        throw error;
    }
};

// Node.js Go runtime initialization
const initGoRuntimeNode = async () => {
    if (globalThis.Go) return;
    
    try {
        // Dynamic import of wasm_exec.js for Node.js
        const { createRequire } = await import('module');
        const require = createRequire(import.meta.url);
        const path = await import('path');
        const { fileURLToPath } = await import('url');
        
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        
        // Load wasm_exec.js
        const wasmExecPath = path.join(__dirname, 'wasm_exec.js');
        require(wasmExecPath);
        
        if (!globalThis.Go) {
            throw new Error('Go WASM runtime not available after loading wasm_exec.js');
        }
    } catch (error) {
        console.error('Node.js Go runtime initialization failed:', error);
        throw error;
    }
};

// Browser Go runtime initialization
const initGoRuntimeBrowser = async () => {
    if (globalThis.Go) return;
    
    try {
        // Load wasm_exec.js dynamically in browser
        const script = document.createElement('script');
        script.src = '/wasm_exec.js';
        document.head.appendChild(script);

        await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load wasm_exec.js'));
        });
        
        if (!globalThis.Go) {
            throw new Error('Go WASM runtime not available after loading wasm_exec.js');
        }
    } catch (error) {
        console.error('Browser Go runtime initialization failed:', error);
        throw error;
    }
};

// Universal initialization
const initialize = async () => {
    if (initializePromise) return initializePromise;

    initializePromise = (async () => {
        let wasmBuffer;
        
        // Environment-specific initialization
        if (isNode()) {
            await initGoRuntimeNode();
            wasmBuffer = await loadWasmNode();
        } else if (isBrowser()) {
            await initGoRuntimeBrowser();
            wasmBuffer = await loadWasmBrowser();
        } else {
            throw new Error('Unsupported environment: neither Node.js nor Browser detected');
        }

        const go = new globalThis.Go();
        const { instance } = await WebAssembly.instantiate(wasmBuffer, go.importObject);

        // Run Go program (don't await as it's a long-running service)
        go.run(instance).catch(err => {
            console.error('Go WASM program exit error:', err);
        });

        // Wait for Go program to initialize and expose formatGo function
        let retries = 0;
        const maxRetries = 10;

        while (typeof globalThis.formatGo !== 'function' && retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
        }

        if (typeof globalThis.formatGo !== 'function') {
            throw new Error('Go WASM module not properly initialized - formatGo function not available');
        }
    })();

    return initializePromise;
};

export const languages = [
    {
        name: "Go",
        parsers: ["go"],
        extensions: [".go"],
        vscodeLanguageIds: ["go"],
    },
];

export const parsers = {
    go: {
        parse: (text) => text,
        astFormat: "go-format",
        locStart: (node) => 0,
        locEnd: (node) => node.length,
    },
};

export const printers = {
    "go-format": {
        print: async (path) => {
            await initialize();
            const text = path.getValue();

            if (typeof globalThis.formatGo !== 'function') {
                throw new Error('Go WASM module not properly initialized - formatGo function missing');
            }

            try {
                return globalThis.formatGo(text);
            } catch (error) {
                throw new Error(`Go formatting failed: ${error.message}`);
            }
        },
    },
};

// Default export for Prettier plugin compatibility
export default {
    languages,
    parsers,
    printers
};
