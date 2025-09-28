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

// ThemeColorConfig 主题颜色配置
type ThemeColorConfig struct {
	// 基础色调
	Background          string `json:"background"`          // 主背景色
	BackgroundSecondary string `json:"backgroundSecondary"` // 次要背景色
	Surface             string `json:"surface"`             // 面板背景
	Foreground          string `json:"foreground"`          // 主文本色
	ForegroundSecondary string `json:"foregroundSecondary"` // 次要文本色

	// 语法高亮
	Comment  string `json:"comment"`  // 注释色
	Keyword  string `json:"keyword"`  // 关键字
	String   string `json:"string"`   // 字符串
	Function string `json:"function"` // 函数名
	Number   string `json:"number"`   // 数字
	Operator string `json:"operator"` // 操作符
	Variable string `json:"variable"` // 变量
	Type     string `json:"type"`     // 类型

	// 界面元素
	Cursor           string `json:"cursor"`           // 光标
	Selection        string `json:"selection"`        // 选中背景
	SelectionBlur    string `json:"selectionBlur"`    // 失焦选中背景
	ActiveLine       string `json:"activeLine"`       // 当前行高亮
	LineNumber       string `json:"lineNumber"`       // 行号
	ActiveLineNumber string `json:"activeLineNumber"` // 活动行号

	// 边框分割线
	BorderColor string `json:"borderColor"` // 边框色
	BorderLight string `json:"borderLight"` // 浅色边框

	// 搜索匹配
	SearchMatch     string `json:"searchMatch"`     // 搜索匹配
	MatchingBracket string `json:"matchingBracket"` // 匹配括号
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

// NewDefaultDarkTheme 创建默认深色主题配置
func NewDefaultDarkTheme() *ThemeColorConfig {
	return &ThemeColorConfig{
		// 基础色调
		Background:          "#252B37",
		BackgroundSecondary: "#213644",
		Surface:             "#474747",
		Foreground:          "#9BB586",
		ForegroundSecondary: "#9c9c9c",

		// 语法高亮
		Comment:  "#6272a4",
		Keyword:  "#ff79c6",
		String:   "#f1fa8c",
		Function: "#50fa7b",
		Number:   "#bd93f9",
		Operator: "#ff79c6",
		Variable: "#8fbcbb",
		Type:     "#8be9fd",

		// 界面元素
		Cursor:           "#ffffff",
		Selection:        "#0865a9",
		SelectionBlur:    "#225377",
		ActiveLine:       "#ffffff0a",
		LineNumber:       "#ffffff26",
		ActiveLineNumber: "#ffffff99",

		// 边框分割线
		BorderColor: "#1e222a",
		BorderLight: "#ffffff1a",

		// 搜索匹配
		SearchMatch:     "#8fbcbb",
		MatchingBracket: "#ffffff1a",
	}
}

// NewDefaultLightTheme 创建默认浅色主题配置
func NewDefaultLightTheme() *ThemeColorConfig {
	return &ThemeColorConfig{
		// 基础色调
		Background:          "#ffffff",
		BackgroundSecondary: "#f1faf1",
		Surface:             "#f5f5f5",
		Foreground:          "#444d56",
		ForegroundSecondary: "#6a737d",

		// 语法高亮
		Comment:  "#6a737d",
		Keyword:  "#d73a49",
		String:   "#032f62",
		Function: "#005cc5",
		Number:   "#005cc5",
		Operator: "#d73a49",
		Variable: "#24292e",
		Type:     "#6f42c1",

		// 界面元素
		Cursor:           "#000000",
		Selection:        "#77baff",
		SelectionBlur:    "#b2c2ca",
		ActiveLine:       "#0000000a",
		LineNumber:       "#00000040",
		ActiveLineNumber: "#000000aa",

		// 边框分割线
		BorderColor: "#dfdfdf",
		BorderLight: "#0000000c",

		// 搜索匹配
		SearchMatch:     "#005cc5",
		MatchingBracket: "#00000019",
	}
}
