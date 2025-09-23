import initAsync from './shfmt.js'
import wasm_url from './shfmt.wasm?url'

export default function init() {
    return initAsync(wasm_url)
}

export * from './shfmt.js'