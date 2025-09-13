@echo off
rem Build script for Go Prettier Plugin WASM
rem This script compiles the Go code to WebAssembly

echo 🔨 Building Go Prettier Plugin WASM...

rem Set WASM build environment
set GOOS=js
set GOARCH=wasm

rem Build the WASM file
echo Compiling main.go to go.wasm...
go build -o go.wasm main.go

if %ERRORLEVEL% EQU 0 (
    echo ✅ Build successful!
    
    rem Show file size (Windows version)
    for %%A in (go.wasm) do echo 📊 WASM file size: %%~zA bytes
    
    rem Copy to public directory for browser access
    if exist "..\..\..\..\..\public" (
        copy go.wasm ..\..\..\..\..\public\go.wasm > nul
        echo 📋 Copied to public directory
    )
    
    echo 🎉 Go Prettier Plugin WASM is ready!
) else (
    echo ❌ Build failed!
    pause
    exit /b 1
)
