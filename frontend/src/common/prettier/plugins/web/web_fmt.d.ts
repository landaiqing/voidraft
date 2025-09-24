/* tslint:disable */
 
export function format_json(src: string, config?: JsonConfig): string;
export function format_markup(src: string, filename: string, config?: MarkupConfig): string;
export function format_script(src: string, filename: string, config?: ScriptConfig): string;
export function format_style(src: string, filename: string, config?: StyleConfig): string;
export function format(src: string, filename: string, config?: Config): string;
export type JsonConfig = LayoutConfig;


export interface MarkupConfig extends LayoutConfig {
	/**
	 *  See {@link https://github.com/g-plane/markup_fmt/blob/main/docs/config.md}
	 */
	[other: string]: any;
}


export interface ScriptConfig extends LayoutConfig {
	quote_style?: "double" | "single";
	jsx_quote_style?: "double" | "single";
	quote_properties?: "preserve" | "as-needed";
	trailing_comma?: "es5" | "all" | "none";
	semicolons?: "always" | "as-needed";
	arrow_parentheses?: "always" | "as-needed";
	bracket_spacing?: boolean;
	bracket_same_line?: boolean;
}


export interface StyleConfig extends LayoutConfig {
	/**
	 *  See {@link https://github.com/g-plane/malva/blob/main/docs/config.md}
	 */
	[other: string]: any;
}


export interface Config extends LayoutConfig {
	markup?: MarkupConfig;
	script?: ScriptConfig;
	style?: StyleConfig;
	json?: JsonConfig;
}


interface LayoutConfig {
	indent_style?: "tab" | "space";
	indent_width?: number;
	line_width?: number;
	line_ending?: "lf" | "crlf";
}


export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly format_json: (a: number, b: number, c: number, d: number) => void;
  readonly format_markup: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  readonly format_script: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  readonly format_style: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  readonly format: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  readonly __wbindgen_export_0: (a: number, b: number) => number;
  readonly __wbindgen_export_1: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_export_2: (a: number) => void;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_export_3: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
