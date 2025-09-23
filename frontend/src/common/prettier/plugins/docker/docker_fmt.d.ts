// Format options interface for Dockerfile
export interface FormatOptions {
    indent?: number;
    trailingNewline?: boolean;
    spaceRedirects?: boolean;
}

// Initialize the WASM module
declare function init(wasmUrl?: string): Promise<void>;

// Format Dockerfile content
export declare function format(text: string, options?: FormatOptions): string;

// Format Dockerfile contents (alias for compatibility)
export declare function formatDockerfileContents(
    fileContents: string, 
    options?: FormatOptions
): string;

// Placeholder for Node.js compatibility (not implemented in browser)
export declare function formatDockerfile(): never;

export default init;