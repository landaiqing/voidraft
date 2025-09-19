import fs from "node:fs/promises";
import initAsync from "./dart_fmt.js";

const wasm = new URL("./dart_fmt.wasm", import.meta.url);

export default function __wbg_init(init = fs.readFile(wasm)) {
	return initAsync(init);
}

export * from "./dart_fmt.js";
