// Package translator 提供文本翻译功能
package translator

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"golang.org/x/net/html"
	"golang.org/x/text/language"
)

// YoudaoTranslator 有道翻译器结构体
type YoudaoTranslator struct {
	httpClient *http.Client            // HTTP客户端
	Timeout    time.Duration           // 请求超时时间
	languages  map[string]LanguageInfo // 支持的语言列表
}

// 常量定义
const (
	youdaoDefaultTimeout = 30 * time.Second
	youdaoTranslateURL   = "https://m.youdao.com/translate"
)

// 错误定义
var (
	ErrYoudaoNetworkError = errors.New("youdao translator network error")
	ErrYoudaoParseError   = errors.New("youdao translator parse error")
)

// NewYoudaoTranslator 创建一个新的有道翻译器实例
func NewYoudaoTranslator() *YoudaoTranslator {
	translator := &YoudaoTranslator{
		Timeout:    youdaoDefaultTimeout,
		httpClient: &http.Client{Timeout: youdaoDefaultTimeout},
		languages:  initYoudaoLanguages(),
	}

	return translator
}

// initYoudaoLanguages 初始化有道翻译器支持的语言列表
func initYoudaoLanguages() map[string]LanguageInfo {
	// 创建语言映射表
	languages := make(map[string]LanguageInfo)

	languages["auto"] = LanguageInfo{Code: "AUTO", Name: "Auto"}

	return languages
}

// SetTimeout 设置请求超时时间
func (t *YoudaoTranslator) SetTimeout(timeout time.Duration) {
	t.Timeout = timeout
	t.httpClient.Timeout = timeout
}

// Translate 使用标准语言标签进行文本翻译
func (t *YoudaoTranslator) Translate(text string, from language.Tag, to language.Tag) (string, error) {
	return t.translate(text, to.String())
}

// TranslateWithParams 使用简单字符串参数进行文本翻译
func (t *YoudaoTranslator) TranslateWithParams(text string, params TranslationParams) (string, error) {
	// 设置超时时间（如果有指定）
	if params.Timeout > 0 {
		t.SetTimeout(params.Timeout)
	}

	return t.translate(text, params.To)
}

// translate 执行实际翻译操作
func (t *YoudaoTranslator) translate(text string, typeName string) (string, error) {
	// 构建表单数据
	form := url.Values{}
	form.Add("inputtext", text)
	form.Add("type", typeName)

	// 创建请求
	req, err := http.NewRequest("POST", youdaoTranslateURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	// 设置请求头
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9")
	req.Header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")

	// 发送请求
	resp, err := t.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrYoudaoNetworkError, err)
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

	// 解析HTML响应
	result, err := t.extractTranslationResult(string(body))
	if err != nil {
		return "", err
	}

	return result, nil
}

// extractTranslationResult 从HTML响应中提取翻译结果
func (t *YoudaoTranslator) extractTranslationResult(htmlContent string) (string, error) {
	// 方法1：使用正则表达式提取翻译结果
	pattern := regexp.MustCompile(`<ul id="translateResult"[^>]*>.*?<li[^>]*>(.*?)</li>`)
	matches := pattern.FindStringSubmatch(htmlContent)

	if len(matches) >= 2 {
		// 清理HTML标签
		result := matches[1]
		result = strings.ReplaceAll(result, "<br>", "\n")
		result = t.stripHTMLTags(result)
		return result, nil
	}

	// 方法2：使用HTML解析器提取翻译结果
	doc, err := html.Parse(strings.NewReader(htmlContent))
	if err != nil {
		return "", fmt.Errorf("%w: failed to parse HTML", ErrYoudaoParseError)
	}

	// 查找翻译结果元素
	result := t.findTranslateResult(doc)
	if result != "" {
		return result, nil
	}

	return "", fmt.Errorf("%w: could not find translation result", ErrYoudaoParseError)
}

// stripHTMLTags 移除HTML标签
func (t *YoudaoTranslator) stripHTMLTags(input string) string {
	// 简单的HTML标签移除
	re := regexp.MustCompile("<[^>]*>")
	return re.ReplaceAllString(input, "")
}

// findTranslateResult 在HTML文档中查找翻译结果
func (t *YoudaoTranslator) findTranslateResult(n *html.Node) string {
	if n.Type == html.ElementNode && n.Data == "ul" {
		for _, attr := range n.Attr {
			if attr.Key == "id" && attr.Val == "translateResult" {
				// 找到了translateResult元素，提取其中的文本
				var result string
				for c := n.FirstChild; c != nil; c = c.NextSibling {
					if c.Type == html.ElementNode && c.Data == "li" {
						return t.extractText(c)
					}
				}
				return result
			}
		}
	}

	// 递归查找子节点
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		result := t.findTranslateResult(c)
		if result != "" {
			return result
		}
	}

	return ""
}

// extractText 提取节点中的文本内容
func (t *YoudaoTranslator) extractText(n *html.Node) string {
	if n.Type == html.TextNode {
		return n.Data
	}

	var result string
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		result += t.extractText(c)
	}

	return result
}

// GetSupportedLanguages 获取翻译器支持的语言列表
func (t *YoudaoTranslator) GetSupportedLanguages() map[string]LanguageInfo {
	return t.languages
}

// IsLanguageSupported 检查指定的语言代码是否受支持
func (t *YoudaoTranslator) IsLanguageSupported(languageCode string) bool {
	_, ok := t.languages[strings.ToLower(languageCode)]
	return ok
}

// GetStandardLanguageCode 获取标准化的语言代码
func (t *YoudaoTranslator) GetStandardLanguageCode(languageCode string) string {
	// 简单返回小写版本作为标准代码
	return strings.ToLower(languageCode)
}
