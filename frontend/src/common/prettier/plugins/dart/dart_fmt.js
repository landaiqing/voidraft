import { format as dart_fmt, instantiate, invoke } from "./dart_fmt.mjs";

let wasm;

function get_imports() {}
function init_memory() {}

function normalize(module) {
	if (!(module instanceof WebAssembly.Module)) {
		return new WebAssembly.Module(module);
	}
	return module;
}

export default async function (input) {
	if (wasm !== undefined) return wasm;

	if (typeof input === "undefined") {
		input = new URL("dart_fmt.wasm", import.meta.url);
	}
	const imports = get_imports();

	if (
		typeof input === "string" ||
		(typeof Request === "function" && input instanceof Request) ||
		(typeof URL === "function" && input instanceof URL)
	) {
		input = fetch(input);
	}

	init_memory(imports);

	wasm = await load(await input)
		.then(normalize)
		.then(instantiate);

	invoke(wasm);

	return wasm;
}

async function load(module) {
	if (typeof Response === "function" && module instanceof Response) {
		if ("compileStreaming" in WebAssembly) {
			try {
				return await WebAssembly.compileStreaming(module);
			} catch (e) {
				if (module.headers.get("Content-Type") != "application/wasm") {
					console.warn(
						"`WebAssembly.compileStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n",
						e,
					);
				} else {
					throw e;
				}
			}
		}

		return module.arrayBuffer();
	}

	return module;
}

export function format(source, filename = "stdin.dart", config = {}) {
	const options = { lineEnding: "\n" };
	if (config.line_width) {
		options.pageWidth = config.line_width;
	}
	if (options.line_ending === "crlf") {
		options.lineEnding = "\r\n";
	}
	if(options.language_version) {
		options.languageVersion = options.language_version;
	}

	const result = dart_fmt(source, filename, JSON.stringify(options));
	const err = result[0] === "x";
	const output = result.slice(1);
	if (err) {
		throw new Error(output);
	}
	return output;
}
