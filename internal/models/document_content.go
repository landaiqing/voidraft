package models

import (
	"strings"
	"unicode"
)

const (
	DocumentBlockDelimiterStart  = "∞∞∞"
	DocumentBlockDelimiterPrefix = "\n" + DocumentBlockDelimiterStart
	DefaultDocumentBlockLanguage = "text"
	DefaultDocumentContent       = DocumentBlockDelimiterPrefix + "text-a-w\n"
)

func BuildDefaultDocumentContent(language string, autoDetect bool) string {
	token := normalizeBlockLanguageToken(language)
	flags := ""
	if autoDetect {
		flags += "-a"
	}
	flags += "-w"
	return DocumentBlockDelimiterPrefix + token + flags + "\n"
}

func NormalizeDocumentContent(content string) string {
	if strings.HasPrefix(content, DocumentBlockDelimiterStart) &&
		!strings.HasPrefix(content, DocumentBlockDelimiterPrefix) {
		return "\n" + content
	}
	return content
}

func normalizeBlockLanguageToken(language string) string {
	language = strings.ToLower(strings.TrimSpace(language))
	if language == "" {
		return DefaultDocumentBlockLanguage
	}

	for _, char := range language {
		if !unicode.IsLetter(char) && !unicode.IsDigit(char) && char != '_' {
			return DefaultDocumentBlockLanguage
		}
	}

	return language
}
