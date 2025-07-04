// Package translator 提供文本翻译功能
package translator

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"golang.org/x/text/language"
)

// BingTranslator Bing翻译器结构体
type BingTranslator struct {
	BingHost   string        // Bing服务主机
	httpClient *http.Client  // HTTP客户端
	Timeout    time.Duration // 请求超时时间
}

// 常量定义
const (
	bingDefaultTimeout = 30 * time.Second
	defaultBingHost    = "cn.bing.com" // 使用cn.bing.com作为默认域名
)

// 错误定义
var (
	ErrBingNetworkError = errors.New("bing translator network error")
	ErrBingParseError   = errors.New("bing translator parse error")
	ErrBingTokenError   = errors.New("failed to get bing translator token")
)

// BingTranslationParams Bing翻译所需的参数
type BingTranslationParams struct {
	Token string // token参数
	Key   string // key参数
	IG    string // IG参数
}

// NewBingTranslator 创建一个新的Bing翻译器实例
func NewBingTranslator() *BingTranslator {
	translator := &BingTranslator{
		BingHost:   defaultBingHost,
		Timeout:    bingDefaultTimeout,
		httpClient: &http.Client{Timeout: bingDefaultTimeout},
	}

	return translator
}

// SetTimeout 设置请求超时时间
func (t *BingTranslator) SetTimeout(timeout time.Duration) {
	t.Timeout = timeout
	t.httpClient.Timeout = timeout
}

// SetBingHost 设置Bing主机
func (t *BingTranslator) SetBingHost(host string) {
	t.BingHost = host
}

// Translate 使用标准语言标签进行文本翻译
func (t *BingTranslator) Translate(text string, from language.Tag, to language.Tag) (string, error) {
	return t.translate(text, from.String(), to.String())
}

// TranslateWithParams 使用简单字符串参数进行文本翻译
func (t *BingTranslator) TranslateWithParams(text string, params TranslationParams) (string, error) {
	return t.translate(text, params.From, params.To)
}

// translate 执行实际翻译操作
func (t *BingTranslator) translate(text, from, to string) (string, error) {
	// 获取翻译所需的参数
	params, err := t.ExtractBingTranslationParams()
	if err != nil {
		return "", fmt.Errorf("failed to extract bing translation params: %w", err)
	}

	// 执行翻译
	return t.GetBingTranslation(params.Token, params.Key, params.IG, text, from, to)
}

// ExtractBingTranslationParams 提取Bing翻译所需的参数
func (t *BingTranslator) ExtractBingTranslationParams() (*BingTranslationParams, error) {
	// 发送GET请求获取网页内容
	url := fmt.Sprintf("https://%s/translator?mkt=zh-CN", t.BingHost)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7")
	req.Header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")

	resp, err := t.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrBingNetworkError, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to access Bing translator page: status code %d", resp.StatusCode)
	}

	// 读取响应内容
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	pageContent := string(body)

	// 模式1: 标准的params_AbusePreventionHelper数组
	keyPattern := regexp.MustCompile(`params_AbusePreventionHelper\s*=\s*\[([^\]]+)\]`)
	keyMatch := keyPattern.FindStringSubmatch(pageContent)

	var key, token string

	if len(keyMatch) >= 2 {
		// 提取并解析数组
		paramsStr := keyMatch[1]
		paramsList := strings.Split(paramsStr, ",")

		if len(paramsList) >= 2 {
			// 清理引号
			key = strings.Trim(paramsList[0], `"' `)
			token = strings.Trim(paramsList[1], `"' `)
		}
	}

	// 如果标准模式失败，尝试备用模式
	if key == "" || token == "" {
		// 模式2: 查找_G.Token和_G.Key
		tokenPattern := regexp.MustCompile(`_G\.Token\s*=\s*["']([^"']+)["']`)
		tokenMatch := tokenPattern.FindStringSubmatch(pageContent)

		keyPattern := regexp.MustCompile(`_G\.Key\s*=\s*["']?([^"',]+)["']?`)
		keyMatch := keyPattern.FindStringSubmatch(pageContent)

		if len(tokenMatch) >= 2 && len(keyMatch) >= 2 {
			token = tokenMatch[1]
			key = keyMatch[1]
		}
	}

	// 如果仍然失败，尝试JSON格式
	if key == "" || token == "" {
		jsonPattern := regexp.MustCompile(`"token"\s*:\s*"([^"]+)"\s*,\s*"key"\s*:\s*"?([^",]+)"?`)
		jsonMatch := jsonPattern.FindStringSubmatch(pageContent)

		if len(jsonMatch) >= 3 {
			token = jsonMatch[1]
			key = jsonMatch[2]
		}
	}

	// 如果所有模式都失败
	if key == "" || token == "" {
		return nil, fmt.Errorf("%w: unable to extract token and key", ErrBingTokenError)
	}

	// 查找并提取 IG 参数，尝试多种格式
	var ig string

	// 模式1: 标准IG格式
	igPattern := regexp.MustCompile(`IG["']?\s*:\s*["']([^"']+)["']`)
	igMatch := igPattern.FindStringSubmatch(pageContent)

	if len(igMatch) >= 2 {
		ig = igMatch[1]
	} else {
		// 模式2: 备用IG格式
		igPattern = regexp.MustCompile(`"IG"\s*:\s*"([^"]+)"`)
		igMatch = igPattern.FindStringSubmatch(pageContent)

		if len(igMatch) >= 2 {
			ig = igMatch[1]
		} else {
			// 模式3: _G.IG格式
			igPattern = regexp.MustCompile(`_G\.IG\s*=\s*["']([^"']+)["']`)
			igMatch = igPattern.FindStringSubmatch(pageContent)

			if len(igMatch) >= 2 {
				ig = igMatch[1]
			}
		}
	}

	// 如果所有IG提取模式都失败
	if ig == "" {
		return nil, fmt.Errorf("%w: unable to extract IG parameter", ErrBingTokenError)
	}

	return &BingTranslationParams{
		Token: token,
		Key:   key,
		IG:    ig,
	}, nil
}

// GetBingTranslation 获取Bing翻译结果
func (t *BingTranslator) GetBingTranslation(token, key, ig, text, fromLang, toLang string) (string, error) {
	// URL编码文本
	encodedText := url.QueryEscape(text)

	// 构建POST请求的payload
	payload := fmt.Sprintf("fromLang=%s&to=%s&text=%s&token=%s&key=%s",
		fromLang, toLang, encodedText, token, key)

	// 构建URL
	urlStr := fmt.Sprintf("https://%s/ttranslatev3?isVertical=1&IG=%s&IID=translator.5028", t.BingHost, ig)

	// 创建请求
	req, err := http.NewRequest("POST", urlStr, strings.NewReader(payload))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	// 设置请求头
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "*/*")
	req.Header.Set("Host", t.BingHost)
	req.Header.Set("Connection", "keep-alive")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Origin", fmt.Sprintf("https://%s", t.BingHost))
	req.Header.Set("Referer", fmt.Sprintf("https://%s/translator", t.BingHost))

	// 发送请求
	resp, err := t.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrBingNetworkError, err)
	}
	defer resp.Body.Close()

	// 判断请求是否成功
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("API error: status code %d", resp.StatusCode)
	}

	// 读取响应体
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	// 检查响应内容
	if len(body) == 0 {
		return "", fmt.Errorf("translation API returned empty response")
	}

	// 使用最简单的结构体解析JSON
	var response []struct {
		Translations []struct {
			Text string `json:"text"`
		} `json:"translations"`
	}

	if err := json.Unmarshal(body, &response); err != nil {
		return "", fmt.Errorf("%w: JSON parsing error: %v", ErrBingParseError, err)
	}

	// 检查解析结果
	if len(response) == 0 || len(response[0].Translations) == 0 {
		return "", fmt.Errorf("%w: invalid response format", ErrBingParseError)
	}

	// 返回翻译结果
	return response[0].Translations[0].Text, nil
}
