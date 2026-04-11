package models

import "strings"

const (
	DocumentBlockDelimiterStart  = "∞∞∞"
	DocumentBlockDelimiterPrefix = "\n" + DocumentBlockDelimiterStart
	DefaultDocumentContent       = DocumentBlockDelimiterPrefix + "text-a-w\n"
)

func NormalizeDocumentContent(content string) string {
	if strings.HasPrefix(content, DocumentBlockDelimiterStart) &&
		!strings.HasPrefix(content, DocumentBlockDelimiterPrefix) {
		return "\n" + content
	}
	return content
}
