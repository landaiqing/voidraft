cd $(dirname $0)/..
project_dir=$(pwd)

cd ../..
wasm-pack build --target=web --scope=wasm-fmt ruff_fmt

cd $project_dir

cp -R ./extra/. ./pkg/
