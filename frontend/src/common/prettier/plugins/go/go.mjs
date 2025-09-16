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
    // 总是重新初始化，因为可能存在版本不兼容问题
    try {
        // 移除旧的 Go 运行时
        delete globalThis.Go;
        
        // 动态导入本地的 wasm_exec.js 内容
        const wasmExecResponse = await fetch('/wasm_exec.js');
        if (!wasmExecResponse.ok) {
            throw new Error(`Failed to fetch wasm_exec.js: ${wasmExecResponse.status}`);
        }
        
        const wasmExecCode = await wasmExecResponse.text();
        
        // 在全局作用域中执行 wasm_exec.js 代码
        const script = document.createElement('script');
        script.textContent = wasmExecCode;
        document.head.appendChild(script);
        
        // 等待一小段时间确保脚本执行完成
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!globalThis.Go) {
            throw new Error('Go WASM runtime not available after executing wasm_exec.js');
        }
        
        console.log('Go runtime initialized successfully');
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
        
        console.log('Starting Go WASM initialization...');
        
        // Environment-specific initialization
        if (isNode()) {
            console.log('Initializing for Node.js environment');
            await initGoRuntimeNode();
            wasmBuffer = await loadWasmNode();
        } else if (isBrowser()) {
            console.log('Initializing for Browser environment');
            await initGoRuntimeBrowser();
            wasmBuffer = await loadWasmBrowser();
        } else {
            throw new Error('Unsupported environment: neither Node.js nor Browser detected');
        }

        console.log('Creating Go instance...');
        const go = new globalThis.Go();
        
        // 详细检查 importObject
        console.log('Go import object keys:', Object.keys(go.importObject));
        if (go.importObject.gojs) {
            console.log('gojs import keys:', Object.keys(go.importObject.gojs));
            console.log('scheduleTimeoutEvent type:', typeof go.importObject.gojs['runtime.scheduleTimeoutEvent']);
        }
        
        console.log('Instantiating WebAssembly module...');
        
        try {
            const { instance } = await WebAssembly.instantiate(wasmBuffer, go.importObject);
            console.log('WebAssembly instantiation successful');
            
            console.log('Running Go program...');
            // Run Go program (don't await as it's a long-running service)
            go.run(instance).catch(err => {
                console.error('Go WASM program exit error:', err);
            });
        } catch (instantiateError) {
            console.error('WebAssembly instantiation failed:', instantiateError);
            console.error('Error details:', {
                message: instantiateError.message,
                name: instantiateError.name,
                stack: instantiateError.stack
            });
            throw instantiateError;
        }

        // Wait for Go program to initialize and expose formatGo function
        console.log('Waiting for formatGo function to be available...');
        let retries = 0;
        const maxRetries = 20; // 增加重试次数

        while (typeof globalThis.formatGo !== 'function' && retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 200)); // 增加等待时间
            retries++;
            if (retries % 5 === 0) {
                console.log(`Waiting for formatGo function... (${retries}/${maxRetries})`);
            }
        }

        if (typeof globalThis.formatGo !== 'function') {
            throw new Error('Go WASM module not properly initialized - formatGo function not available after 20 retries');
        }
        
        console.log('Go WASM initialization completed successfully');
    })();

    return initializePromise;
};

export const languages = [
    {
        name: "Go",
        parsers: ["go-format"],
        extensions: [".go"],
        vscodeLanguageIds: ["go"],
    },
];

export const parsers = {
    "go-format": {
        parse: (text) => text,
        astFormat: "go-format",
        locStart: (node) => 0,
        locEnd: (node) => node.length,
    },
};

export const printers = {
    "go-format": {
        print: (path) => {
            const text = path.getValue();

            if (typeof globalThis.formatGo !== 'function') {
                // 如果 formatGo 函数不可用，尝试初始化
                initialize().then(() => {
                    // 初始化完成后，formatGo 应该可用
                }).catch(err => {
                    console.error('Go WASM initialization failed:', err);
                });
                
                // 如果还是不可用，返回原始文本
                return text;
            }

            try {
                return globalThis.formatGo(text);
            } catch (error) {
                console.error('Go formatting failed:', error);
                // 返回原始文本而不是抛出错误
                return text;
            }
        },
    },
};

// Export initialize function for manual initialization
export { initialize };

// Default export for Prettier plugin compatibility
export default {
    languages,
    parsers,
    printers
};
