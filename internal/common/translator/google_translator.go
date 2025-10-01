// Package translator 提供文本翻译功能
package translator

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"golang.org/x/text/language"
)

// 错误定义
var (
	ErrBadNetwork = errors.New("bad network, please check your internet connection")
)

// 常量定义
const (
	googleTranslateTKK = "448487.932609646" // 固定TKK值
)

// GoogleTranslator 带token的Google翻译器（使用translate.google.com）
type GoogleTranslator struct {
	httpClient *http.Client            // HTTP客户端
	Timeout    time.Duration           // 请求超时时间
	languages  map[string]LanguageInfo // 支持的语言列表
}

// GoogleTranslatorTokenFree 无token的Google翻译器（使用translate.googleapis.com）
type GoogleTranslatorTokenFree struct {
	httpClient *http.Client            // HTTP客户端
	Timeout    time.Duration           // 请求超时时间
	languages  map[string]LanguageInfo // 支持的语言列表
}

// NewGoogleTranslator 创建一个新的带token的Google翻译器实例
func NewGoogleTranslator() *GoogleTranslator {
	return &GoogleTranslator{
		httpClient: &http.Client{Timeout: defaultTimeout},
		Timeout:    defaultTimeout,
		languages:  initGoogleLanguages(),
	}
}

// initGoogleLanguages 初始化Google翻译器支持的语言列表
func initGoogleLanguages() map[string]LanguageInfo {
	languages := make(map[string]LanguageInfo)

	// 只支持三种语言
	languages["en"] = LanguageInfo{Code: "en", Name: "English"}
	languages["zh-cn"] = LanguageInfo{Code: "zh-CN", Name: "Chinese (Simplified)"}
	languages["zh-tw"] = LanguageInfo{Code: "zh-TW", Name: "Chinese (Traditional)"}

	return languages
}

// generateToken 生成翻译token
func generateToken(query string) string {
	// 实现TypeScript中的token生成逻辑
	tkkSplited := strings.Split(googleTranslateTKK, ".")
	tkkIndex, _ := strconv.Atoi(tkkSplited[0])
	tkkKey, _ := strconv.Atoi(tkkSplited[1])

	// 转换查询字符串为字节数组
	bytesArray := transformQuery(query)

	// 计算hash
	encodingRound := tkkIndex
	for _, b := range bytesArray {
		encodingRound += int(b)
		encodingRound = shiftLeftOrRightThenSumOrXor(encodingRound, "+-a^+6")
	}
	encodingRound = shiftLeftOrRightThenSumOrXor(encodingRound, "+-3^+b+-f")

	encodingRound ^= tkkKey
	if encodingRound <= 0 {
		encodingRound = (encodingRound & 2147483647) + 2147483648
	}

	normalizedResult := encodingRound % 1000000
	return fmt.Sprintf("%d.%d", normalizedResult, normalizedResult^tkkIndex)
}

// transformQuery 转换查询字符串
func transformQuery(query string) []byte {
	var bytesArray []byte
	runes := []rune(query)

	for i := 0; i < len(runes); i++ {
		charCode := int(runes[i])

		if charCode < 128 {
			bytesArray = append(bytesArray, byte(charCode))
		} else if charCode < 2048 {
			bytesArray = append(bytesArray, byte((charCode>>6)|192))
			bytesArray = append(bytesArray, byte((charCode&63)|128))
		} else {
			if (charCode&64512) == 55296 && i+1 < len(runes) && (int(runes[i+1])&64512) == 56320 {
				charCode = 65536 + ((charCode & 1023) << 10) + (int(runes[i+1]) & 1023)
				i++
				bytesArray = append(bytesArray, byte((charCode>>18)|240))
				bytesArray = append(bytesArray, byte(((charCode>>12)&63)|128))
			} else {
				bytesArray = append(bytesArray, byte((charCode>>12)|224))
			}
			bytesArray = append(bytesArray, byte(((charCode>>6)&63)|128))
			bytesArray = append(bytesArray, byte((charCode&63)|128))
		}
	}

	return bytesArray
}

// shiftLeftOrRightThenSumOrXor 位运算操作
func shiftLeftOrRightThenSumOrXor(num int, optString string) int {
	for i := 0; i < len(optString)-2; i += 3 {
		acc := int(optString[i+2])
		if acc >= 'a' {
			acc = acc - 87
		} else {
			acc = acc - '0'
		}

		if optString[i+1] == '+' {
			acc = num >> uint(acc)
		} else {
			acc = num << uint(acc)
		}

		if optString[i] == '+' {
			num = (num + acc) & 4294967295
		} else {
			num ^= acc
		}
	}
	return num
}

// SetTimeout 设置请求超时时间
func (t *GoogleTranslator) SetTimeout(timeout time.Duration) {
	t.Timeout = timeout
	t.httpClient.Timeout = timeout
}

// Translate 使用Go语言提供的标准语言标签进行文本翻译
func (t *GoogleTranslator) Translate(text string, from language.Tag, to language.Tag) (string, error) {
	return t.translate(text, from.String(), to.String())
}

// TranslateWithParams 使用简单字符串参数进行文本翻译
func (t *GoogleTranslator) TranslateWithParams(text string, params TranslationParams) (string, error) {
	if params.Timeout > 0 {
		t.SetTimeout(params.Timeout)
	}
	return t.translate(text, params.From, params.To)
}

// translate 执行实际翻译操作（带token版本）
func (t *GoogleTranslator) translate(text, from, to string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), t.Timeout)
	defer cancel()

	// 生成token
	token := generateToken(text)

	// 构建请求URL
	apiURL := "https://translate.google.com/translate_a/single"
	params := url.Values{}
	params.Set("client", "t")
	params.Set("sl", from)
	params.Set("tl", to)
	params.Set("hl", to)
	params.Set("ie", "UTF-8")
	params.Set("oe", "UTF-8")
	params.Set("otf", "1")
	params.Set("ssel", "0")
	params.Set("tsel", "0")
	params.Set("kc", "7")
	params.Set("q", text)
	params.Set("tk", token)

	// 添加dt参数
	dtParams := []string{"at", "bd", "ex", "ld", "md", "qca", "rw", "rm", "ss", "t"}
	for _, dt := range dtParams {
		params.Add("dt", dt)
	}

	fullURL := apiURL + "?" + params.Encode()

	// 创建请求
	req, err := http.NewRequestWithContext(ctx, "GET", fullURL, nil)
	if err != nil {
		return "", err
	}

	// 发送请求
	resp, err := t.httpClient.Do(req)
	if err != nil {
		return "", ErrBadNetwork
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("API error: status code %d", resp.StatusCode)
	}

	// 读取响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	// 解析JSON响应
	var result []interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", err
	}

	if len(result) == 0 {
		return "", errors.New("unexpected response format")
	}

	// 提取翻译文本
	translations, ok := result[0].([]interface{})
	if !ok {
		return "", errors.New("unexpected response format")
	}

	var translatedText strings.Builder
	for _, translation := range translations {
		if chunk, ok := translation.([]interface{}); ok && len(chunk) > 0 {
			if text, ok := chunk[0].(string); ok {
				translatedText.WriteString(text)
			}
		}
	}

	return translatedText.String(), nil
}

// GetSupportedLanguages 获取翻译器支持的语言列表
func (t *GoogleTranslator) GetSupportedLanguages() map[string]LanguageInfo {
	return t.languages
}

// IsLanguageSupported 检查指定的语言代码是否受支持
func (t *GoogleTranslator) IsLanguageSupported(languageCode string) bool {
	_, ok := t.languages[strings.ToLower(languageCode)]
	return ok
}

// visitArrayItems 递归访问数组项
func visitArrayItems(arr []interface{}, visitor func(interface{})) {
	for _, obj := range arr {
		if subArr, ok := obj.([]interface{}); ok {
			visitArrayItems(subArr, visitor)
		} else {
			visitor(obj)
		}
	}
}

// GetSupportedLanguages 获取翻译器支持的语言列表
func (t *GoogleTranslatorTokenFree) GetSupportedLanguages() map[string]LanguageInfo {
	return t.languages
}

// IsLanguageSupported 检查指定的语言代码是否受支持
func (t *GoogleTranslatorTokenFree) IsLanguageSupported(languageCode string) bool {
	_, ok := t.languages[strings.ToLower(languageCode)]
	return ok
}
