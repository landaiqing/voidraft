cd $(dirname $0)/..

dart compile wasm ./lib/binding.dart -o ./build/dart_fmt.wasm
cp -LR ./extra/. ./build/

./scripts/patch.mjs ./build/dart_fmt.mjs
./scripts/package.mjs ./package.json
