// Package translator 提供文本翻译功能
package translator

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"golang.org/x/text/language"
)

// DeeplTranslator DeepL翻译器结构体
type DeeplTranslator struct {
	DeeplHost  string                  // DeepL服务主机
	httpClient *http.Client            // HTTP客户端
	Timeout    time.Duration           // 请求超时时间
	languages  map[string]LanguageInfo // 支持的语言列表
}

// 常量定义
const (
	deeplDefaultTimeout = 30 * time.Second
	defaultDeeplHost    = "www2.deepl.com"                 // 默认DeepL API主机
	deeplJsonRpcUrl     = "https://www2.deepl.com/jsonrpc" // DeepL JSON-RPC API
)

// 错误定义
var (
	ErrDeeplNetworkError    = errors.New("deepl translator network error")
	ErrDeeplUnsupportedLang = errors.New("deepl translator unsupported language")
	ErrDeeplResponseError   = errors.New("deepl translator response error")
)

// DeeplRequest DeepL请求结构体
type DeeplRequest struct {
	Jsonrpc string         `json:"jsonrpc"`
	Method  string         `json:"method"`
	ID      int64          `json:"id"`
	Params  DeeplReqParams `json:"params"`
}

// DeeplReqParams DeepL请求参数结构体
type DeeplReqParams struct {
	Texts     []DeeplText `json:"texts"`
	Splitting string      `json:"splitting"`
	Lang      DeeplLang   `json:"lang"`
	Timestamp int64       `json:"timestamp"`
}

// DeeplText DeepL文本结构体
type DeeplText struct {
	Text                string `json:"text"`
	RequestAlternatives int    `json:"requestAlternatives"`
}

// DeeplLang DeepL语言结构体
type DeeplLang struct {
	SourceLangUserSelected string `json:"source_lang_user_selected"`
	TargetLang             string `json:"target_lang"`
}

// DeeplResponse DeepL响应结构体
type DeeplResponse struct {
	Jsonrpc string      `json:"jsonrpc"`
	ID      int64       `json:"id"`
	Result  DeeplResult `json:"result"`
}

// DeeplResult DeepL结果结构体
type DeeplResult struct {
	Texts             []DeeplResultText  `json:"texts"`
	Lang              string             `json:"lang"`
	LangIsConfident   bool               `json:"lang_is_confident"`
	DetectedLanguages map[string]float64 `json:"detectedLanguages"`
}

// DeeplResultText DeepL结果文本结构体
type DeeplResultText struct {
	Text         string             `json:"text"`
	Alternatives []DeeplAlternative `json:"alternatives,omitempty"`
}

// DeeplAlternative DeepL替代翻译结构体
type DeeplAlternative struct {
	Text string `json:"text"`
}

// NewDeeplTranslator 创建一个新的DeepL翻译器实例
func NewDeeplTranslator() *DeeplTranslator {
	translator := &DeeplTranslator{
		DeeplHost:  defaultDeeplHost,
		Timeout:    deeplDefaultTimeout,
		httpClient: &http.Client{Timeout: deeplDefaultTimeout},
		languages:  initDeeplLanguages(),
	}

	return translator
}

// initDeeplLanguages 初始化DeepL翻译器支持的语言列表
func initDeeplLanguages() map[string]LanguageInfo {
	// 创建语言映射表
	languages := make(map[string]LanguageInfo)

	// 添加所有支持的语言
	// 基于 DeepL API 支持的语言列表
	// 参考: https://developers.deepl.com/docs/resources/supported-languages

	// 源语言和目标语言
	languages["ar"] = LanguageInfo{Code: "AR", Name: "Arabic"}
	languages["bg"] = LanguageInfo{Code: "BG", Name: "Bulgarian"}
	languages["cs"] = LanguageInfo{Code: "CS", Name: "Czech"}
	languages["da"] = LanguageInfo{Code: "DA", Name: "Danish"}
	languages["de"] = LanguageInfo{Code: "DE", Name: "German"}
	languages["el"] = LanguageInfo{Code: "EL", Name: "Greek"}
	languages["en"] = LanguageInfo{Code: "EN", Name: "English"}
	languages["en-gb"] = LanguageInfo{Code: "EN-GB", Name: "English (British)"}
	languages["en-us"] = LanguageInfo{Code: "EN-US", Name: "English (American)"}
	languages["es"] = LanguageInfo{Code: "ES", Name: "Spanish"}
	languages["et"] = LanguageInfo{Code: "ET", Name: "Estonian"}
	languages["fi"] = LanguageInfo{Code: "FI", Name: "Finnish"}
	languages["fr"] = LanguageInfo{Code: "FR", Name: "French"}
	languages["hu"] = LanguageInfo{Code: "HU", Name: "Hungarian"}
	languages["id"] = LanguageInfo{Code: "ID", Name: "Indonesian"}
	languages["it"] = LanguageInfo{Code: "IT", Name: "Italian"}
	languages["ja"] = LanguageInfo{Code: "JA", Name: "Japanese"}
	languages["ko"] = LanguageInfo{Code: "KO", Name: "Korean"}
	languages["lt"] = LanguageInfo{Code: "LT", Name: "Lithuanian"}
	languages["lv"] = LanguageInfo{Code: "LV", Name: "Latvian"}
	languages["nb"] = LanguageInfo{Code: "NB", Name: "Norwegian Bokmål"}
	languages["nl"] = LanguageInfo{Code: "NL", Name: "Dutch"}
	languages["pl"] = LanguageInfo{Code: "PL", Name: "Polish"}
	languages["pt"] = LanguageInfo{Code: "PT", Name: "Portuguese"}
	languages["pt-br"] = LanguageInfo{Code: "PT-BR", Name: "Portuguese (Brazilian)"}
	languages["pt-pt"] = LanguageInfo{Code: "PT-PT", Name: "Portuguese (Portugal)"}
	languages["ro"] = LanguageInfo{Code: "RO", Name: "Romanian"}
	languages["ru"] = LanguageInfo{Code: "RU", Name: "Russian"}
	languages["sk"] = LanguageInfo{Code: "SK", Name: "Slovak"}
	languages["sl"] = LanguageInfo{Code: "SL", Name: "Slovenian"}
	languages["sv"] = LanguageInfo{Code: "SV", Name: "Swedish"}
	languages["tr"] = LanguageInfo{Code: "TR", Name: "Turkish"}
	languages["uk"] = LanguageInfo{Code: "UK", Name: "Ukrainian"}
	languages["zh"] = LanguageInfo{Code: "ZH", Name: "Chinese"}

	return languages
}

// SetTimeout 设置请求超时时间
func (t *DeeplTranslator) SetTimeout(timeout time.Duration) {
	t.Timeout = timeout
	t.httpClient.Timeout = timeout
}

// SetDeeplHost 设置DeepL主机
func (t *DeeplTranslator) SetDeeplHost(host string) {
	t.DeeplHost = host
}

// Translate 使用标准语言标签进行文本翻译
func (t *DeeplTranslator) Translate(text string, from language.Tag, to language.Tag) (string, error) {
	return t.translate(text, from.String(), to.String())
}

// TranslateWithParams 使用简单字符串参数进行文本翻译
func (t *DeeplTranslator) TranslateWithParams(text string, params TranslationParams) (string, error) {
	// 设置超时时间（如果有指定）
	if params.Timeout > 0 {
		t.SetTimeout(params.Timeout)
	}

	// 直接执行一次翻译
	return t.translate(text, params.From, params.To)
}

// translate 执行实际翻译操作
func (t *DeeplTranslator) translate(text, from, to string) (string, error) {
	// 转换语言代码为DeepL格式
	fromLower := strings.ToLower(from)
	toLower := strings.ToLower(to)

	var sourceLang string
	if fromLower == "auto" {
		sourceLang = "auto"
	} else if fromLangInfo, ok := t.languages[fromLower]; ok {
		sourceLang = fromLangInfo.Code
	} else {
		sourceLang = "auto"
	}

	var targetLang string
	if toLangInfo, ok := t.languages[toLower]; ok {
		targetLang = toLangInfo.Code
	} else {
		return "", fmt.Errorf("%w: language '%s' not supported by DeepL", ErrDeeplUnsupportedLang, to)
	}

	// 准备请求数据
	id := getRandomNumber()
	iCount := getICount(text)
	timestamp := getTimeStamp(iCount)

	// 构建请求体
	reqParams := DeeplReqParams{
		Texts: []DeeplText{
			{
				Text:                text,
				RequestAlternatives: 3,
			},
		},
		Splitting: "newlines",
		Lang: DeeplLang{
			SourceLangUserSelected: sourceLang,
			TargetLang:             targetLang,
		},
		Timestamp: timestamp,
	}

	request := DeeplRequest{
		Jsonrpc: "2.0",
		Method:  "LMT_handle_texts",
		ID:      id,
		Params:  reqParams,
	}

	// 序列化请求
	jsonData, err := json.Marshal(request)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	// 特殊处理method字段格式
	postStr := string(jsonData)
	if (id+5)%29 == 0 || (id+3)%13 == 0 {
		postStr = strings.Replace(postStr, `"method":"`, `"method" : "`, 1)
	} else {
		postStr = strings.Replace(postStr, `"method":"`, `"method": "`, 1)
	}

	// 发送请求
	req, err := http.NewRequest("POST", deeplJsonRpcUrl, bytes.NewBuffer([]byte(postStr)))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	// 设置请求头
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "*/*")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36")
	req.Header.Set("Connection", "keep-alive")
	req.Header.Set("Origin", "https://www.deepl.com")
	req.Header.Set("Referer", "https://www.deepl.com/translator")

	// 执行请求
	resp, err := t.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrDeeplNetworkError, err)
	}
	defer resp.Body.Close()

	// 检查响应状态
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("API error: status code %d", resp.StatusCode)
	}

	// 读取响应内容
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	// 解析响应
	var response DeeplResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return "", fmt.Errorf("%w: %v", ErrDeeplResponseError, err)
	}

	// 检查结果
	if len(response.Result.Texts) == 0 {
		return "", fmt.Errorf("%w: empty translation result", ErrDeeplResponseError)
	}

	// 返回翻译结果
	return response.Result.Texts[0].Text, nil
}

// getICount 获取文本中'i'字符的数量
func getICount(text string) int {
	return strings.Count(text, "i")
}

// getRandomNumber 生成随机数
func getRandomNumber() int64 {
	return int64(rand.Intn(99999)+100000) * 1000
}

// getTimeStamp 获取时间戳
func getTimeStamp(iCount int) int64 {
	ts := time.Now().UnixMilli()
	if iCount != 0 {
		iCount++
		return ts - (ts % int64(iCount)) + int64(iCount)
	}
	return ts
}

// GetSupportedLanguages 获取翻译器支持的语言列表
func (t *DeeplTranslator) GetSupportedLanguages() map[string]LanguageInfo {
	return t.languages
}

// IsLanguageSupported 检查指定的语言代码是否受支持
func (t *DeeplTranslator) IsLanguageSupported(languageCode string) bool {
	_, ok := t.languages[strings.ToLower(languageCode)]
	return ok
}

// GetStandardLanguageCode 获取标准化的语言代码
func (t *DeeplTranslator) GetStandardLanguageCode(languageCode string) string {
	// 简单返回小写版本作为标准代码
	return strings.ToLower(languageCode)
}
