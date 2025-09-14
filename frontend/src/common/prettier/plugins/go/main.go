//go:build js && wasm

// Package main implements a WebAssembly module that provides Go code formatting
// functionality for the Prettier plugin. This package exposes the formatGo function
// to JavaScript, enabling web-based Go code formatting using Go's built-in format package.
//
// The module is designed to be compiled to WebAssembly and loaded in Node.js
// environments as part of the go-prettier-format plugin.
package main

import (
	"go/format"
	"syscall/js"
)

// formatGo is a JavaScript-callable function that formats Go source code.
// It wraps the standard library's go/format.Source function to be accessible
// from JavaScript environments through WebAssembly.
//
// Parameters:
//   - this: The JavaScript 'this' context (unused)
//   - i: JavaScript arguments array where i[0] should contain the Go source code as a string
//
// Returns:
//   - js.Value: The formatted Go source code as a JavaScript string value
//   - If formatting fails due to syntax errors, returns the original code unchanged
//   - If no arguments are provided, returns js.Null() and logs an error
//
// The function handles syntax errors gracefully by returning the original code
// and logging error details to the JavaScript console for debugging purposes.
func formatGo(this js.Value, i []js.Value) interface{} {
	if len(i) == 0 {
		js.Global().Get("console").Call("error", "formatGo: missing code argument")
		return js.Null()
	}
	code := i[0].String()
	formatted, err := format.Source([]byte(code))
	if err != nil {
		// In case of a syntax error in the Go code, go/format returns an error.
		// Prettier expects the original text to be returned in case of an error.
		// We also log the error to the console for debugging purposes.
		js.Global().Get("console").Call("error", "Error formatting Go code:", err.Error())
		return js.ValueOf(code)
	}
	return js.ValueOf(string(formatted))
}

// main initializes the WebAssembly module and exposes the formatGo function
// to the JavaScript global scope. The function sets up a blocking channel
// to prevent the WASM module from exiting, allowing it to serve as a
// long-running service for formatting operations.
//
// The exposed formatGo function can be called from JavaScript as:
//
//	global.formatGo(sourceCode)
func main() {
	// Create a channel to keep the Go program running.
	// This is necessary because the WASM module would exit otherwise.
	c := make(chan struct{}, 0)

	// Expose the formatGo function to the JavaScript global scope.
	js.Global().Set("formatGo", js.FuncOf(formatGo))

	// Block forever
	<-c
}
