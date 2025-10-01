package translator

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"golang.org/x/text/language"
	"io"
	"net/http"
	"net/url"
	"time"
)

// NewGoogleTranslatorTokenFree 创建一个新的无token的Google翻译器实例
func NewGoogleTranslatorTokenFree() *GoogleTranslatorTokenFree {
	return &GoogleTranslatorTokenFree{
		httpClient: &http.Client{Timeout: defaultTimeout},
		Timeout:    defaultTimeout,
		languages:  initGoogleLanguages(),
	}
}

// SetTimeout 设置请求超时时间
func (t *GoogleTranslatorTokenFree) SetTimeout(timeout time.Duration) {
	t.Timeout = timeout
	t.httpClient.Timeout = timeout
}

// Translate 使用Go语言提供的标准语言标签进行文本翻译
func (t *GoogleTranslatorTokenFree) Translate(text string, from language.Tag, to language.Tag) (string, error) {
	return t.translate(text, from.String(), to.String())
}

// TranslateWithParams 使用简单字符串参数进行文本翻译
func (t *GoogleTranslatorTokenFree) TranslateWithParams(text string, params TranslationParams) (string, error) {
	if params.Timeout > 0 {
		t.SetTimeout(params.Timeout)
	}
	return t.translate(text, params.From, params.To)
}

// translate 执行实际翻译操作（无token版本）
func (t *GoogleTranslatorTokenFree) translate(text, from, to string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), t.Timeout)
	defer cancel()

	// 构建请求URL（无token版本）
	apiURL := "https://translate.googleapis.com/translate_a/t"
	params := url.Values{}
	params.Set("client", "dict-chrome-ex")
	params.Set("sl", from)
	params.Set("tl", to)
	params.Set("q", text)

	fullURL := apiURL + "?" + params.Encode()

	// 创建请求
	req, err := http.NewRequestWithContext(ctx, "GET", fullURL, nil)
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

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

	// 提取翻译文本
	var translatedTexts []string
	visitArrayItems(result, func(obj interface{}) {
		if text, ok := obj.(string); ok {
			translatedTexts = append(translatedTexts, text)
		}
	})

	if len(translatedTexts) == 0 {
		return "", errors.New("no translation found")
	}

	// 返回第一个翻译结果
	return translatedTexts[0], nil
}
