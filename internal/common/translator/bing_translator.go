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
	"net/url"
	"strings"
	"time"

	"golang.org/x/text/language"
)

// BingTranslator Bing翻译器结构体
type BingTranslator struct {
	httpClient *http.Client            // HTTP客户端
	Timeout    time.Duration           // 请求超时时间
	token      *tokenInfo              // Token信息
	languages  map[string]LanguageInfo // 支持的语言列表
}

// tokenInfo 存储token信息
type tokenInfo struct {
	Value     string
	ExpiresAt time.Time
}

// TranslateRequest 翻译请求结构
type TranslateRequest struct {
	Text string `json:"Text"`
}

// TranslateResponse 翻译响应结构
type TranslateResponse struct {
	Translations []struct {
		Text string `json:"text"`
	} `json:"translations"`
}

// ErrorResponse 错误响应结构
type ErrorResponse struct {
	Error struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

// 常量定义
const (
	bingDefaultTimeout  = 30 * time.Second
	bingTokenURL        = "https://edge.microsoft.com/translate/auth"
	bingTranslateAPIURL = "https://api-edge.cognitive.microsofttranslator.com/translate"
	tokenValidDuration  = 25 * time.Minute // Token有效期，比实际30分钟稍短以确保安全
)

// 错误定义
var (
	ErrBingNetworkError  = errors.New("bing translator network error")
	ErrBingParseError    = errors.New("bing translator parse error")
	ErrBingEmptyResponse = errors.New("empty response from bing translator")
)

// NewBingTranslator 创建一个新的Bing翻译器实例
func NewBingTranslator() *BingTranslator {
	translator := &BingTranslator{
		httpClient: &http.Client{
			Timeout: bingDefaultTimeout,
		},
		Timeout:   bingDefaultTimeout,
		languages: initBingLanguages(),
	}

	return translator
}

// initBingLanguages 初始化Bing翻译器支持的语言列表
func initBingLanguages() map[string]LanguageInfo {
	// 创建语言映射表
	languages := make(map[string]LanguageInfo)

	// 添加支持的语言
	// 基于 Microsoft Translator API 支持的语言列表
	// 参考: https://docs.microsoft.com/en-us/azure/cognitive-services/translator/language-support

	languages["en"] = LanguageInfo{Code: "en", Name: "English"}
	languages["zh-Hans"] = LanguageInfo{Code: "zh-Hans", Name: "Chinese (Simplified)"}
	languages["zh-Hant"] = LanguageInfo{Code: "zh-Hant", Name: "Chinese (Traditional)"}

	return languages
}

// SetTimeout 设置请求超时时间
func (t *BingTranslator) SetTimeout(timeout time.Duration) {
	t.Timeout = timeout
	t.httpClient.Timeout = timeout
}

// getToken 获取访问token
func (t *BingTranslator) getToken(ctx context.Context) (string, error) {
	// 检查token是否有效
	if t.token != nil && time.Now().Before(t.token.ExpiresAt) {
		return t.token.Value, nil
	}

	// 创建请求
	req, err := http.NewRequestWithContext(ctx, "GET", bingTokenURL, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create token request: %w", err)
	}

	// 设置请求头
	req.Header.Set("Accept", "*/*")
	req.Header.Set("Accept-Language", "zh-TW,zh;q=0.9,ja;q=0.8,zh-CN;q=0.7,en-US;q=0.6,en;q=0.5")
	req.Header.Set("Cache-Control", "no-cache")
	req.Header.Set("Pragma", "no-cache")
	req.Header.Set("Referrer-Policy", "strict-origin-when-cross-origin")
	req.Header.Set("Sec-Fetch-Dest", "empty")
	req.Header.Set("Sec-Fetch-Mode", "cors")
	req.Header.Set("Sec-Fetch-Site", "none")

	// 发送请求
	resp, err := t.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to get token: %w", err)
	}
	defer resp.Body.Close()

	// 检查状态码
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("token request failed with status %d", resp.StatusCode)
	}

	// 读取响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read token response: %w", err)
	}

	token := strings.TrimSpace(string(body))
	if token == "" {
		return "", fmt.Errorf("empty token received")
	}

	// 缓存token
	t.token = &tokenInfo{
		Value:     token,
		ExpiresAt: time.Now().Add(tokenValidDuration),
	}

	return token, nil
}

// Translate 使用标准语言标签进行文本翻译
func (t *BingTranslator) Translate(text string, from language.Tag, to language.Tag) (string, error) {
	return t.translate(text, from.String(), to.String())
}

// TranslateWithParams 使用简单字符串参数进行文本翻译
func (t *BingTranslator) TranslateWithParams(text string, params TranslationParams) (string, error) {
	// 设置超时时间（如果有指定）
	if params.Timeout > 0 {
		t.SetTimeout(params.Timeout)
	}

	return t.translate(text, params.From, params.To)
}

// translate 执行实际翻译操作
func (t *BingTranslator) translate(text, from, to string) (string, error) {
	if text == "" {
		return "", fmt.Errorf("text cannot be empty")
	}

	// 创建带超时的context
	ctx, cancel := context.WithTimeout(context.Background(), t.Timeout)
	defer cancel()

	// 获取token
	token, err := t.getToken(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get token: %w", err)
	}

	// 构建请求URL
	params := url.Values{}
	if from != "auto" {
		params.Set("from", from)
	}
	params.Set("to", to)
	params.Set("api-version", "3.0")
	params.Set("includeSentenceLength", "true")

	fullURL := fmt.Sprintf("%s?%s", bingTranslateAPIURL, params.Encode())

	// 构建请求体
	requestBody := []TranslateRequest{{Text: text}}
	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	// 创建HTTP请求
	req, err := http.NewRequestWithContext(ctx, "POST", fullURL, bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	// 设置请求头
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	// 发送请求
	resp, err := t.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrBingNetworkError, err)
	}
	defer resp.Body.Close()

	// 读取响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	// 检查HTTP状态码
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP error %d: %s", resp.StatusCode, string(body))
	}

	// 首先尝试解析为错误响应
	var errorResp ErrorResponse
	if err := json.Unmarshal(body, &errorResp); err == nil && errorResp.Error.Code != 0 {
		return "", fmt.Errorf("translation error %d: %s", errorResp.Error.Code, errorResp.Error.Message)
	}

	// 解析翻译响应
	var translateResp []TranslateResponse
	if err := json.Unmarshal(body, &translateResp); err != nil {
		return "", fmt.Errorf("%w: %v", ErrBingParseError, err)
	}

	if len(translateResp) == 0 || len(translateResp[0].Translations) == 0 {
		return "", ErrBingEmptyResponse
	}

	// 合并所有翻译片段
	var result strings.Builder
	for i, translation := range translateResp[0].Translations {
		if i > 0 {
			result.WriteString(" ")
		}
		result.WriteString(translation.Text)
	}

	return result.String(), nil
}

// GetSupportedLanguages 获取翻译器支持的语言列表
func (t *BingTranslator) GetSupportedLanguages() map[string]LanguageInfo {
	return t.languages
}

// IsLanguageSupported 检查指定的语言代码是否受支持
func (t *BingTranslator) IsLanguageSupported(languageCode string) bool {
	_, exists := t.languages[languageCode]
	return exists
}
