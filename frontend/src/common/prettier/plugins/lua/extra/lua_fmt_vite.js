import initAsync from "./lua_fmt.js";
import wasm from "./lua_fmt_bg.wasm?url";

export default function __wbg_init(input = { module_or_path: wasm }) {
	return initAsync(input);
}

export * from "./lua_fmt.js";
