#!/bin/bash

# Build script for Go Prettier Plugin WASM using native Go
# This script compiles the Go code to WebAssembly for browser environment

echo "Building Go Prettier Plugin WASM with native Go..."

# Check if Go is available
if ! command -v go &> /dev/null; then
    echo "Go not found! Please install Go 1.21+ first."
    echo "Visit: https://golang.org/dl/"
    exit 1
fi

# Display Go version
echo "Using Go version: $(go version)"

# Set WASM build environment for browser (js/wasm)
export GOOS=js
export GOARCH=wasm

# Build the WASM file using native Go
echo "Compiling main.go to go.wasm with Go..."
go build -o go-format.wasm main.go

if [ $? -eq 0 ]; then
    echo "Build successful!"
    echo "WASM file size: $(du -h go-format.wasm | cut -f1)"
    
    # Copy to public directory for browser access
    if [ -d "../../../../../public" ]; then
        cp go-format.wasm ../../../../../public/go-format.wasm
        echo "Copied to public directory"
        rm go-format.wasm
        echo "Cleaned up local WASM file"
    fi
    
    echo "Go Prettier Plugin WASM is ready!"
else
    echo "Build failed!"
    exit 1
fi