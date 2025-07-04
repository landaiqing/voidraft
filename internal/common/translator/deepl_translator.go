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
	DeeplHost  string        // DeepL服务主机
	httpClient *http.Client  // HTTP客户端
	Timeout    time.Duration // 请求超时时间
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

// 语言映射
var deeplLangMap = map[string]string{
	"auto": "auto",
	"de":   "DE",
	"en":   "EN",
	"es":   "ES",
	"fr":   "FR",
	"it":   "IT",
	"ja":   "JA",
	"ko":   "KO",
	"nl":   "NL",
	"pl":   "PL",
	"pt":   "PT",
	"ru":   "RU",
	"zh":   "ZH",
	"bg":   "BG",
	"cs":   "CS",
	"da":   "DA",
	"el":   "EL",
	"et":   "ET",
	"fi":   "FI",
	"hu":   "HU",
	"lt":   "LT",
	"lv":   "LV",
	"ro":   "RO",
	"sk":   "SK",
	"sl":   "SL",
	"sv":   "SV",
}

// 反向语言映射
var deeplLangMapReverse = map[string]string{
	"auto": "auto",
	"DE":   "de",
	"EN":   "en",
	"ES":   "es",
	"FR":   "fr",
	"IT":   "it",
	"JA":   "ja",
	"KO":   "ko",
	"NL":   "nl",
	"PL":   "pl",
	"PT":   "pt",
	"RU":   "ru",
	"ZH":   "zh",
	"BG":   "bg",
	"CS":   "cs",
	"DA":   "da",
	"EL":   "el",
	"ET":   "et",
	"FI":   "fi",
	"HU":   "hu",
	"LT":   "lt",
	"LV":   "lv",
	"RO":   "ro",
	"SK":   "sk",
	"SL":   "sl",
	"SV":   "sv",
}

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
	}

	return translator
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
	tries := params.Tries
	if tries == 0 {
		tries = defaultNumberOfRetries
	}

	var result string
	var lastError error

	for i := 0; i < tries; i++ {
		if i > 0 && params.Delay > 0 {
			time.Sleep(params.Delay)
		}

		result, lastError = t.translate(text, params.From, params.To)
		if lastError == nil {
			return result, nil
		}
	}

	return "", lastError
}

// translate 执行实际翻译操作
func (t *DeeplTranslator) translate(text, from, to string) (string, error) {
	// 转换语言代码为DeepL格式
	sourceLang, ok := deeplLangMap[strings.ToLower(from)]
	if !ok && from != "auto" {
		sourceLang = "auto"
	}

	targetLang, ok := deeplLangMap[strings.ToLower(to)]
	if !ok {
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

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36")

	resp, err := t.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrDeeplNetworkError, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("%w: status code %d", ErrDeeplNetworkError, resp.StatusCode)
	}

	// 读取响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	// 解析响应
	var deeplResp DeeplResponse
	err = json.Unmarshal(body, &deeplResp)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrDeeplResponseError, err)
	}

	// 检查是否有有效的结果
	if len(deeplResp.Result.Texts) == 0 {
		return "", fmt.Errorf("%w: no translation result", ErrDeeplResponseError)
	}

	// 返回翻译结果
	return deeplResp.Result.Texts[0].Text, nil
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
