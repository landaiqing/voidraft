package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
)

// ThemeType 主题类型枚举
type ThemeType string

const (
	ThemeTypeDark  ThemeType = "dark"
	ThemeTypeLight ThemeType = "light"
)

// ThemeColorConfig 主题颜色配置（与前端 ThemeColors 接口保持一致）
type ThemeColorConfig struct {
	// 主题基本信息
	Name string `json:"name"` // 主题名称
	Dark bool   `json:"dark"` // 是否为深色主题

	// 基础色调
	Background          string `json:"background"`          // 主背景色
	BackgroundSecondary string `json:"backgroundSecondary"` // 次要背景色（用于代码块交替背景）
	Surface             string `json:"surface"`             // 面板背景
	DropdownBackground  string `json:"dropdownBackground"`  // 下拉菜单背景
	DropdownBorder      string `json:"dropdownBorder"`      // 下拉菜单边框

	// 文本颜色
	Foreground          string `json:"foreground"`          // 主文本色
	ForegroundSecondary string `json:"foregroundSecondary"` // 次要文本色
	Comment             string `json:"comment"`             // 注释色

	// 语法高亮色 - 核心
	Keyword  string `json:"keyword"`  // 关键字
	String   string `json:"string"`   // 字符串
	Function string `json:"function"` // 函数名
	Number   string `json:"number"`   // 数字
	Operator string `json:"operator"` // 操作符
	Variable string `json:"variable"` // 变量
	Type     string `json:"type"`     // 类型

	// 语法高亮色 - 扩展
	Constant  string `json:"constant"`  // 常量
	Storage   string `json:"storage"`   // 存储类型（如 static, const）
	Parameter string `json:"parameter"` // 参数
	Class     string `json:"class"`     // 类名
	Heading   string `json:"heading"`   // 标题（Markdown等）
	Invalid   string `json:"invalid"`   // 无效内容/错误
	Regexp    string `json:"regexp"`    // 正则表达式

	// 界面元素
	Cursor           string `json:"cursor"`           // 光标
	Selection        string `json:"selection"`        // 选中背景
	SelectionBlur    string `json:"selectionBlur"`    // 失焦选中背景
	ActiveLine       string `json:"activeLine"`       // 当前行高亮
	LineNumber       string `json:"lineNumber"`       // 行号
	ActiveLineNumber string `json:"activeLineNumber"` // 活动行号颜色

	// 边框和分割线
	BorderColor string `json:"borderColor"` // 边框色
	BorderLight string `json:"borderLight"` // 浅色边框

	// 搜索和匹配
	SearchMatch     string `json:"searchMatch"`     // 搜索匹配
	MatchingBracket string `json:"matchingBracket"` // 匹配括号
}

// Value 实现 driver.Valuer 接口，用于将 ThemeColorConfig 存储到数据库
func (tc ThemeColorConfig) Value() (driver.Value, error) {
	return json.Marshal(tc)
}

// Scan 实现 sql.Scanner 接口，用于从数据库读取 ThemeColorConfig
func (tc *ThemeColorConfig) Scan(value interface{}) error {
	if value == nil {
		return nil
	}

	var bytes []byte
	switch v := value.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	default:
		return fmt.Errorf("cannot scan %T into ThemeColorConfig", value)
	}

	return json.Unmarshal(bytes, tc)
}

// Theme 主题数据库模型
type Theme struct {
	ID        int              `db:"id" json:"id"`
	Name      string           `db:"name" json:"name"`
	Type      ThemeType        `db:"type" json:"type"`
	Colors    ThemeColorConfig `db:"colors" json:"colors"`
	IsDefault bool             `db:"is_default" json:"isDefault"`
	CreatedAt string           `db:"created_at" json:"createdAt"`
	UpdatedAt string           `db:"updated_at" json:"updatedAt"`
}

// NewDefaultDarkTheme 创建默认深色主题配置（与前端 defaultDarkColors 完全一致）
func NewDefaultDarkTheme() *ThemeColorConfig {
	return &ThemeColorConfig{
		// 主题信息
		Name: "default-dark",
		Dark: true,

		// 基础色调
		Background:          "#252B37",
		BackgroundSecondary: "#213644",
		Surface:             "#474747",
		DropdownBackground:  "#252B37",
		DropdownBorder:      "#ffffff19",

		// 文本颜色
		Foreground:          "#9BB586",
		ForegroundSecondary: "#9c9c9c",
		Comment:             "#6272a4",

		// 语法高亮色 - 核心
		Keyword:  "#ff79c6",
		String:   "#f1fa8c",
		Function: "#50fa7b",
		Number:   "#bd93f9",
		Operator: "#ff79c6",
		Variable: "#8fbcbb",
		Type:     "#8be9fd",

		// 语法高亮色 - 扩展
		Constant:  "#bd93f9",
		Storage:   "#ff79c6",
		Parameter: "#8fbcbb",
		Class:     "#8be9fd",
		Heading:   "#ff79c6",
		Invalid:   "#d30102",
		Regexp:    "#f1fa8c",

		// 界面元素
		Cursor:           "#ffffff",
		Selection:        "#0865a9",
		SelectionBlur:    "#225377",
		ActiveLine:       "#ffffff0a",
		LineNumber:       "#ffffff26",
		ActiveLineNumber: "#ffffff99",

		// 边框和分割线
		BorderColor: "#1e222a",
		BorderLight: "#ffffff19",

		// 搜索和匹配
		SearchMatch:     "#8fbcbb",
		MatchingBracket: "#ffffff19",
	}
}

// NewDefaultLightTheme 创建默认浅色主题配置（与前端 defaultLightColors 完全一致）
func NewDefaultLightTheme() *ThemeColorConfig {
	return &ThemeColorConfig{
		// 主题信息
		Name: "default-light",
		Dark: false,

		// 基础色调
		Background:          "#ffffff",
		BackgroundSecondary: "#f1faf1",
		Surface:             "#f5f5f5",
		DropdownBackground:  "#ffffff",
		DropdownBorder:      "#e1e4e8",

		// 文本颜色
		Foreground:          "#444d56",
		ForegroundSecondary: "#6a737d",
		Comment:             "#6a737d",

		// 语法高亮色 - 核心
		Keyword:  "#d73a49",
		String:   "#032f62",
		Function: "#005cc5",
		Number:   "#005cc5",
		Operator: "#d73a49",
		Variable: "#24292e",
		Type:     "#6f42c1",

		// 语法高亮色 - 扩展
		Constant:  "#005cc5",
		Storage:   "#d73a49",
		Parameter: "#24292e",
		Class:     "#6f42c1",
		Heading:   "#d73a49",
		Invalid:   "#cb2431",
		Regexp:    "#032f62",

		// 界面元素
		Cursor:           "#000000",
		Selection:        "#77baff",
		SelectionBlur:    "#b2c2ca",
		ActiveLine:       "#0000000a",
		LineNumber:       "#00000040",
		ActiveLineNumber: "#000000aa",

		// 边框和分割线
		BorderColor: "#dfdfdf",
		BorderLight: "#0000000c",

		// 搜索和匹配
		SearchMatch:     "#005cc5",
		MatchingBracket: "#00000019",
	}
}

// NewDraculaTheme 创建 Dracula 深色主题配置
func NewDraculaTheme() *ThemeColorConfig {
	return &ThemeColorConfig{
		Name: "dracula",
		Dark: true,

		Background:          "#282A36",
		BackgroundSecondary: "#323543FF",
		Surface:             "#282A36",
		DropdownBackground:  "#282A36",
		DropdownBorder:      "#191A21",

		Foreground:          "#F8F8F2",
		ForegroundSecondary: "#F8F8F2",
		Comment:             "#6272A4",

		Keyword:  "#FF79C6",
		String:   "#F1FA8C",
		Function: "#50FA7B",
		Number:   "#BD93F9",
		Operator: "#FF79C6",
		Variable: "#F8F8F2",
		Type:     "#8BE9FD",

		Constant:  "#BD93F9",
		Storage:   "#FF79C6",
		Parameter: "#F8F8F2",
		Class:     "#8BE9FD",
		Heading:   "#BD93F9",
		Invalid:   "#FF5555",
		Regexp:    "#F1FA8C",

		Cursor:           "#F8F8F2",
		Selection:        "#44475A",
		SelectionBlur:    "#44475A",
		ActiveLine:       "#53576c22",
		LineNumber:       "#6272A4",
		ActiveLineNumber: "#F8F8F2",

		BorderColor: "#191A21",
		BorderLight: "#F8F8F219",

		SearchMatch:     "#50FA7B",
		MatchingBracket: "#44475A",
	}
}

// NewAuraTheme 创建 Aura 深色主题配置
func NewAuraTheme() *ThemeColorConfig {
	return &ThemeColorConfig{
		Name: "aura",
		Dark: true,

		Background:          "#21202e",
		BackgroundSecondary: "#2B2A3BFF",
		Surface:             "#21202e",
		DropdownBackground:  "#21202e",
		DropdownBorder:      "#3b334b",

		Foreground:          "#edecee",
		ForegroundSecondary: "#edecee",
		Comment:             "#6d6d6d",

		Keyword:  "#a277ff",
		String:   "#61ffca",
		Function: "#ffca85",
		Number:   "#61ffca",
		Operator: "#a277ff",
		Variable: "#edecee",
		Type:     "#82e2ff",

		Constant:  "#61ffca",
		Storage:   "#a277ff",
		Parameter: "#edecee",
		Class:     "#82e2ff",
		Heading:   "#a277ff",
		Invalid:   "#ff6767",
		Regexp:    "#61ffca",

		Cursor:           "#a277ff",
		Selection:        "#3d375e7f",
		SelectionBlur:    "#3d375e7f",
		ActiveLine:       "#4d4b6622",
		LineNumber:       "#a394f033",
		ActiveLineNumber: "#cdccce",

		BorderColor: "#3b334b",
		BorderLight: "#edecee19",

		SearchMatch:     "#61ffca",
		MatchingBracket: "#a394f033",
	}
}

// NewGitHubDarkTheme 创建 GitHub Dark 主题配置
func NewGitHubDarkTheme() *ThemeColorConfig {
	return &ThemeColorConfig{
		Name: "github-dark",
		Dark: true,

		Background:          "#24292e",
		BackgroundSecondary: "#2E343BFF",
		Surface:             "#24292e",
		DropdownBackground:  "#24292e",
		DropdownBorder:      "#1b1f23",

		Foreground:          "#d1d5da",
		ForegroundSecondary: "#d1d5da",
		Comment:             "#6a737d",

		Keyword:  "#f97583",
		String:   "#9ecbff",
		Function: "#79b8ff",
		Number:   "#79b8ff",
		Operator: "#f97583",
		Variable: "#ffab70",
		Type:     "#79b8ff",

		Constant:  "#79b8ff",
		Storage:   "#f97583",
		Parameter: "#e1e4e8",
		Class:     "#b392f0",
		Heading:   "#79b8ff",
		Invalid:   "#f97583",
		Regexp:    "#9ecbff",

		Cursor:           "#c8e1ff",
		Selection:        "#3392FF44",
		SelectionBlur:    "#3392FF44",
		ActiveLine:       "#4d566022",
		LineNumber:       "#444d56",
		ActiveLineNumber: "#e1e4e8",

		BorderColor: "#1b1f23",
		BorderLight: "#d1d5da19",

		SearchMatch:     "#79b8ff",
		MatchingBracket: "#17E5E650",
	}
}

// NewMaterialDarkTheme 创建 Material Dark 主题配置
func NewMaterialDarkTheme() *ThemeColorConfig {
	return &ThemeColorConfig{
		Name: "material-dark",
		Dark: true,

		Background:          "#263238",
		BackgroundSecondary: "#2D3E46FF",
		Surface:             "#263238",
		DropdownBackground:  "#263238",
		DropdownBorder:      "#FFFFFF10",

		Foreground:          "#EEFFFF",
		ForegroundSecondary: "#EEFFFF",
		Comment:             "#546E7A",

		Keyword:  "#C792EA",
		String:   "#C3E88D",
		Function: "#82AAFF",
		Number:   "#F78C6C",
		Operator: "#C792EA",
		Variable: "#EEFFFF",
		Type:     "#B2CCD6",

		Constant:  "#F78C6C",
		Storage:   "#C792EA",
		Parameter: "#EEFFFF",
		Class:     "#FFCB6B",
		Heading:   "#C3E88D",
		Invalid:   "#FF5370",
		Regexp:    "#89DDFF",

		Cursor:           "#FFCC00",
		Selection:        "#80CBC420",
		SelectionBlur:    "#80CBC420",
		ActiveLine:       "#4c616c22",
		LineNumber:       "#37474F",
		ActiveLineNumber: "#607a86",

		BorderColor: "#FFFFFF10",
		BorderLight: "#EEFFFF19",

		SearchMatch:     "#82AAFF",
		MatchingBracket: "#263238",
	}
}

// NewOneDarkTheme 创建 One Dark 主题配置
func NewOneDarkTheme() *ThemeColorConfig {
	return &ThemeColorConfig{
		Name: "one-dark",
		Dark: true,

		Background:          "#282c34",
		BackgroundSecondary: "#313949FF",
		Surface:             "#353a42",
		DropdownBackground:  "#21252b",
		DropdownBorder:      "#7d8799",

		Foreground:          "#abb2bf",
		ForegroundSecondary: "#7d8799",
		Comment:             "#7d8799",

		Keyword:  "#c678dd",
		String:   "#98c379",
		Function: "#61afef",
		Number:   "#e5c07b",
		Operator: "#56b6c2",
		Variable: "#e06c75",
		Type:     "#e5c07b",

		Constant:  "#d19a66",
		Storage:   "#c678dd",
		Parameter: "#e06c75",
		Class:     "#e5c07b",
		Heading:   "#e06c75",
		Invalid:   "#ffffff",
		Regexp:    "#56b6c2",

		Cursor:           "#528bff",
		Selection:        "#3E4451",
		SelectionBlur:    "#3E4451",
		ActiveLine:       "#6699ff0b",
		LineNumber:       "#7d8799",
		ActiveLineNumber: "#abb2bf",

		BorderColor: "#21252b",
		BorderLight: "#abb2bf19",

		SearchMatch:     "#61afef",
		MatchingBracket: "#bad0f847",
	}
}

// NewSolarizedDarkTheme 创建 Solarized Dark 主题配置
func NewSolarizedDarkTheme() *ThemeColorConfig {
	return &ThemeColorConfig{
		Name: "solarized-dark",
		Dark: true,

		Background:          "#002B36",
		BackgroundSecondary: "#003643FF",
		Surface:             "#002B36",
		DropdownBackground:  "#002B36",
		DropdownBorder:      "#2AA19899",

		Foreground:          "#93A1A1",
		ForegroundSecondary: "#93A1A1",
		Comment:             "#586E75",

		Keyword:  "#859900",
		String:   "#2AA198",
		Function: "#268BD2",
		Number:   "#D33682",
		Operator: "#859900",
		Variable: "#268BD2",
		Type:     "#CB4B16",

		Constant:  "#CB4B16",
		Storage:   "#93A1A1",
		Parameter: "#268BD2",
		Class:     "#CB4B16",
		Heading:   "#268BD2",
		Invalid:   "#DC322F",
		Regexp:    "#DC322F",

		Cursor:           "#D30102",
		Selection:        "#274642",
		SelectionBlur:    "#274642",
		ActiveLine:       "#005b7022",
		LineNumber:       "#93A1A1",
		ActiveLineNumber: "#949494",

		BorderColor: "#073642",
		BorderLight: "#93A1A119",

		SearchMatch:     "#2AA198",
		MatchingBracket: "#073642",
	}
}

// NewTokyoNightTheme 创建 Tokyo Night 主题配置
func NewTokyoNightTheme() *ThemeColorConfig {
	return &ThemeColorConfig{
		Name: "tokyo-night",
		Dark: true,

		Background:          "#1a1b26",
		BackgroundSecondary: "#272839FF",
		Surface:             "#1a1b26",
		DropdownBackground:  "#1a1b26",
		DropdownBorder:      "#787c99",

		Foreground:          "#787c99",
		ForegroundSecondary: "#787c99",
		Comment:             "#444b6a",

		Keyword:  "#bb9af7",
		String:   "#9ece6a",
		Function: "#7aa2f7",
		Number:   "#ff9e64",
		Operator: "#bb9af7",
		Variable: "#c0caf5",
		Type:     "#0db9d7",

		Constant:  "#bb9af7",
		Storage:   "#bb9af7",
		Parameter: "#c0caf5",
		Class:     "#c0caf5",
		Heading:   "#89ddff",
		Invalid:   "#ff5370",
		Regexp:    "#b4f9f8",

		Cursor:           "#c0caf5",
		Selection:        "#515c7e40",
		SelectionBlur:    "#515c7e40",
		ActiveLine:       "#43455c22",
		LineNumber:       "#363b54",
		ActiveLineNumber: "#737aa2",

		BorderColor: "#16161e",
		BorderLight: "#787c9919",

		SearchMatch:     "#7aa2f7",
		MatchingBracket: "#16161e",
	}
}

// NewTokyoNightStormTheme 创建 Tokyo Night Storm 主题配置
func NewTokyoNightStormTheme() *ThemeColorConfig {
	return &ThemeColorConfig{
		Name: "tokyo-night-storm",
		Dark: true,

		Background:          "#24283b",
		BackgroundSecondary: "#2B3151FF",
		Surface:             "#24283b",
		DropdownBackground:  "#24283b",
		DropdownBorder:      "#7982a9",

		Foreground:          "#7982a9",
		ForegroundSecondary: "#7982a9",
		Comment:             "#565f89",

		Keyword:  "#bb9af7",
		String:   "#9ece6a",
		Function: "#7aa2f7",
		Number:   "#ff9e64",
		Operator: "#bb9af7",
		Variable: "#c0caf5",
		Type:     "#2ac3de",

		Constant:  "#bb9af7",
		Storage:   "#bb9af7",
		Parameter: "#c0caf5",
		Class:     "#c0caf5",
		Heading:   "#89ddff",
		Invalid:   "#ff5370",
		Regexp:    "#b4f9f8",

		Cursor:           "#c0caf5",
		Selection:        "#6f7bb630",
		SelectionBlur:    "#6f7bb630",
		ActiveLine:       "#4d547722",
		LineNumber:       "#3b4261",
		ActiveLineNumber: "#737aa2",

		BorderColor: "#1f2335",
		BorderLight: "#7982a919",

		SearchMatch:     "#7aa2f7",
		MatchingBracket: "#1f2335",
	}
}

// 浅色主题预设配置

// NewGitHubLightTheme 创建 GitHub Light 主题配置
func NewGitHubLightTheme() *ThemeColorConfig {
	return &ThemeColorConfig{
		Name: "github-light",
		Dark: false,

		Background:          "#fff",
		BackgroundSecondary: "#f1faf1",
		Surface:             "#fff",
		DropdownBackground:  "#fff",
		DropdownBorder:      "#e1e4e8",

		Foreground:          "#444d56",
		ForegroundSecondary: "#444d56",
		Comment:             "#6a737d",

		Keyword:  "#d73a49",
		String:   "#032f62",
		Function: "#005cc5",
		Number:   "#005cc5",
		Operator: "#d73a49",
		Variable: "#e36209",
		Type:     "#005cc5",

		Constant:  "#005cc5",
		Storage:   "#d73a49",
		Parameter: "#24292e",
		Class:     "#6f42c1",
		Heading:   "#005cc5",
		Invalid:   "#cb2431",
		Regexp:    "#032f62",

		Cursor:           "#044289",
		Selection:        "#0366d625",
		SelectionBlur:    "#0366d625",
		ActiveLine:       "#c6c6c622",
		LineNumber:       "#1b1f234d",
		ActiveLineNumber: "#24292e",

		BorderColor: "#e1e4e8",
		BorderLight: "#444d5619",

		SearchMatch:     "#005cc5",
		MatchingBracket: "#34d05840",
	}
}

// NewMaterialLightTheme 创建 Material Light 主题配置
func NewMaterialLightTheme() *ThemeColorConfig {
	return &ThemeColorConfig{
		Name: "material-light",
		Dark: false,

		Background:          "#FAFAFA",
		BackgroundSecondary: "#f1faf1",
		Surface:             "#FAFAFA",
		DropdownBackground:  "#FAFAFA",
		DropdownBorder:      "#00000010",

		Foreground:          "#90A4AE",
		ForegroundSecondary: "#90A4AE",
		Comment:             "#90A4AE",

		Keyword:  "#7C4DFF",
		String:   "#91B859",
		Function: "#6182B8",
		Number:   "#F76D47",
		Operator: "#7C4DFF",
		Variable: "#90A4AE",
		Type:     "#8796B0",

		Constant:  "#F76D47",
		Storage:   "#7C4DFF",
		Parameter: "#90A4AE",
		Class:     "#FFB62C",
		Heading:   "#91B859",
		Invalid:   "#E53935",
		Regexp:    "#39ADB5",

		Cursor:           "#272727",
		Selection:        "#80CBC440",
		SelectionBlur:    "#80CBC440",
		ActiveLine:       "#c2c2c222",
		LineNumber:       "#CFD8DC",
		ActiveLineNumber: "#7E939E",

		BorderColor: "#00000010",
		BorderLight: "#90A4AE19",

		SearchMatch:     "#6182B8",
		MatchingBracket: "#FAFAFA",
	}
}

// NewSolarizedLightTheme 创建 Solarized Light 主题配置
func NewSolarizedLightTheme() *ThemeColorConfig {
	return &ThemeColorConfig{
		Name: "solarized-light",
		Dark: false,

		Background:          "#FDF6E3",
		BackgroundSecondary: "#FFEEBCD4",
		Surface:             "#FDF6E3",
		DropdownBackground:  "#FDF6E3",
		DropdownBorder:      "#D3AF86",

		Foreground:          "#586E75",
		ForegroundSecondary: "#586E75",
		Comment:             "#93A1A1",

		Keyword:  "#859900",
		String:   "#2AA198",
		Function: "#268BD2",
		Number:   "#D33682",
		Operator: "#859900",
		Variable: "#268BD2",
		Type:     "#CB4B16",

		Constant:  "#CB4B16",
		Storage:   "#586E75",
		Parameter: "#268BD2",
		Class:     "#CB4B16",
		Heading:   "#268BD2",
		Invalid:   "#DC322F",
		Regexp:    "#DC322F",

		Cursor:           "#657B83",
		Selection:        "#EEE8D5",
		SelectionBlur:    "#EEE8D5",
		ActiveLine:       "#d5bd5c22",
		LineNumber:       "#586E75",
		ActiveLineNumber: "#567983",

		BorderColor: "#EEE8D5",
		BorderLight: "#586E7519",

		SearchMatch:     "#268BD2",
		MatchingBracket: "#EEE8D5",
	}
}

// NewTokyoNightDayTheme 创建 Tokyo Night Day 主题配置
func NewTokyoNightDayTheme() *ThemeColorConfig {
	return &ThemeColorConfig{
		Name: "tokyo-night-day",
		Dark: false,

		Background:          "#e1e2e7",
		BackgroundSecondary: "#D2D8EFFF",
		Surface:             "#e1e2e7",
		DropdownBackground:  "#e1e2e7",
		DropdownBorder:      "#6a6f8e",

		Foreground:          "#6a6f8e",
		ForegroundSecondary: "#6a6f8e",
		Comment:             "#9da3c2",

		Keyword:  "#9854f1",
		String:   "#587539",
		Function: "#2e7de9",
		Number:   "#b15c00",
		Operator: "#9854f1",
		Variable: "#3760bf",
		Type:     "#07879d",

		Constant:  "#9854f1",
		Storage:   "#9854f1",
		Parameter: "#3760bf",
		Class:     "#3760bf",
		Heading:   "#006a83",
		Invalid:   "#ff3e64",
		Regexp:    "#2e5857",

		Cursor:           "#3760bf",
		Selection:        "#8591b840",
		SelectionBlur:    "#8591b840",
		ActiveLine:       "#a7aaba22",
		LineNumber:       "#b3b6cd",
		ActiveLineNumber: "#68709a",

		BorderColor: "#e9e9ec",
		BorderLight: "#6a6f8e19",

		SearchMatch:     "#2e7de9",
		MatchingBracket: "#e9e9ec",
	}
}
