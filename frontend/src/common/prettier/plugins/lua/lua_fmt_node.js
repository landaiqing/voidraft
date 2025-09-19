import fs from "node:fs/promises";
import initAsync from "./lua_fmt.js";

const wasm = new URL("./lua_fmt_bg.wasm", import.meta.url);

export default function __wbg_init(init = { module_or_path: fs.readFile(wasm) }) {
	return initAsync(init);
}

export * from "./lua_fmt.js";
