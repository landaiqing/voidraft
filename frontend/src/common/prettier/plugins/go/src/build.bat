@echo off
rem Build script for Go Prettier Plugin WASM using native Go
rem This script compiles the Go code to WebAssembly for browser environment

echo Building Go Prettier Plugin WASM with native Go...

rem Check if Go is available
go version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Go not found! Please install Go 1.21+ first.
    echo Visit: https://golang.org/dl/
    pause
    exit /b 1
)

rem Set WASM build environment for browser (js/wasm)
set GOOS=js
set GOARCH=wasm

rem Build the WASM file using native Go
echo Compiling main.go to go.wasm with Go...
go build -o go-format.wasm main.go

if %ERRORLEVEL% EQU 0 (
    echo Build successful!

    echo Go Prettier Plugin WASM is ready!
) else (
    echo Build failed!
    pause
    exit /b 1
)