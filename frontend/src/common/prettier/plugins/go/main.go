//go:build js && wasm

// Package main implements a WebAssembly module that provides Go code formatting
// functionality for the Prettier plugin. This package exposes the formatGo function
// to JavaScript, enabling web-based Go code formatting with better error tolerance.
package main

import (
	"bytes"
	"fmt"
	"go/format"
	"go/parser"
	"go/token"
	"strings"
	"syscall/js"
)

// formatGoCode attempts to format Go source code with better error tolerance
func formatGoCode(src string) (string, error) {
	// Trim input but preserve leading/trailing newlines structure
	trimmed := strings.TrimSpace(src)
	if trimmed == "" {
		return src, nil
	}

	// First try the standard format.Source for complete, valid code
	if formatted, err := format.Source([]byte(src)); err == nil {
		return string(formatted), nil
	}

	// Create a new file set for parsing
	fset := token.NewFileSet()

	// Strategy 1: Try as complete Go file
	if parsed, err := parser.ParseFile(fset, "", src, parser.ParseComments); err == nil {
		return formatASTNode(fset, parsed)
	}

	// Strategy 2: Try wrapping as package-level declarations
	packageWrapped := fmt.Sprintf("package main\n\n%s", trimmed)
	if parsed, err := parser.ParseFile(fset, "", packageWrapped, parser.ParseComments); err == nil {
		if formatted, err := formatASTNode(fset, parsed); err == nil {
			return extractPackageContent(formatted), nil
		}
	}

	// Strategy 3: Try wrapping in main function
	funcWrapped := fmt.Sprintf("package main\n\nfunc main() {\n%s\n}", indentLines(trimmed, "\t"))
	if parsed, err := parser.ParseFile(fset, "", funcWrapped, parser.ParseComments); err == nil {
		if formatted, err := formatASTNode(fset, parsed); err == nil {
			return extractFunctionBody(formatted), nil
		}
	}

	// Strategy 4: Try wrapping in anonymous function
	anonWrapped := fmt.Sprintf("package main\n\nvar _ = func() {\n%s\n}", indentLines(trimmed, "\t"))
	if parsed, err := parser.ParseFile(fset, "", anonWrapped, parser.ParseComments); err == nil {
		if formatted, err := formatASTNode(fset, parsed); err == nil {
			return extractFunctionBody(formatted), nil
		}
	}

	// Strategy 5: Try line-by-line formatting for complex cases
	return formatLineByLine(trimmed, fset)
}

// formatASTNode formats an AST node using the standard formatter
func formatASTNode(fset *token.FileSet, node interface{}) (string, error) {
	var buf bytes.Buffer
	if err := format.Node(&buf, fset, node); err != nil {
		return "", err
	}
	return buf.String(), nil
}

// extractPackageContent extracts content after package declaration
func extractPackageContent(formatted string) string {
	lines := strings.Split(formatted, "\n")
	var contentLines []string
	skipNext := false

	for _, line := range lines {
		if strings.HasPrefix(line, "package ") {
			skipNext = true
			continue
		}
		if skipNext && strings.TrimSpace(line) == "" {
			skipNext = false
			continue
		}
		if !skipNext {
			contentLines = append(contentLines, line)
		}
	}

	return strings.Join(contentLines, "\n")
}

// extractFunctionBody extracts content from within a function body
func extractFunctionBody(formatted string) string {
	lines := strings.Split(formatted, "\n")
	var bodyLines []string
	inFunction := false
	braceCount := 0

	for _, line := range lines {
		if strings.Contains(line, "func ") && strings.Contains(line, "{") {
			inFunction = true
			braceCount = 1
			continue
		}

		if inFunction {
			// Count braces to know when function ends
			braceCount += strings.Count(line, "{")
			braceCount -= strings.Count(line, "}")

			if braceCount == 0 {
				break
			}

			// Remove one level of indentation and add the line
			if strings.HasPrefix(line, "\t") {
				bodyLines = append(bodyLines, line[1:])
			} else {
				bodyLines = append(bodyLines, line)
			}
		}
	}

	// Remove empty lines from start and end
	for len(bodyLines) > 0 && strings.TrimSpace(bodyLines[0]) == "" {
		bodyLines = bodyLines[1:]
	}
	for len(bodyLines) > 0 && strings.TrimSpace(bodyLines[len(bodyLines)-1]) == "" {
		bodyLines = bodyLines[:len(bodyLines)-1]
	}

	return strings.Join(bodyLines, "\n")
}

// indentLines adds indentation to each non-empty line
func indentLines(text, indent string) string {
	lines := strings.Split(text, "\n")
	var indentedLines []string

	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			indentedLines = append(indentedLines, "")
		} else {
			indentedLines = append(indentedLines, indent+line)
		}
	}

	return strings.Join(indentedLines, "\n")
}

// formatLineByLine attempts to format each statement individually
func formatLineByLine(src string, fset *token.FileSet) (string, error) {
	lines := strings.Split(src, "\n")
	var formattedLines []string

	for _, line := range lines {
		trimmedLine := strings.TrimSpace(line)
		if trimmedLine == "" {
			formattedLines = append(formattedLines, "")
			continue
		}

		// Try different wrapping strategies for individual lines
		attempts := []string{
			fmt.Sprintf("package main\n\nfunc main() {\n\t%s\n}", trimmedLine),
			fmt.Sprintf("package main\n\n%s", trimmedLine),
			fmt.Sprintf("package main\n\nvar _ = %s", trimmedLine),
		}

		formatted := trimmedLine // fallback
		for _, attempt := range attempts {
			if parsed, err := parser.ParseFile(fset, "", attempt, parser.ParseComments); err == nil {
				if result, err := formatASTNode(fset, parsed); err == nil {
					if extracted := extractSingleStatement(result, trimmedLine); extracted != "" {
						formatted = extracted
						break
					}
				}
			}
		}

		formattedLines = append(formattedLines, formatted)
	}

	return strings.Join(formattedLines, "\n"), nil
}

// extractSingleStatement tries to extract a single formatted statement
func extractSingleStatement(formatted, original string) string {
	lines := strings.Split(formatted, "\n")

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" && !strings.HasPrefix(trimmed, "package ") &&
			!strings.HasPrefix(trimmed, "func ") && !strings.HasPrefix(trimmed, "var _ =") &&
			trimmed != "{" && trimmed != "}" {
			// Remove leading tabs/spaces to normalize indentation
			return strings.TrimLeft(line, " \t")
		}
	}

	return original
}

// formatGo is a JavaScript-callable function that formats Go source code.
// It attempts multiple strategies to format code, including handling incomplete
// or syntactically invalid code fragments.
//
// Parameters:
//   - this: The JavaScript 'this' context (unused)
//   - i: JavaScript arguments array where i[0] should contain the Go source code as a string
//
// Returns:
//   - js.Value: The formatted Go source code as a JavaScript string value
//   - If formatting fails completely, returns the original code unchanged
//   - If no arguments are provided, returns js.Null() and logs an error
func formatGo(this js.Value, i []js.Value) interface{} {
	if len(i) == 0 {
		js.Global().Get("console").Call("error", "formatGo: missing code argument")
		return js.Null()
	}

	code := i[0].String()
	if strings.TrimSpace(code) == "" {
		return js.ValueOf(code)
	}

	formatted, err := formatGoCode(code)
	if err != nil {
		js.Global().Get("console").Call("warn", "Go formatting had issues:", err.Error())
		return js.ValueOf(code) // Return original code if all attempts fail
	}

	return js.ValueOf(formatted)
}

// main initializes the WebAssembly module and exposes the formatGo function
// to the JavaScript global scope.
func main() {
	// Create a channel to keep the Go program running
	c := make(chan struct{}, 0)

	// Expose the formatGo function to the JavaScript global scope
	js.Global().Set("formatGo", js.FuncOf(formatGo))

	// Block forever
	<-c
}
