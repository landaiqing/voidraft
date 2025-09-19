export function format(input: string, filename: string, config?: LayoutConfig): string;

interface LayoutConfig {
	line_width?: number;
	line_ending?: "lf" | "crlf";
	language_version?: string;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export type InitOutput = unknown;

// export type SyncInitInput = BufferSource | WebAssembly.Module;
// /**
// * Instantiates the given `module`, which can either be bytes or
// * a precompiled `WebAssembly.Module`.
// *
// * @param {SyncInitInput} module
// *
// * @returns {InitOutput}
// */
// export function initSync(module: SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {InitInput | Promise<InitInput>} module_or_path
*
* @returns {Promise<InitOutput>}
*/
export default function init(module_or_path?: InitInput | Promise<InitInput>): Promise<InitOutput>;
