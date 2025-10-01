// Package translator 提供文本翻译功能
package translator

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"golang.org/x/text/language"
)

// TartuNLPTranslator TartuNLP翻译器结构体
type TartuNLPTranslator struct {
	httpClient *http.Client            // HTTP客户端
	Timeout    time.Duration           // 请求超时时间
	languages  map[string]LanguageInfo // 支持的语言列表
}

// 常量定义
const (
	tartuNLPDefaultTimeout = 300 * time.Second                        // 默认超时时间300秒
	tartuNLPAPIURL         = "https://api.tartunlp.ai/translation/v2" // TartuNLP API地址
	tartuNLPLengthLimit    = 5000                                     // 长度限制5000字符
)

// 错误定义
var (
	ErrTartuNLPNetworkError    = errors.New("tartunlp translator network error")
	ErrTartuNLPUnsupportedLang = errors.New("tartunlp translator unsupported language")
	ErrTartuNLPResponseError   = errors.New("tartunlp translator response error")
	ErrTartuNLPLengthExceeded  = errors.New("tartunlp translator text length exceeded")
)

// TartuNLPRequest TartuNLP请求结构体
type TartuNLPRequest struct {
	Text []string `json:"text"` // 要翻译的文本数组
	Src  string   `json:"src"`  // 源语言
	Tgt  string   `json:"tgt"`  // 目标语言
}

// TartuNLPResponse TartuNLP响应结构体
type TartuNLPResponse struct {
	Result []string `json:"result"` // 翻译结果数组
}

// NewTartuNLPTranslator 创建一个新的TartuNLP翻译器实例
func NewTartuNLPTranslator() *TartuNLPTranslator {
	translator := &TartuNLPTranslator{
		httpClient: &http.Client{
			Timeout: tartuNLPDefaultTimeout,
		},
		Timeout:   tartuNLPDefaultTimeout,
		languages: initTartuNLPLanguages(),
	}

	return translator
}

// initTartuNLPLanguages 初始化TartuNLP翻译器支持的语言列表
func initTartuNLPLanguages() map[string]LanguageInfo {
	// 创建语言映射表
	languages := make(map[string]LanguageInfo)

	// 添加支持的语言
	// 基于 TartuNLP API 支持的语言列表
	languages["en"] = LanguageInfo{Code: "en", Name: "English"}
	languages["et"] = LanguageInfo{Code: "et", Name: "Estonian"}
	languages["de"] = LanguageInfo{Code: "de", Name: "German"}
	languages["lt"] = LanguageInfo{Code: "lt", Name: "Lithuanian"}
	languages["lv"] = LanguageInfo{Code: "lv", Name: "Latvian"}
	languages["fi"] = LanguageInfo{Code: "fi", Name: "Finnish"}
	languages["ru"] = LanguageInfo{Code: "ru", Name: "Russian"}
	languages["no"] = LanguageInfo{Code: "no", Name: "Norwegian"}
	languages["hu"] = LanguageInfo{Code: "hu", Name: "Hungarian"}
	languages["se"] = LanguageInfo{Code: "se", Name: "Swedish"}

	return languages
}

// SetTimeout 设置请求超时时间
func (t *TartuNLPTranslator) SetTimeout(timeout time.Duration) {
	t.Timeout = timeout
	t.httpClient.Timeout = timeout
}

// Translate 使用标准语言标签进行文本翻译
func (t *TartuNLPTranslator) Translate(text string, from language.Tag, to language.Tag) (string, error) {
	return t.translate(text, from.String(), to.String())
}

// TranslateWithParams 使用简单字符串参数进行文本翻译
func (t *TartuNLPTranslator) TranslateWithParams(text string, params TranslationParams) (string, error) {
	// 设置超时时间（如果有指定）
	if params.Timeout > 0 {
		t.SetTimeout(params.Timeout)
	}

	return t.translate(text, params.From, params.To)
}

// checkLengthLimit 检查文本长度是否超出限制
func (t *TartuNLPTranslator) checkLengthLimit(text string) error {
	if len(text) > tartuNLPLengthLimit {
		return fmt.Errorf("%w: text length %d exceeds limit %d", ErrTartuNLPLengthExceeded, len(text), tartuNLPLengthLimit)
	}
	return nil
}

// translate 执行实际翻译操作
func (t *TartuNLPTranslator) translate(text, from, to string) (string, error) {
	if text == "" {
		return "", fmt.Errorf("text cannot be empty")
	}

	// 检查文本长度限制
	if err := t.checkLengthLimit(text); err != nil {
		return "", err
	}

	// 转换语言代码为TartuNLP格式
	fromLower := strings.ToLower(from)
	toLower := strings.ToLower(to)

	// 验证源语言支持
	if _, ok := t.languages[fromLower]; !ok {
		return "", fmt.Errorf("%w: source language '%s' not supported by TartuNLP", ErrTartuNLPUnsupportedLang, from)
	}

	// 验证目标语言支持
	if _, ok := t.languages[toLower]; !ok {
		return "", fmt.Errorf("%w: target language '%s' not supported by TartuNLP", ErrTartuNLPUnsupportedLang, to)
	}

	// 创建带超时的context
	ctx, cancel := context.WithTimeout(context.Background(), t.Timeout)
	defer cancel()

	// 构建请求体
	request := TartuNLPRequest{
		Text: []string{text},
		Src:  fromLower,
		Tgt:  toLower,
	}

	// 序列化请求
	jsonData, err := json.Marshal(request)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	// 创建HTTP请求
	req, err := http.NewRequestWithContext(ctx, "POST", tartuNLPAPIURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	// 设置请求头
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	// 发送请求
	resp, err := t.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrTartuNLPNetworkError, err)
	}
	defer resp.Body.Close()

	// 检查HTTP状态码
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("%w: HTTP %d - %s", ErrTartuNLPResponseError, resp.StatusCode, string(body))
	}

	// 读取响应体
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	// 解析响应
	var response TartuNLPResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return "", fmt.Errorf("%w: failed to parse response: %v", ErrTartuNLPResponseError, err)
	}

	// 检查响应结果
	if len(response.Result) == 0 {
		return "", fmt.Errorf("%w: empty translation result", ErrTartuNLPResponseError)
	}

	return response.Result[0], nil
}

// GetSupportedLanguages 获取翻译器支持的语言列表
func (t *TartuNLPTranslator) GetSupportedLanguages() map[string]LanguageInfo {
	return t.languages
}

// IsLanguageSupported 检查指定的语言代码是否受支持
func (t *TartuNLPTranslator) IsLanguageSupported(languageCode string) bool {
	_, exists := t.languages[strings.ToLower(languageCode)]
	return exists
}
