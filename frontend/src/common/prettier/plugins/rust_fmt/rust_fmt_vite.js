import initAsync from "./rust_fmt.js";
import wasm from "./rust_fmt_bg.wasm?url";

export default function __wbg_init(input = { module_or_path: wasm }) {
	return initAsync(input);
}

export * from "./rust_fmt.js";