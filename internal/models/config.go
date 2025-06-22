package models

import (
	"time"
)

// TabType 定义了制表符类型
type TabType string

const (
	// TabTypeSpaces 使用空格作为制表符
	TabTypeSpaces TabType = "spaces"
	// TabTypeTab 使用Tab作为制表符
	TabTypeTab TabType = "tab"
)

// LanguageType 语言类型定义
type LanguageType string

const (
	// LangZhCN 中文简体
	LangZhCN LanguageType = "zh-CN"
	// LangEnUS 英文-美国
	LangEnUS LanguageType = "en-US"
)

// SystemThemeType 系统主题类型定义
type SystemThemeType string

const (
	// SystemThemeDark 深色系统主题
	SystemThemeDark SystemThemeType = "dark"
	// SystemThemeLight 浅色系统主题
	SystemThemeLight SystemThemeType = "light"
	// SystemThemeAuto 跟随系统主题
	SystemThemeAuto SystemThemeType = "auto"
)

// GeneralConfig 通用设置配置
type GeneralConfig struct {
	AlwaysOnTop      bool   `json:"alwaysOnTop"`      // 窗口是否置顶
	DataPath         string `json:"dataPath"`         // 数据存储路径
	EnableSystemTray bool   `json:"enableSystemTray"` // 是否启用系统托盘
	StartAtLogin     bool   `json:"startAtLogin"`     // 开机启动设置

	// 全局热键设置
	EnableGlobalHotkey bool        `json:"enableGlobalHotkey"` // 是否启用全局热键
	GlobalHotkey       HotkeyCombo `json:"globalHotkey"`       // 全局热键组合
}

// HotkeyCombo 热键组合定义
type HotkeyCombo struct {
	Ctrl  bool   `json:"ctrl"`  // Ctrl键
	Shift bool   `json:"shift"` // Shift键
	Alt   bool   `json:"alt"`   // Alt键
	Win   bool   `json:"win"`   // Win键
	Key   string `json:"key"`   // 主键（如 'X', 'F1' 等）
}

// EditingConfig 编辑设置配置
type EditingConfig struct {
	// 字体设置
	FontSize   int     `json:"fontSize"`   // 字体大小
	FontFamily string  `json:"fontFamily"` // 字体族
	FontWeight string  `json:"fontWeight"` // 字体粗细
	LineHeight float64 `json:"lineHeight"` // 行高

	// Tab设置
	EnableTabIndent bool    `json:"enableTabIndent"` // 是否启用Tab缩进
	TabSize         int     `json:"tabSize"`         // Tab大小
	TabType         TabType `json:"tabType"`         // Tab类型（空格或Tab）

	// 保存选项
	AutoSaveDelay int `json:"autoSaveDelay"` // 自动保存延迟（毫秒）
}

// AppearanceConfig 外观设置配置
type AppearanceConfig struct {
	Language    LanguageType    `json:"language"`    // 界面语言
	SystemTheme SystemThemeType `json:"systemTheme"` // 系统界面主题
}

// UpdatesConfig 更新设置配置
type UpdatesConfig struct {
	// 预留给未来的更新配置
}

// AppConfig 应用配置 - 按照前端设置页面分类组织
type AppConfig struct {
	General    GeneralConfig    `json:"general"`    // 通用设置
	Editing    EditingConfig    `json:"editing"`    // 编辑设置
	Appearance AppearanceConfig `json:"appearance"` // 外观设置
	Updates    UpdatesConfig    `json:"updates"`    // 更新设置
	Metadata   ConfigMetadata   `json:"metadata"`   // 配置元数据
}

// ConfigMetadata 配置元数据
type ConfigMetadata struct {
	LastUpdated string `json:"lastUpdated"` // 最后更新时间
}

// NewDefaultAppConfig 创建默认应用配置
func NewDefaultAppConfig() *AppConfig {
	return &AppConfig{
		General: GeneralConfig{
			AlwaysOnTop:        false,
			DataPath:           "./data",
			EnableSystemTray:   true,
			StartAtLogin:       false,
			EnableGlobalHotkey: false,
			GlobalHotkey: HotkeyCombo{
				Ctrl:  false,
				Shift: false,
				Alt:   true,
				Win:   false,
				Key:   "X",
			},
		},
		Editing: EditingConfig{
			// 字体设置
			FontSize:   13,
			FontFamily: `"HarmonyOS Sans SC", "HarmonyOS Sans", "Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, sans-serif`,
			FontWeight: "normal",
			LineHeight: 1.5,
			// Tab设置
			EnableTabIndent: true,
			TabSize:         4,
			TabType:         TabTypeSpaces,
			// 保存选项
			AutoSaveDelay: 5000, // 5秒后自动保存
		},
		Appearance: AppearanceConfig{
			Language:    LangZhCN,
			SystemTheme: SystemThemeAuto, // 默认使用深色系统主题
		},
		Updates: UpdatesConfig{},
		Metadata: ConfigMetadata{
			LastUpdated: time.Now().Format(time.RFC3339),
		},
	}
}
