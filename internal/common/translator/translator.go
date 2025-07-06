// Package translator 提供文本翻译功能
package translator

import (
	"fmt"
	"time"

	"golang.org/x/text/language"
)

// TranslationParams 用于指定翻译参数
type TranslationParams struct {
	From    string        // 源语言
	To      string        // 目标语言
	Timeout time.Duration // 超时时间
}

// 常量定义
const (
	defaultTimeout = 30 * time.Second
)

// TranslatorType 翻译器类型
type TranslatorType string

const (
	// GoogleTranslatorType 谷歌翻译器
	GoogleTranslatorType TranslatorType = "google"
	// BingTranslatorType 必应翻译器
	BingTranslatorType TranslatorType = "bing"
	// YoudaoTranslatorType 有道翻译器
	YoudaoTranslatorType TranslatorType = "youdao"
	// DeeplTranslatorType DeepL翻译器
	DeeplTranslatorType TranslatorType = "deepl"
)

// LanguageInfo 语言信息结构体
type LanguageInfo struct {
	Code string // 语言代码
	Name string // 语言名称
}

// Translator 翻译器接口，定义所有翻译器必须实现的方法
type Translator interface {
	// Translate 使用Go语言提供的标准语言标签进行文本翻译
	Translate(text string, from language.Tag, to language.Tag) (string, error)

	// TranslateWithParams 使用简单字符串参数进行文本翻译
	TranslateWithParams(text string, params TranslationParams) (string, error)

	// SetTimeout 设置请求超时时间
	SetTimeout(timeout time.Duration)

	// GetSupportedLanguages 获取翻译器支持的语言列表
	GetSupportedLanguages() map[string]LanguageInfo

	// IsLanguageSupported 检查指定的语言代码是否受支持
	IsLanguageSupported(languageCode string) bool

	// GetStandardLanguageCode 获取标准化的语言代码
	GetStandardLanguageCode(languageCode string) string
}

// TranslatorFactory 翻译器工厂，用于创建不同类型的翻译器
type TranslatorFactory struct{}

// NewTranslatorFactory 创建一个新的翻译器工厂
func NewTranslatorFactory() *TranslatorFactory {
	return &TranslatorFactory{}
}

// Create 根据类型创建翻译器
func (f *TranslatorFactory) Create(translatorType TranslatorType) (Translator, error) {
	switch translatorType {
	case GoogleTranslatorType:
		return NewGoogleTranslator(), nil
	case BingTranslatorType:
		return NewBingTranslator(), nil
	case YoudaoTranslatorType:
		return NewYoudaoTranslator(), nil
	case DeeplTranslatorType:
		return NewDeeplTranslator(), nil
	default:
		return nil, fmt.Errorf("unsupported translator type: %s", translatorType)
	}
}
