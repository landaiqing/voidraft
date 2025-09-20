import fs from "node:fs/promises";
import initAsync from "./rust_fmt.js";

const wasm = new URL("./rust_fmt_bg.wasm", import.meta.url);

export default function __wbg_init(init = { module_or_path: fs.readFile(wasm) }) {
	return initAsync(init);
}

export * from "./rust_fmt.js";