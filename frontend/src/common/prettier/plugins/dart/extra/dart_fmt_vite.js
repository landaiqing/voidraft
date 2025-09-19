import initAsync from "./dart_fmt.js";
import wasm from "./dart_fmt.wasm?url";

export default function __wbg_init(input = wasm) {
	return initAsync(input);
}

export * from "./dart_fmt.js";
