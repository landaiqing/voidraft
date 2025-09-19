#!/bin/bash

# Build script for Go Prettier Plugin WASM using TinyGo
# This script compiles the Go code to WebAssembly for browser environment

echo "Building Go Prettier Plugin WASM with TinyGo..."

# Check if TinyGo is available
if ! command -v tinygo &> /dev/null; then
    echo "TinyGo not found! Please install TinyGo first."
    echo "Visit: https://tinygo.org/getting-started/install/"
    exit 1
fi

# Display TinyGo version
echo "Using TinyGo version: $(tinygo version)"

# Build the WASM file using TinyGo
echo "Compiling main.go to go.wasm with TinyGo..."
tinygo build -o go-format.wasm -target wasm main.go

if [ $? -ne 0 ]; then
    echo "Build failed!"
    exit 1
fi

echo "Build successful!"
echo "WASM file size: $(du -h go-format.wasm | cut -f1)"

# Copy to public directory for browser access
if [ -d "../../../../../public" ]; then
    cp go-format.wasm ../../../../../public/go-format.wasm
    echo "Copied to public directory"
    rm go-format.wasm
    echo "Cleaned up local WASM file"
fi

echo "Go Prettier Plugin WASM (TinyGo) is ready!"
