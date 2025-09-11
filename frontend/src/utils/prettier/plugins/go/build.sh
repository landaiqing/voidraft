#!/bin/bash

# Build script for Go Prettier Plugin WASM
# This script compiles the Go code to WebAssembly

echo "🔨 Building Go Prettier Plugin WASM..."

# Set WASM build environment
export GOOS=js
export GOARCH=wasm

# Build the WASM file
echo "Compiling main.go to go.wasm..."
go build -o go.wasm main.go

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo "📊 WASM file size: $(du -h go.wasm | cut -f1)"
    
    # Copy to public directory for browser access
    if [ -d "../../../../../public" ]; then
        cp go.wasm ../../../../../public/go.wasm
        echo "📋 Copied to public directory"
    fi
    
    echo "🎉 Go Prettier Plugin WASM is ready!"
else
    echo "❌ Build failed!"
    exit 1
fi
