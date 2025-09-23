import initAsync from './docker_fmt.js'
import wasm_url from './docker_fmt.wasm?url'

export default function init() {
    return initAsync(wasm_url)
}

export * from './docker_fmt.js'