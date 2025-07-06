// Package translator 提供文本翻译功能
package translator

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"regexp"
	"strings"
	"time"

	"golang.org/x/text/language"
)

// BingTranslator Bing翻译器结构体
type BingTranslator struct {
	httpClient *http.Client            // HTTP客户端
	Timeout    time.Duration           // 请求超时时间
	session    *BingSession            // Bing会话
	languages  map[string]LanguageInfo // 支持的语言列表
}

// BingSession 保持Bing翻译会话状态
type BingSession struct {
	Cookie  map[string]string // 会话Cookie
	Headers map[string]string // 会话请求头
	Token   string            // 翻译Token
	Key     string            // 翻译Key
	IG      string            // IG参数
}

// 常量定义
const (
	bingDefaultTimeout  = 30 * time.Second
	bingTranslatorURL   = "https://cn.bing.com/translator"
	bingTranslateAPIURL = "https://cn.bing.com/ttranslatev3"
)

// 错误定义
var (
	ErrBingNetworkError  = errors.New("bing translator network error")
	ErrBingParseError    = errors.New("bing translator parse error")
	ErrBingTokenError    = errors.New("failed to get bing translator token")
	ErrBingEmptyResponse = errors.New("empty response from bing translator")
	ErrBingRateLimit     = errors.New("bing translator rate limit reached")
)

// 用户代理列表
var userAgents = []string{
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
}

// NewBingTranslator 创建一个新的Bing翻译器实例
func NewBingTranslator() *BingTranslator {
	// 初始化随机数种子
	rand.New(rand.NewSource(time.Now().UnixNano()))

	// 创建带Cookie存储的HTTP客户端
	jar, _ := cookiejar.New(nil)

	translator := &BingTranslator{
		httpClient: &http.Client{
			Timeout: bingDefaultTimeout,
			// 启用Cookie存储
			Jar: jar,
		},
		Timeout: bingDefaultTimeout,
		session: &BingSession{
			Headers: make(map[string]string),
			Cookie:  make(map[string]string),
		},
		languages: initBingLanguages(),
	}

	// 初始化会话
	translator.refreshSession()

	return translator
}

// initBingLanguages 初始化Bing翻译器支持的语言列表
func initBingLanguages() map[string]LanguageInfo {
	// 创建语言映射表
	languages := make(map[string]LanguageInfo)

	// 添加所有支持的语言
	// 基于 Microsoft Translator 支持的语言列表
	// 参考: https://learn.microsoft.com/en-us/azure/ai-services/translator/language-support

	// 常用语言
	languages["en"] = LanguageInfo{Code: "en", Name: "English"}
	languages["zh-Hans"] = LanguageInfo{Code: "zh-Hans", Name: "Chinese Simplified"}
	languages["zh-Hant"] = LanguageInfo{Code: "zh-Hant", Name: "Chinese Traditional"}
	languages["ja"] = LanguageInfo{Code: "ja", Name: "Japanese"}
	languages["ko"] = LanguageInfo{Code: "ko", Name: "Korean"}
	languages["fr"] = LanguageInfo{Code: "fr", Name: "French"}
	languages["fr-ca"] = LanguageInfo{Code: "fr-ca", Name: "French (Canada)"}
	languages["de"] = LanguageInfo{Code: "de", Name: "German"}
	languages["es"] = LanguageInfo{Code: "es", Name: "Spanish"}
	languages["ru"] = LanguageInfo{Code: "ru", Name: "Russian"}
	languages["pt"] = LanguageInfo{Code: "pt", Name: "Portuguese (Brazil)"}
	languages["pt-br"] = LanguageInfo{Code: "pt-br", Name: "Portuguese (Brazil)"}
	languages["pt-pt"] = LanguageInfo{Code: "pt-pt", Name: "Portuguese (Portugal)"}
	languages["it"] = LanguageInfo{Code: "it", Name: "Italian"}
	languages["ar"] = LanguageInfo{Code: "ar", Name: "Arabic"}

	// 特殊语言
	languages["yue"] = LanguageInfo{Code: "yue", Name: "Cantonese (Traditional)"}
	languages["lzh"] = LanguageInfo{Code: "lzh", Name: "Chinese (Literary)"}

	// 其他语言
	languages["af"] = LanguageInfo{Code: "af", Name: "Afrikaans"}
	languages["am"] = LanguageInfo{Code: "am", Name: "Amharic"}
	languages["as"] = LanguageInfo{Code: "as", Name: "Assamese"}
	languages["az"] = LanguageInfo{Code: "az", Name: "Azerbaijani (Latin)"}
	languages["ba"] = LanguageInfo{Code: "ba", Name: "Bashkir"}
	languages["bg"] = LanguageInfo{Code: "bg", Name: "Bulgarian"}
	languages["bn"] = LanguageInfo{Code: "bn", Name: "Bangla"}
	languages["bo"] = LanguageInfo{Code: "bo", Name: "Tibetan"}
	languages["bs"] = LanguageInfo{Code: "bs", Name: "Bosnian (Latin)"}
	languages["ca"] = LanguageInfo{Code: "ca", Name: "Catalan"}
	languages["cs"] = LanguageInfo{Code: "cs", Name: "Czech"}
	languages["cy"] = LanguageInfo{Code: "cy", Name: "Welsh"}
	languages["da"] = LanguageInfo{Code: "da", Name: "Danish"}
	languages["dv"] = LanguageInfo{Code: "dv", Name: "Divehi"}
	languages["el"] = LanguageInfo{Code: "el", Name: "Greek"}
	languages["et"] = LanguageInfo{Code: "et", Name: "Estonian"}
	languages["eu"] = LanguageInfo{Code: "eu", Name: "Basque"}
	languages["fa"] = LanguageInfo{Code: "fa", Name: "Persian"}
	languages["fi"] = LanguageInfo{Code: "fi", Name: "Finnish"}
	languages["fil"] = LanguageInfo{Code: "fil", Name: "Filipino"}
	languages["fj"] = LanguageInfo{Code: "fj", Name: "Fijian"}
	languages["fo"] = LanguageInfo{Code: "fo", Name: "Faroese"}
	languages["ga"] = LanguageInfo{Code: "ga", Name: "Irish"}
	languages["gl"] = LanguageInfo{Code: "gl", Name: "Galician"}
	languages["gu"] = LanguageInfo{Code: "gu", Name: "Gujarati"}
	languages["ha"] = LanguageInfo{Code: "ha", Name: "Hausa"}
	languages["he"] = LanguageInfo{Code: "he", Name: "Hebrew"}
	languages["hi"] = LanguageInfo{Code: "hi", Name: "Hindi"}
	languages["hr"] = LanguageInfo{Code: "hr", Name: "Croatian"}
	languages["ht"] = LanguageInfo{Code: "ht", Name: "Haitian Creole"}
	languages["hu"] = LanguageInfo{Code: "hu", Name: "Hungarian"}
	languages["hy"] = LanguageInfo{Code: "hy", Name: "Armenian"}
	languages["id"] = LanguageInfo{Code: "id", Name: "Indonesian"}
	languages["ig"] = LanguageInfo{Code: "ig", Name: "Igbo"}
	languages["is"] = LanguageInfo{Code: "is", Name: "Icelandic"}
	languages["ka"] = LanguageInfo{Code: "ka", Name: "Georgian"}
	languages["kk"] = LanguageInfo{Code: "kk", Name: "Kazakh"}
	languages["km"] = LanguageInfo{Code: "km", Name: "Khmer"}
	languages["kn"] = LanguageInfo{Code: "kn", Name: "Kannada"}
	languages["ku"] = LanguageInfo{Code: "ku", Name: "Kurdish (Arabic) (Central)"}
	languages["ky"] = LanguageInfo{Code: "ky", Name: "Kyrgyz (Cyrillic)"}
	languages["lo"] = LanguageInfo{Code: "lo", Name: "Lao"}
	languages["lt"] = LanguageInfo{Code: "lt", Name: "Lithuanian"}
	languages["lv"] = LanguageInfo{Code: "lv", Name: "Latvian"}
	languages["mg"] = LanguageInfo{Code: "mg", Name: "Malagasy"}
	languages["mi"] = LanguageInfo{Code: "mi", Name: "Maori"}
	languages["mk"] = LanguageInfo{Code: "mk", Name: "Macedonian"}
	languages["ml"] = LanguageInfo{Code: "ml", Name: "Malayalam"}
	languages["mn-Cyrl"] = LanguageInfo{Code: "mn-Cyrl", Name: "Mongolian (Cyrillic)"}
	languages["mr"] = LanguageInfo{Code: "mr", Name: "Marathi"}
	languages["ms"] = LanguageInfo{Code: "ms", Name: "Malay (Latin)"}
	languages["mt"] = LanguageInfo{Code: "mt", Name: "Maltese"}
	languages["mww"] = LanguageInfo{Code: "mww", Name: "Hmong Daw (Latin)"}
	languages["my"] = LanguageInfo{Code: "my", Name: "Myanmar (Burmese)"}
	languages["nb"] = LanguageInfo{Code: "nb", Name: "Norwegian Bokmål"}
	languages["ne"] = LanguageInfo{Code: "ne", Name: "Nepali"}
	languages["nl"] = LanguageInfo{Code: "nl", Name: "Dutch"}
	languages["or"] = LanguageInfo{Code: "or", Name: "Odia"}
	languages["otq"] = LanguageInfo{Code: "otq", Name: "Queretaro Otomi"}
	languages["pa"] = LanguageInfo{Code: "pa", Name: "Punjabi"}
	languages["pl"] = LanguageInfo{Code: "pl", Name: "Polish"}
	languages["prs"] = LanguageInfo{Code: "prs", Name: "Dari"}
	languages["ps"] = LanguageInfo{Code: "ps", Name: "Pashto"}
	languages["ro"] = LanguageInfo{Code: "ro", Name: "Romanian"}
	languages["rw"] = LanguageInfo{Code: "rw", Name: "Kinyarwanda"}
	languages["sk"] = LanguageInfo{Code: "sk", Name: "Slovak"}
	languages["sl"] = LanguageInfo{Code: "sl", Name: "Slovenian"}
	languages["sm"] = LanguageInfo{Code: "sm", Name: "Samoan (Latin)"}
	languages["sn"] = LanguageInfo{Code: "sn", Name: "chiShona"}
	languages["so"] = LanguageInfo{Code: "so", Name: "Somali"}
	languages["sq"] = LanguageInfo{Code: "sq", Name: "Albanian"}
	languages["sr-Cyrl"] = LanguageInfo{Code: "sr-Cyrl", Name: "Serbian (Cyrillic)"}
	languages["sr"] = LanguageInfo{Code: "sr", Name: "Serbian (Latin)"}
	languages["sr-latn"] = LanguageInfo{Code: "sr-latn", Name: "Serbian (Latin)"}
	languages["sv"] = LanguageInfo{Code: "sv", Name: "Swedish"}
	languages["sw"] = LanguageInfo{Code: "sw", Name: "Swahili (Latin)"}
	languages["ta"] = LanguageInfo{Code: "ta", Name: "Tamil"}
	languages["te"] = LanguageInfo{Code: "te", Name: "Telugu"}
	languages["th"] = LanguageInfo{Code: "th", Name: "Thai"}
	languages["ti"] = LanguageInfo{Code: "ti", Name: "Tigrinya"}
	languages["tk"] = LanguageInfo{Code: "tk", Name: "Turkmen (Latin)"}
	languages["tlh-Latn"] = LanguageInfo{Code: "tlh-Latn", Name: "Klingon"}
	languages["tlh-Piqd"] = LanguageInfo{Code: "tlh-Piqd", Name: "Klingon (plqaD)"}
	languages["to"] = LanguageInfo{Code: "to", Name: "Tongan"}
	languages["tr"] = LanguageInfo{Code: "tr", Name: "Turkish"}
	languages["tt"] = LanguageInfo{Code: "tt", Name: "Tatar (Latin)"}
	languages["ty"] = LanguageInfo{Code: "ty", Name: "Tahitian"}
	languages["ug"] = LanguageInfo{Code: "ug", Name: "Uyghur (Arabic)"}
	languages["uk"] = LanguageInfo{Code: "uk", Name: "Ukrainian"}
	languages["ur"] = LanguageInfo{Code: "ur", Name: "Urdu"}
	languages["uz"] = LanguageInfo{Code: "uz", Name: "Uzbek (Latin)"}
	languages["vi"] = LanguageInfo{Code: "vi", Name: "Vietnamese"}
	languages["yua"] = LanguageInfo{Code: "yua", Name: "Yucatec Maya"}
	languages["zu"] = LanguageInfo{Code: "zu", Name: "Zulu"}

	// 添加一些特殊情况的映射
	languages["zh"] = LanguageInfo{Code: "zh-Hans", Name: "Chinese Simplified"} // 将zh映射到zh-Hans

	return languages
}

// SetTimeout 设置请求超时时间
func (t *BingTranslator) SetTimeout(timeout time.Duration) {
	t.Timeout = timeout
	t.httpClient.Timeout = timeout
}

// getRandomUserAgent 获取随机用户代理
func getRandomUserAgent() string {
	return userAgents[rand.Intn(len(userAgents))]
}

// refreshSession 刷新翻译会话
func (t *BingTranslator) refreshSession() error {
	// 设置随机用户代理
	userAgent := getRandomUserAgent()
	t.session.Headers["User-Agent"] = userAgent
	t.session.Headers["Referer"] = bingTranslatorURL
	t.session.Headers["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
	t.session.Headers["Accept-Language"] = "en-US,en;q=0.5"
	t.session.Headers["Connection"] = "keep-alive"
	t.session.Headers["Upgrade-Insecure-Requests"] = "1"
	t.session.Headers["Cache-Control"] = "max-age=0"

	// 创建请求
	req, err := http.NewRequest("GET", bingTranslatorURL, nil)
	if err != nil {
		return fmt.Errorf("the creation request failed: %w", err)
	}

	// 设置请求头
	for k, v := range t.session.Headers {
		req.Header.Set(k, v)
	}

	// 发送请求
	resp, err := t.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrBingNetworkError, err)
	}
	defer resp.Body.Close()

	// 保存Cookie
	for _, cookie := range resp.Cookies() {
		t.session.Cookie[cookie.Name] = cookie.Value
	}

	// 读取响应内容
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response failed: %w", err)
	}

	content := string(body)

	// 提取参数
	// 1. 提取key和token
	paramsPattern := regexp.MustCompile(`params_AbusePreventionHelper\s*=\s*(\[.*?\]);`)
	paramsMatch := paramsPattern.FindStringSubmatch(content)
	if paramsMatch == nil || len(paramsMatch) < 2 {
		return fmt.Errorf("%w: params_AbusePreventionHelper could not be extracted", ErrBingTokenError)
	}

	// 解析参数数组
	paramsStr := paramsMatch[1]
	paramsStr = strings.ReplaceAll(paramsStr, "[", "")
	paramsStr = strings.ReplaceAll(paramsStr, "]", "")
	paramsParts := strings.Split(paramsStr, ",")

	if len(paramsParts) < 2 {
		return fmt.Errorf("%w: params_AbusePreventionHelper format is incorrect", ErrBingTokenError)
	}

	// 提取key和token
	t.session.Key = strings.Trim(paramsParts[0], `"' `)
	t.session.Token = strings.Trim(paramsParts[1], `"' `)

	// 2. 提取IG值
	igPattern := regexp.MustCompile(`IG:"(\w+)"`)
	igMatch := igPattern.FindStringSubmatch(content)
	if igMatch == nil || len(igMatch) < 2 {
		return fmt.Errorf("%w: Unable to extract IG values", ErrBingTokenError)
	}

	t.session.IG = igMatch[1]

	// 更新会话头部
	t.session.Headers["IG"] = t.session.IG
	t.session.Headers["key"] = t.session.Key
	t.session.Headers["token"] = t.session.Token

	return nil
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
	// 如果没有会话或关键参数缺失，刷新会话
	if t.session == nil || t.session.Token == "" || t.session.Key == "" || t.session.IG == "" {
		if err := t.refreshSession(); err != nil {
			return "", fmt.Errorf("the refresh session failed: %w", err)
		}
	}

	// 生成随机IID
	randNum := rand.Intn(10)                              // 0-9的随机数
	iid := fmt.Sprintf("translator.5019.%d", 1+randNum%3) // 生成随机IID

	// 构建URL - 确保使用双&符号
	reqURL := fmt.Sprintf("%s?isVertical=1&&IG=%s&IID=%s",
		bingTranslateAPIURL, t.session.IG, iid)

	// 标准化语言代码
	fromLang := t.GetStandardLanguageCode(from)
	toLang := t.GetStandardLanguageCode(to)

	// 构建表单数据
	formData := url.Values{}
	formData.Set("fromLang", fromLang)
	formData.Set("text", text)
	formData.Set("to", toLang)
	formData.Set("token", t.session.Token)
	formData.Set("key", t.session.Key)

	formDataStr := formData.Encode()

	// 创建请求
	req, err := http.NewRequest("POST", reqURL, strings.NewReader(formDataStr))
	if err != nil {
		return "", fmt.Errorf("The creation request failed: %w", err)
	}

	// 设置请求头
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", t.session.Headers["User-Agent"])
	req.Header.Set("Referer", bingTranslatorURL)
	req.Header.Set("Accept", "*/*")
	req.Header.Set("Accept-Language", "en-US,en;q=0.5")
	req.Header.Set("Origin", "https://cn.bing.com")
	req.Header.Set("Connection", "keep-alive")
	req.Header.Set("X-Requested-With", "XMLHttpRequest")

	// 添加Cookie
	for name, value := range t.session.Cookie {
		req.AddCookie(&http.Cookie{
			Name:  name,
			Value: value,
		})
	}

	// 发送请求
	resp, err := t.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrBingNetworkError, err)
	}

	// 读取响应
	body, err := io.ReadAll(resp.Body)
	resp.Body.Close()

	if err != nil {
		return "", fmt.Errorf("read response failed: %w", err)
	}

	if len(body) == 0 {
		return "", ErrBingEmptyResponse
	}

	// 尝试解析响应
	var result interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("%w: %v", ErrBingParseError, err)
	}

	// 检查是否是字典类型
	if resultDict, ok := result.(map[string]interface{}); ok {
		// 检查是否需要验证码
		if _, hasCaptcha := resultDict["ShowCaptcha"]; hasCaptcha {
			return "", ErrBingRateLimit
		}

		// 检查状态码
		if statusCode, hasStatus := resultDict["statusCode"]; hasStatus {
			if statusCode.(float64) == 400 {
				// 检查是否有错误消息
				if errorMsg, hasError := resultDict["errorMessage"]; hasError && errorMsg.(string) != "" {
					return "", fmt.Errorf("translation failed: %s", errorMsg)
				}
				// 如果没有明确的错误消息，可能是API变更或其他问题
				return "", fmt.Errorf("translation request failed (status code: 400)")
			} else if statusCode.(float64) == 429 {
				return "", ErrBingRateLimit
			}
		}

		// 尝试从错误响应中提取详细信息
		if message, hasMessage := resultDict["message"]; hasMessage {
			return "", fmt.Errorf("translation failed: %v", message)
		}

		// 尝试从响应中获取翻译结果
		if translations, hasTranslations := resultDict["translations"]; hasTranslations {
			if translationsArray, ok := translations.([]interface{}); ok && len(translationsArray) > 0 {
				if translation, ok := translationsArray[0].(map[string]interface{}); ok {
					if text, ok := translation["text"].(string); ok {
						return text, nil
					}
				}
			}
		}

		// 其他错误
		return "", fmt.Errorf("translation failed: %v", resultDict)
	}

	// 应该是数组类型
	if resultArray, ok := result.([]interface{}); ok && len(resultArray) > 0 {
		firstItem := resultArray[0]
		if itemDict, ok := firstItem.(map[string]interface{}); ok {
			if translations, ok := itemDict["translations"].([]interface{}); ok && len(translations) > 0 {
				if translation, ok := translations[0].(map[string]interface{}); ok {
					if text, ok := translation["text"].(string); ok {
						return text, nil
					}
				}
			}
		}
	}

	return "", fmt.Errorf("%w: The response format is not as expected", ErrBingParseError)
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

// GetStandardLanguageCode 获取标准化的语言代码
func (t *BingTranslator) GetStandardLanguageCode(languageCode string) string {
	if info, exists := t.languages[languageCode]; exists {
		return info.Code
	}
	return languageCode // 如果没有找到映射，返回原始代码
}
