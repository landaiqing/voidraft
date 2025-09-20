cd $(dirname $0)/..
crates_dir=$(pwd)

cd ../..
wasm-pack build --target=web --scope=wasm-fmt crates/web_fmt

