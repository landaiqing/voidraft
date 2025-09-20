// Copyright 2018 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.
//
// This file has been modified for use by the TinyGo compiler.

	const encoder = new TextEncoder("utf-8");
	const decoder = new TextDecoder("utf-8");
	let reinterpretBuf = new DataView(new ArrayBuffer(8));
	var logLine = [];

	class TinyGo {
		constructor() {
			this._callbackTimeouts = new Map();
			this._nextCallbackTimeoutID = 1;

			const mem = () => {
				// The buffer may change when requesting more memory.
				return new DataView(this._inst.exports.memory.buffer);
			}

			const unboxValue = (v_ref) => {
				reinterpretBuf.setBigInt64(0, v_ref, true);
				const f = reinterpretBuf.getFloat64(0, true);
				if (f === 0) {
					return undefined;
				}
				if (!isNaN(f)) {
					return f;
				}

				const id = v_ref & 0xffffffffn;
				return this._values[id];
			}


			const loadValue = (addr) => {
				let v_ref = mem().getBigUint64(addr, true);
				return unboxValue(v_ref);
			}

			const boxValue = (v) => {
				const nanHead = 0x7FF80000n;

				if (typeof v === "number") {
					if (isNaN(v)) {
						return nanHead << 32n;
					}
					if (v === 0) {
						return (nanHead << 32n) | 1n;
					}
					reinterpretBuf.setFloat64(0, v, true);
					return reinterpretBuf.getBigInt64(0, true);
				}

				switch (v) {
					case undefined:
						return 0n;
					case null:
						return (nanHead << 32n) | 2n;
					case true:
						return (nanHead << 32n) | 3n;
					case false:
						return (nanHead << 32n) | 4n;
				}

				let id = this._ids.get(v);
				if (id === undefined) {
					id = this._idPool.pop();
					if (id === undefined) {
						id = BigInt(this._values.length);
					}
					this._values[id] = v;
					this._goRefCounts[id] = 0;
					this._ids.set(v, id);
				}
				this._goRefCounts[id]++;
				let typeFlag = 1n;
				switch (typeof v) {
					case "string":
						typeFlag = 2n;
						break;
					case "symbol":
						typeFlag = 3n;
						break;
					case "function":
						typeFlag = 4n;
						break;
				}
				return id | ((nanHead | typeFlag) << 32n);
			}

			const storeValue = (addr, v) => {
				let v_ref = boxValue(v);
				mem().setBigUint64(addr, v_ref, true);
			}

			const loadSlice = (array, len, cap) => {
				return new Uint8Array(this._inst.exports.memory.buffer, array, len);
			}

			const loadSliceOfValues = (array, len, cap) => {
				const a = new Array(len);
				for (let i = 0; i < len; i++) {
					a[i] = loadValue(array + i * 8);
				}
				return a;
			}

			const loadString = (ptr, len) => {
				return decoder.decode(new DataView(this._inst.exports.memory.buffer, ptr, len));
			}

			const timeOrigin = Date.now() - performance.now();
			this.importObject = {
				wasi_snapshot_preview1: {
					// https://github.com/WebAssembly/WASI/blob/main/phases/snapshot/docs.md#fd_write
					fd_write: () => 0,      // dummy
				},
				gojs: {
					// func ticks() float64
					"runtime.ticks": () => {
						return timeOrigin + performance.now();
					},

					// func finalizeRef(v ref)
					"syscall/js.finalizeRef": (v_ref) => {
						reinterpretBuf.setBigInt64(0, v_ref, true);
						const f = reinterpretBuf.getFloat64(0, true);
						if (f === 0 || !isNaN(f)) {
							return;
						}
						const id = v_ref & 0xffffffffn;
						this._goRefCounts[id]--;
						if (this._goRefCounts[id] === 0) {
							const v = this._values[id];
							this._values[id] = null;
							this._ids.delete(v);
							this._idPool.push(id);
						}
					},

					// func stringVal(value string) ref
					"syscall/js.stringVal": (value_ptr, value_len) => {
						const s = loadString(value_ptr, value_len);
						return boxValue(s);
					},

					// func valueGet(v ref, p string) ref
					"syscall/js.valueGet": (v_ref, p_ptr, p_len) => {
						let prop = loadString(p_ptr, p_len);
						let v = unboxValue(v_ref);
						let result = Reflect.get(v, prop);
						return boxValue(result);
					},

					// func valueSet(v ref, p string, x ref)
					"syscall/js.valueSet": (v_ref, p_ptr, p_len, x_ref) => {
						const v = unboxValue(v_ref);
						const p = loadString(p_ptr, p_len);
						const x = unboxValue(x_ref);
						Reflect.set(v, p, x);
					},

					// func valueIndex(v ref, i int) ref
					"syscall/js.valueIndex": (v_ref, i) => {
						return boxValue(Reflect.get(unboxValue(v_ref), i));
					},

					// valueSetIndex(v ref, i int, x ref)
					"syscall/js.valueSetIndex": (v_ref, i, x_ref) => {
						Reflect.set(unboxValue(v_ref), i, unboxValue(x_ref));
					},

					// func valueCall(v ref, m string, args []ref) (ref, bool)
					"syscall/js.valueCall": (ret_addr, v_ref, m_ptr, m_len, args_ptr, args_len, args_cap) => {
						const v = unboxValue(v_ref);
						const name = loadString(m_ptr, m_len);
						const args = loadSliceOfValues(args_ptr, args_len, args_cap);
						try {
							const m = Reflect.get(v, name);
							storeValue(ret_addr, Reflect.apply(m, v, args));
							mem().setUint8(ret_addr + 8, 1);
						} catch (err) {
							storeValue(ret_addr, err);
							mem().setUint8(ret_addr + 8, 0);
						}
					},

					// func valueNew(v ref, args []ref) (ref, bool)
					"syscall/js.valueNew": (ret_addr, v_ref, args_ptr, args_len, args_cap) => {
						const v = unboxValue(v_ref);
						const args = loadSliceOfValues(args_ptr, args_len, args_cap);
						try {
							storeValue(ret_addr, Reflect.construct(v, args));
							mem().setUint8(ret_addr + 8, 1);
						} catch (err) {
							storeValue(ret_addr, err);
							mem().setUint8(ret_addr+ 8, 0);
						}
					},

					// func valueLength(v ref) int
					"syscall/js.valueLength": (v_ref) => {
						return unboxValue(v_ref).length;
					},

					// valuePrepareString(v ref) (ref, int)
					"syscall/js.valuePrepareString": (ret_addr, v_ref) => {
						const s = String(unboxValue(v_ref));
						const str = encoder.encode(s);
						storeValue(ret_addr, str);
						mem().setInt32(ret_addr + 8, str.length, true);
					},

					// valueLoadString(v ref, b []byte)
					"syscall/js.valueLoadString": (v_ref, slice_ptr, slice_len, slice_cap) => {
						const str = unboxValue(v_ref);
						loadSlice(slice_ptr, slice_len, slice_cap).set(str);
					},
				}
			};

			// Go 1.20 uses 'env'. Go 1.21 uses 'gojs'.
			// For compatibility, we use both as long as Go 1.20 is supported.
			this.importObject.env = this.importObject.gojs;
		}

		async run(instance) {
			this._inst = instance;
			this._values = [ // JS values that Go currently has references to, indexed by reference id
				NaN,
				0,
				null,
				true,
				false,
				// fake global
				{
					set format(fn){ instance.format = fn; },
					Array,
					Object,
				},
				this,
			];
			this._goRefCounts = []; // number of references that Go has to a JS value, indexed by reference id
			this._ids = new Map();  // mapping from JS values to reference ids
			this._idPool = [];      // unused ids that have been garbage collected
			this.exited = false;    // whether the Go program has exited

			while (true) {
				const callbackPromise = new Promise((resolve) => {
					this._resolveCallbackPromise = () => {
						if (this.exited) {
							throw new Error("bad callback: Go program has already exited");
						}
						setTimeout(resolve, 0); // make sure it is asynchronous
					};
				});
				this._inst.exports._start();
				if (this.exited) {
					break;
				}
				await callbackPromise;
			}
		}

		_resume() {
			if (this.exited) {
				throw new Error("Go program has already exited");
			}
			this._inst.exports.resume();
			if (this.exited) {
				this._resolveExitPromise();
			}
		}

		_makeFuncWrapper(id) {
			const go = this;
			return function () {
				const event = { id: id, this: this, args: arguments };
				go._pendingEvent = event;
				go._resume();
				return event.result;
			};
		}
	}

/**
 * ================== End of wasm_exec.js ==================
 */
/**/let wasm;
/**/async function __load(module, imports) {
/**/	if (typeof Response === 'function' && module instanceof Response) {
/**/		if (typeof WebAssembly.instantiateStreaming === 'function') {
/**/			try { return await WebAssembly.instantiateStreaming(module, imports); }
/**/			catch (e) {
/**/				if (module.headers.get('Content-Type') != 'application/wasm') {
/**/					console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);
/**/				} else { throw e; }
/**/			}
/**/		}
/**/		const bytes = await module.arrayBuffer();
/**/		return await WebAssembly.instantiate(bytes, imports);
/**/	} else {
/**/		const instance = await WebAssembly.instantiate(module, imports);
/**/		if (instance instanceof WebAssembly.Instance) return { instance, module };
/**/		else return instance;
/**/	}
/**/}
/**/function __finalize_init(instance) {
/**/	return wasm = instance;
/**/}
/**/function __init_memory(imports, maybe_memory) { }
/**/export function initSync(module) {
/**/	if (wasm !== undefined) return wasm;
/**/
/**/	const go = new TinyGo();
/**/	const imports = go.importObject;
/**/
/**/	__init_memory(imports);
/**/
/**/	if (!(module instanceof WebAssembly.Module)) module = new WebAssembly.Module(module);
/**/
/**/	const instance = new WebAssembly.Instance(module, imports);
/**/
/**/	go.run(instance);
/**/	return __finalize_init(instance, module);
/**/}
/**/export default async function initAsync(input) {
/**/	if (wasm !== undefined) return wasm;
/**/
/**/	if (typeof input === 'undefined') input = new URL('gofmt.wasm', import.meta.url);
/**/
/**/	const go = new TinyGo();
/**/	const imports = go.importObject;
/**/
/**/	if (typeof input === 'string' || (typeof Request === 'function' && input instanceof Request) || (typeof URL === 'function' && input instanceof URL)) {
/**/		input = fetch(input);
/**/	}
/**/
/**/	__init_memory(imports);
/**/
/**/	const { instance, module } = await __load(await input, imports);
/**/
/**/	go.run(instance);
/**/	return __finalize_init(instance, module);
/**/}
/**/export function format(input) {
/**/	const [err, result] = wasm.format(input);
/**/	if (err) {
/**/		throw new Error(result);
/**/	}
/**/	return result;
/**/}
/**/
