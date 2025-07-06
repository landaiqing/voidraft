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
	GoogleHost string                  // Google服务主机
	vm         *otto.Otto              // JavaScript虚拟机
	ttk        otto.Value              // 翻译token缓存
	httpClient *http.Client            // HTTP客户端
	Timeout    time.Duration           // 请求超时时间
	languages  map[string]LanguageInfo // 支持的语言列表
}

// NewGoogleTranslator 创建一个新的Google翻译器实例
func NewGoogleTranslator() *GoogleTranslator {
	translator := &GoogleTranslator{
		GoogleHost: "google.com",
		vm:         otto.New(),
		Timeout:    defaultTimeout,
		httpClient: &http.Client{Timeout: defaultTimeout},
		languages:  initGoogleLanguages(),
	}

	// 初始化ttk
	translator.ttk, _ = otto.ToValue("0")

	return translator
}

// initGoogleLanguages 初始化Google翻译器支持的语言列表
func initGoogleLanguages() map[string]LanguageInfo {
	// 创建语言映射表
	languages := make(map[string]LanguageInfo)

	// 添加所有支持的语言
	// 参考: https://cloud.google.com/translate/docs/languages

	// 添加自动检测
	languages["auto"] = LanguageInfo{Code: "auto", Name: "Auto Detect"}

	// 主要语言
	languages["en"] = LanguageInfo{Code: "en", Name: "English"}
	languages["zh-cn"] = LanguageInfo{Code: "zh-CN", Name: "Chinese (Simplified)"}
	languages["zh-tw"] = LanguageInfo{Code: "zh-TW", Name: "Chinese (Traditional)"}
	languages["ja"] = LanguageInfo{Code: "ja", Name: "Japanese"}
	languages["ko"] = LanguageInfo{Code: "ko", Name: "Korean"}
	languages["fr"] = LanguageInfo{Code: "fr", Name: "French"}
	languages["de"] = LanguageInfo{Code: "de", Name: "German"}
	languages["es"] = LanguageInfo{Code: "es", Name: "Spanish"}
	languages["ru"] = LanguageInfo{Code: "ru", Name: "Russian"}
	languages["it"] = LanguageInfo{Code: "it", Name: "Italian"}
	languages["pt"] = LanguageInfo{Code: "pt", Name: "Portuguese"}

	// 其他语言
	languages["af"] = LanguageInfo{Code: "af", Name: "Afrikaans"}
	languages["sq"] = LanguageInfo{Code: "sq", Name: "Albanian"}
	languages["am"] = LanguageInfo{Code: "am", Name: "Amharic"}
	languages["ar"] = LanguageInfo{Code: "ar", Name: "Arabic"}
	languages["hy"] = LanguageInfo{Code: "hy", Name: "Armenian"}
	languages["az"] = LanguageInfo{Code: "az", Name: "Azerbaijani"}
	languages["eu"] = LanguageInfo{Code: "eu", Name: "Basque"}
	languages["be"] = LanguageInfo{Code: "be", Name: "Belarusian"}
	languages["bn"] = LanguageInfo{Code: "bn", Name: "Bengali"}
	languages["bs"] = LanguageInfo{Code: "bs", Name: "Bosnian"}
	languages["bg"] = LanguageInfo{Code: "bg", Name: "Bulgarian"}
	languages["ca"] = LanguageInfo{Code: "ca", Name: "Catalan"}
	languages["ceb"] = LanguageInfo{Code: "ceb", Name: "Cebuano"}
	languages["zh"] = LanguageInfo{Code: "zh", Name: "Chinese"}
	languages["co"] = LanguageInfo{Code: "co", Name: "Corsican"}
	languages["hr"] = LanguageInfo{Code: "hr", Name: "Croatian"}
	languages["cs"] = LanguageInfo{Code: "cs", Name: "Czech"}
	languages["da"] = LanguageInfo{Code: "da", Name: "Danish"}
	languages["nl"] = LanguageInfo{Code: "nl", Name: "Dutch"}
	languages["eo"] = LanguageInfo{Code: "eo", Name: "Esperanto"}
	languages["et"] = LanguageInfo{Code: "et", Name: "Estonian"}
	languages["fi"] = LanguageInfo{Code: "fi", Name: "Finnish"}
	languages["fy"] = LanguageInfo{Code: "fy", Name: "Frisian"}
	languages["gl"] = LanguageInfo{Code: "gl", Name: "Galician"}
	languages["ka"] = LanguageInfo{Code: "ka", Name: "Georgian"}
	languages["el"] = LanguageInfo{Code: "el", Name: "Greek"}
	languages["gu"] = LanguageInfo{Code: "gu", Name: "Gujarati"}
	languages["ht"] = LanguageInfo{Code: "ht", Name: "Haitian Creole"}
	languages["ha"] = LanguageInfo{Code: "ha", Name: "Hausa"}
	languages["haw"] = LanguageInfo{Code: "haw", Name: "Hawaiian"}
	languages["he"] = LanguageInfo{Code: "he", Name: "Hebrew"}
	languages["hi"] = LanguageInfo{Code: "hi", Name: "Hindi"}
	languages["hmn"] = LanguageInfo{Code: "hmn", Name: "Hmong"}
	languages["hu"] = LanguageInfo{Code: "hu", Name: "Hungarian"}
	languages["is"] = LanguageInfo{Code: "is", Name: "Icelandic"}
	languages["ig"] = LanguageInfo{Code: "ig", Name: "Igbo"}
	languages["id"] = LanguageInfo{Code: "id", Name: "Indonesian"}
	languages["ga"] = LanguageInfo{Code: "ga", Name: "Irish"}
	languages["jw"] = LanguageInfo{Code: "jw", Name: "Javanese"}
	languages["kn"] = LanguageInfo{Code: "kn", Name: "Kannada"}
	languages["kk"] = LanguageInfo{Code: "kk", Name: "Kazakh"}
	languages["km"] = LanguageInfo{Code: "km", Name: "Khmer"}
	languages["ku"] = LanguageInfo{Code: "ku", Name: "Kurdish"}
	languages["ky"] = LanguageInfo{Code: "ky", Name: "Kyrgyz"}
	languages["lo"] = LanguageInfo{Code: "lo", Name: "Lao"}
	languages["la"] = LanguageInfo{Code: "la", Name: "Latin"}
	languages["lv"] = LanguageInfo{Code: "lv", Name: "Latvian"}
	languages["lt"] = LanguageInfo{Code: "lt", Name: "Lithuanian"}
	languages["lb"] = LanguageInfo{Code: "lb", Name: "Luxembourgish"}
	languages["mk"] = LanguageInfo{Code: "mk", Name: "Macedonian"}
	languages["mg"] = LanguageInfo{Code: "mg", Name: "Malagasy"}
	languages["ms"] = LanguageInfo{Code: "ms", Name: "Malay"}
	languages["ml"] = LanguageInfo{Code: "ml", Name: "Malayalam"}
	languages["mt"] = LanguageInfo{Code: "mt", Name: "Maltese"}
	languages["mi"] = LanguageInfo{Code: "mi", Name: "Maori"}
	languages["mr"] = LanguageInfo{Code: "mr", Name: "Marathi"}
	languages["mn"] = LanguageInfo{Code: "mn", Name: "Mongolian"}
	languages["my"] = LanguageInfo{Code: "my", Name: "Myanmar (Burmese)"}
	languages["ne"] = LanguageInfo{Code: "ne", Name: "Nepali"}
	languages["no"] = LanguageInfo{Code: "no", Name: "Norwegian"}
	languages["ny"] = LanguageInfo{Code: "ny", Name: "Nyanja (Chichewa)"}
	languages["ps"] = LanguageInfo{Code: "ps", Name: "Pashto"}
	languages["fa"] = LanguageInfo{Code: "fa", Name: "Persian"}
	languages["pl"] = LanguageInfo{Code: "pl", Name: "Polish"}
	languages["pt-br"] = LanguageInfo{Code: "pt-BR", Name: "Portuguese (Brazil)"}
	languages["pt-pt"] = LanguageInfo{Code: "pt-PT", Name: "Portuguese (Portugal)"}
	languages["pa"] = LanguageInfo{Code: "pa", Name: "Punjabi"}
	languages["ro"] = LanguageInfo{Code: "ro", Name: "Romanian"}
	languages["sm"] = LanguageInfo{Code: "sm", Name: "Samoan"}
	languages["gd"] = LanguageInfo{Code: "gd", Name: "Scots Gaelic"}
	languages["sr"] = LanguageInfo{Code: "sr", Name: "Serbian"}
	languages["st"] = LanguageInfo{Code: "st", Name: "Sesotho"}
	languages["sn"] = LanguageInfo{Code: "sn", Name: "Shona"}
	languages["sd"] = LanguageInfo{Code: "sd", Name: "Sindhi"}
	languages["si"] = LanguageInfo{Code: "si", Name: "Sinhala (Sinhalese)"}
	languages["sk"] = LanguageInfo{Code: "sk", Name: "Slovak"}
	languages["sl"] = LanguageInfo{Code: "sl", Name: "Slovenian"}
	languages["so"] = LanguageInfo{Code: "so", Name: "Somali"}
	languages["su"] = LanguageInfo{Code: "su", Name: "Sundanese"}
	languages["sw"] = LanguageInfo{Code: "sw", Name: "Swahili"}
	languages["sv"] = LanguageInfo{Code: "sv", Name: "Swedish"}
	languages["tl"] = LanguageInfo{Code: "tl", Name: "Tagalog (Filipino)"}
	languages["tg"] = LanguageInfo{Code: "tg", Name: "Tajik"}
	languages["ta"] = LanguageInfo{Code: "ta", Name: "Tamil"}
	languages["te"] = LanguageInfo{Code: "te", Name: "Telugu"}
	languages["th"] = LanguageInfo{Code: "th", Name: "Thai"}
	languages["tr"] = LanguageInfo{Code: "tr", Name: "Turkish"}
	languages["uk"] = LanguageInfo{Code: "uk", Name: "Ukrainian"}
	languages["ur"] = LanguageInfo{Code: "ur", Name: "Urdu"}
	languages["uz"] = LanguageInfo{Code: "uz", Name: "Uzbek"}
	languages["vi"] = LanguageInfo{Code: "vi", Name: "Vietnamese"}
	languages["cy"] = LanguageInfo{Code: "cy", Name: "Welsh"}
	languages["xh"] = LanguageInfo{Code: "xh", Name: "Xhosa"}
	languages["yi"] = LanguageInfo{Code: "yi", Name: "Yiddish"}
	languages["yo"] = LanguageInfo{Code: "yo", Name: "Yoruba"}
	languages["zu"] = LanguageInfo{Code: "zu", Name: "Zulu"}

	return languages
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
	return t.translate(text, from.String(), to.String(), false)
}

// TranslateWithParams 使用简单字符串参数进行文本翻译
func (t *GoogleTranslator) TranslateWithParams(text string, params TranslationParams) (string, error) {
	// 设置超时时间（如果有指定）
	if params.Timeout > 0 {
		t.SetTimeout(params.Timeout)
	}

	return t.translate(text, params.From, params.To, true)
}

// translate 执行实际翻译操作
func (t *GoogleTranslator) translate(text, from, to string, withVerification bool) (string, error) {
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

	req, err := http.NewRequest("GET", u.String(), nil)
	if err != nil {
		return "", err
	}

	r, err := t.httpClient.Do(req)
	if err != nil {
		if errors.Is(err, http.ErrHandlerTimeout) {
			return "", ErrBadNetwork
		}
		return "", err
	}

	if r.StatusCode != http.StatusOK {
		return "", fmt.Errorf("API error: status code %d", r.StatusCode)
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

// GetSupportedLanguages 获取翻译器支持的语言列表
func (t *GoogleTranslator) GetSupportedLanguages() map[string]LanguageInfo {
	return t.languages
}

// IsLanguageSupported 检查指定的语言代码是否受支持
func (t *GoogleTranslator) IsLanguageSupported(languageCode string) bool {
	_, ok := t.languages[strings.ToLower(languageCode)]
	return ok
}

// GetStandardLanguageCode 获取标准化的语言代码
func (t *GoogleTranslator) GetStandardLanguageCode(languageCode string) string {
	// 简单返回小写版本作为标准代码
	return strings.ToLower(languageCode)
}
