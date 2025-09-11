/**
 * Go Prettier Plugin for Vite + Vue3 Environment
 * WebAssembly-based Go code formatter for Prettier
 */

let initializePromise = null;

// Load WASM file from public directory
const loadWasm = async () => {
    try {
        const response = await fetch('/go.wasm');
        if (!response.ok) {
            throw new Error(`Failed to load WASM file: ${response.status} ${response.statusText}`);
        }
        return await response.arrayBuffer();
    } catch (error) {
        console.error('WASM loading failed:', error);
        throw error;
    }
};

// Initialize Go runtime
const initGoRuntime = async () => {
    if (globalThis.Go) return;

    // Auto-load wasm_exec.js if not available
    try {

        const script = document.createElement('script');
        script.src = '/wasm_exec.js';
        document.head.appendChild(script);

        await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load wasm_exec.js'));
            setTimeout(() => reject(new Error('wasm_exec.js loading timeout')), 5000);
        });
        if (!globalThis.Go) {
            throw new Error('Go WASM runtime is not available after loading wasm_exec.js');
        }
    } catch (error) {
        console.error('Failed to load wasm_exec.js:', error);
        throw error;
    }
};

const initialize = async () => {
    if (initializePromise) return initializePromise;

    initializePromise = (async () => {
        await initGoRuntime();

        const go = new globalThis.Go();
        const wasmBuffer = await loadWasm();
        const {instance} = await WebAssembly.instantiate(wasmBuffer, go.importObject);

        // Run Go program
        go.run(instance).catch(err => {
            console.error('Go WASM program exit error:', err);
        });

        // Wait for initialization to complete
        await new Promise(resolve => setTimeout(resolve, 200));

        // Check if formatGo function is available
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
