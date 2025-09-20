cd $(dirname $0)
project_dir=$(pwd)

wasm-pack build --target=web --scope=wasm-fmt .

