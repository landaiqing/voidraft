//go:build js || wasm

// tinygo build -o docker_fmt.wasm -target wasm --no-debug
package main

import (
	"strings"
	"syscall/js"

	"docker_fmt/lib"
)

func Format(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return []any{true, "missing input argument"}
	}

	input := args[0].String()

	// Default configuration
	indentSize := uint(4)
	newlineFlag := true
	spaceRedirects := false

	// Parse optional configuration if provided
	if len(args) > 1 && !args[1].IsNull() && !args[1].IsUndefined() {
		config := args[1]
		if !config.Get("indentSize").IsUndefined() {
			indentSize = uint(config.Get("indentSize").Int())
		}
		if !config.Get("trailingNewline").IsUndefined() {
			newlineFlag = config.Get("trailingNewline").Bool()
		}
		if !config.Get("spaceRedirects").IsUndefined() {
			spaceRedirects = config.Get("spaceRedirects").Bool()
		}
	}

	originalLines := strings.SplitAfter(input, "\n")
	c := &lib.Config{
		IndentSize:      indentSize,
		TrailingNewline: newlineFlag,
		SpaceRedirects:  spaceRedirects,
	}

	result, err := lib.FormatFileLines(originalLines, c)
	if err != nil {
		return []any{true, err.Error()}
	}

	return []any{false, result}
}

func main() {
	done := make(chan bool)
	js.Global().Set("dockerFormat", js.FuncOf(Format))
	<-done
}
