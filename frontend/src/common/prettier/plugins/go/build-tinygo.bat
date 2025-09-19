@echo off
rem Build script for Go Prettier Plugin WASM using TinyGo
rem This script compiles the Go code to WebAssembly for browser environment

echo Building Go Prettier Plugin WASM with TinyGo...

rem Check if TinyGo is available
tinygo version >nul 2>&1
if errorlevel 1 (
    echo TinyGo not found! Please install TinyGo first.
    echo Visit: https://tinygo.org/getting-started/install/
    pause
    exit /b 1
)

rem Display TinyGo version
echo Using TinyGo version:
tinygo version

rem Build the WASM file using TinyGo
echo Compiling main.go to go.wasm with TinyGo...
tinygo build -o go-format.wasm -target wasm main.go
if errorlevel 1 (
    echo Build failed!
    pause
    exit /b 1
)

echo Build successful!

rem Show file size (Windows version)
for %%A in (go.wasm) do echo WASM file size: %%~zA bytes

rem Copy to public directory for browser access
if exist "..\..\..\..\..\public" (
    copy go.wasm ..\..\..\..\..\public\go.wasm > nul
    echo Copied to public directory
    del go.wasm
    echo Cleaned up local WASM file
)

echo Go Prettier Plugin WASM (TinyGo) is ready!