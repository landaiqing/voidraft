// Package translator 提供文本翻译功能
package translator

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/robertkrimen/otto"
	"golang.org/x/text/language"
)

// 错误定义
var (
	ErrBadNetwork = errors.New("bad network, please check your internet connection")
)

// GoogleTranslator Google翻译器结构体，统一管理翻译功能
type GoogleTranslator struct {
	GoogleHost string        // Google服务主机
	vm         *otto.Otto    // JavaScript虚拟机
	ttk        otto.Value    // 翻译token缓存
	httpClient *http.Client  // HTTP客户端
	Timeout    time.Duration // 请求超时时间
}

// NewGoogleTranslator 创建一个新的Google翻译器实例
func NewGoogleTranslator() *GoogleTranslator {
	translator := &GoogleTranslator{
		GoogleHost: "google.com",
		vm:         otto.New(),
		Timeout:    defaultTimeout,
		httpClient: &http.Client{Timeout: defaultTimeout},
	}

	// 初始化ttk
	translator.ttk, _ = otto.ToValue("0")

	return translator
}

// SetTimeout 设置请求超时时间
func (t *GoogleTranslator) SetTimeout(timeout time.Duration) {
	t.Timeout = timeout
	t.httpClient.Timeout = timeout
}

// SetGoogleHost 设置Google主机
func (t *GoogleTranslator) SetGoogleHost(host string) {
	t.GoogleHost = host
}

// Translate 使用Go语言提供的标准语言标签进行文本翻译
func (t *GoogleTranslator) Translate(text string, from language.Tag, to language.Tag) (string, error) {
	return t.translate(text, from.String(), to.String(), false, defaultNumberOfRetries, 0)
}

// TranslateWithParams 使用简单字符串参数进行文本翻译
func (t *GoogleTranslator) TranslateWithParams(text string, params TranslationParams) (string, error) {
	tries := params.Tries
	if tries == 0 {
		tries = defaultNumberOfRetries
	}

	return t.translate(text, params.From, params.To, true, tries, params.Delay)
}

// translate 执行实际翻译操作
func (t *GoogleTranslator) translate(text, from, to string, withVerification bool, tries int, delay time.Duration) (string, error) {
	if tries == 0 {
		tries = defaultNumberOfRetries
	}

	if withVerification {
		if _, err := language.Parse(from); err != nil && from != "auto" {
			log.Println("[WARNING], '" + from + "' is a invalid language, switching to 'auto'")
			from = "auto"
		}
		if _, err := language.Parse(to); err != nil {
			log.Println("[WARNING], '" + to + "' is a invalid language, switching to 'en'")
			to = "en"
		}
	}

	textValue, _ := otto.ToValue(text)
	urlStr := fmt.Sprintf("https://translate.%s/translate_a/single", t.GoogleHost)
	token := t.getToken(textValue)

	data := map[string]string{
		"client": "gtx",
		"sl":     from,
		"tl":     to,
		"hl":     to,
		"ie":     "UTF-8",
		"oe":     "UTF-8",
		"otf":    "1",
		"ssel":   "0",
		"tsel":   "0",
		"kc":     "7",
		"q":      text,
	}

	u, err := url.Parse(urlStr)
	if err != nil {
		return "", err
	}

	parameters := url.Values{}
	for k, v := range data {
		parameters.Add(k, v)
	}
	for _, v := range []string{"at", "bd", "ex", "ld", "md", "qca", "rw", "rm", "ss", "t"} {
		parameters.Add("dt", v)
	}

	parameters.Add("tk", token)
	u.RawQuery = parameters.Encode()

	var r *http.Response
	for tries > 0 {
		req, err := http.NewRequest("GET", u.String(), nil)
		if err != nil {
			return "", err
		}

		r, err = t.httpClient.Do(req)
		if err != nil {
			if errors.Is(err, http.ErrHandlerTimeout) {
				return "", ErrBadNetwork
			}
			return "", err
		}

		if r.StatusCode == http.StatusOK {
			break
		}

		if r.StatusCode == http.StatusForbidden {
			tries--
			time.Sleep(delay)
		}
	}

	raw, err := io.ReadAll(r.Body)
	if err != nil {
		return "", err
	}
	defer r.Body.Close()

	var resp []interface{}
	err = json.Unmarshal(raw, &resp)
	if err != nil {
		return "", err
	}

	responseText := ""
	for _, obj := range resp[0].([]interface{}) {
		if len(obj.([]interface{})) == 0 {
			break
		}

		t, ok := obj.([]interface{})[0].(string)
		if ok {
			responseText += t
		}
	}

	return responseText, nil
}

// getToken 获取翻译API所需的token
func (t *GoogleTranslator) getToken(text otto.Value) string {
	ttk, err := t.updateTTK()
	if err != nil {
		return ""
	}

	tk, err := t.generateToken(text, ttk)
	if err != nil {
		return ""
	}

	return strings.Replace(tk.String(), "&tk=", "", -1)
}

// updateTTK 更新TTK值
func (t *GoogleTranslator) updateTTK() (otto.Value, error) {
	timestamp := time.Now().UnixNano() / 3600000
	now := math.Floor(float64(timestamp))
	ttk, err := strconv.ParseFloat(t.ttk.String(), 64)
	if err != nil {
		return otto.UndefinedValue(), err
	}

	if ttk == now {
		return t.ttk, nil
	}

	req, err := http.NewRequest("GET", fmt.Sprintf("https://translate.%s", t.GoogleHost), nil)
	if err != nil {
		return otto.UndefinedValue(), err
	}

	resp, err := t.httpClient.Do(req)
	if err != nil {
		return otto.UndefinedValue(), err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return otto.UndefinedValue(), err
	}

	matches := regexp.MustCompile(`tkk:\s?'(.+?)'`).FindStringSubmatch(string(body))
	if len(matches) > 0 {
		v, err := otto.ToValue(matches[0])
		if err != nil {
			return otto.UndefinedValue(), err
		}
		t.ttk = v
		return v, nil
	}

	return t.ttk, nil
}

// generateToken 生成翻译API所需的token
func (t *GoogleTranslator) generateToken(a otto.Value, TTK otto.Value) (otto.Value, error) {
	err := t.vm.Set("x", a)
	if err != nil {
		return otto.UndefinedValue(), err
	}

	_ = t.vm.Set("internalTTK", TTK)

	result, err := t.vm.Run(`
		function sM(a) {
			var b;
			if (null !== yr)
				b = yr;
			else {
				b = wr(String.fromCharCode(84));
				var c = wr(String.fromCharCode(75));
				b = [b(), b()];
				b[1] = c();
				b = (yr = window[b.join(c())] || "") || ""
			}
			var d = wr(String.fromCharCode(116))
				, c = wr(String.fromCharCode(107))
				, d = [d(), d()];
			d[1] = c();
			c = "&" + d.join("") + "=";
			d = b.split(".");
			b = Number(d[0]) || 0;
			for (var e = [], f = 0, g = 0; g < a.length; g++) {
				var l = a.charCodeAt(g);
				128 > l ? e[f++] = l : (2048 > l ? e[f++] = l >> 6 | 192 : (55296 == (l & 64512) && g + 1 < a.length && 56320 == (a.charCodeAt(g + 1) & 64512) ? (l = 65536 + ((l & 1023) << 10) + (a.charCodeAt(++g) & 1023),
					e[f++] = l >> 18 | 240,
					e[f++] = l >> 12 & 63 | 128) : e[f++] = l >> 12 | 224,
					e[f++] = l >> 6 & 63 | 128),
					e[f++] = l & 63 | 128)
			}
			a = b;
			for (f = 0; f < e.length; f++)
				a += e[f],
					a = xr(a, "+-a^+6");
			a = xr(a, "+-3^+b+-f");
			a ^= Number(d[1]) || 0;
			0 > a && (a = (a & 2147483647) + 2147483648);
			a %= 1E6;
			return c + (a.toString() + "." + (a ^ b))
		}

		var yr = null;
		var wr = function(a) {
			return function() {
				return a
			}
		}
			, xr = function(a, b) {
			for (var c = 0; c < b.length - 2; c += 3) {
				var d = b.charAt(c + 2)
					, d = "a" <= d ? d.charCodeAt(0) - 87 : Number(d)
					, d = "+" == b.charAt(c + 1) ? a >>> d : a << d;
				a = "+" == b.charAt(c) ? a + d & 4294967295 : a ^ d
			}
			return a
		};
		
		var window = {
			TKK: internalTTK
		};

		sM(x)
	`)
	if err != nil {
		return otto.UndefinedValue(), err
	}

	return result, nil
}
