package models

import (
	"os"
	"path/filepath"
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

// GeneralConfig 通用设置配置
type GeneralConfig struct {
	AlwaysOnTop bool   `json:"alwaysOnTop" yaml:"always_on_top" mapstructure:"always_on_top"` // 窗口是否置顶
	DataPath    string `json:"dataPath" yaml:"data_path" mapstructure:"data_path"`            // 数据存储路径

	// 全局热键设置
	EnableGlobalHotkey bool        `json:"enableGlobalHotkey" yaml:"enable_global_hotkey" mapstructure:"enable_global_hotkey"` // 是否启用全局热键
	GlobalHotkey       HotkeyCombo `json:"globalHotkey" yaml:"global_hotkey" mapstructure:"global_hotkey"`                     // 全局热键组合
}

// HotkeyCombo 热键组合定义
type HotkeyCombo struct {
	Ctrl  bool   `json:"ctrl" yaml:"ctrl" mapstructure:"ctrl"`    // Ctrl键
	Shift bool   `json:"shift" yaml:"shift" mapstructure:"shift"` // Shift键
	Alt   bool   `json:"alt" yaml:"alt" mapstructure:"alt"`       // Alt键
	Win   bool   `json:"win" yaml:"win" mapstructure:"win"`       // Win键
	Key   string `json:"key" yaml:"key" mapstructure:"key"`       // 主键（如 'X', 'F1' 等）
}

// EditingConfig 编辑设置配置
type EditingConfig struct {
	// 字体设置
	FontSize   int     `json:"fontSize" yaml:"font_size" mapstructure:"font_size"`       // 字体大小
	FontFamily string  `json:"fontFamily" yaml:"font_family" mapstructure:"font_family"` // 字体族
	FontWeight string  `json:"fontWeight" yaml:"font_weight" mapstructure:"font_weight"` // 字体粗细
	LineHeight float64 `json:"lineHeight" yaml:"line_height" mapstructure:"line_height"` // 行高

	// Tab设置
	EnableTabIndent bool    `json:"enableTabIndent" yaml:"enable_tab_indent" mapstructure:"enable_tab_indent"` // 是否启用Tab缩进
	TabSize         int     `json:"tabSize" yaml:"tab_size" mapstructure:"tab_size"`                           // Tab大小
	TabType         TabType `json:"tabType" yaml:"tab_type" mapstructure:"tab_type"`                           // Tab类型（空格或Tab）

	// 保存选项
	AutoSaveDelay int `json:"autoSaveDelay" yaml:"auto_save_delay" mapstructure:"auto_save_delay"` // 自动保存延迟（毫秒）
}

// AppearanceConfig 外观设置配置
type AppearanceConfig struct {
	Language LanguageType `json:"language" yaml:"language" mapstructure:"language"` // 界面语言
}

// KeyBindingsConfig 快捷键设置配置
type KeyBindingsConfig struct {
	// 预留给未来的快捷键配置
}

// UpdatesConfig 更新设置配置
type UpdatesConfig struct {
	// 预留给未来的更新配置
}

// AppConfig 应用配置 - 按照前端设置页面分类组织
type AppConfig struct {
	General     GeneralConfig     `json:"general" yaml:"general" mapstructure:"general"`               // 通用设置
	Editing     EditingConfig     `json:"editing" yaml:"editing" mapstructure:"editing"`               // 编辑设置
	Appearance  AppearanceConfig  `json:"appearance" yaml:"appearance" mapstructure:"appearance"`      // 外观设置
	KeyBindings KeyBindingsConfig `json:"keyBindings" yaml:"key_bindings" mapstructure:"key_bindings"` // 快捷键设置
	Updates     UpdatesConfig     `json:"updates" yaml:"updates" mapstructure:"updates"`               // 更新设置
	Metadata    ConfigMetadata    `json:"metadata" yaml:"metadata" mapstructure:"metadata"`            // 配置元数据
}

// ConfigMetadata 配置元数据
type ConfigMetadata struct {
	Version     string    `json:"version" yaml:"version" mapstructure:"version"`               // 配置版本
	LastUpdated time.Time `json:"lastUpdated" yaml:"last_updated" mapstructure:"last_updated"` // 最后更新时间
}

// NewDefaultAppConfig 创建默认应用配置
func NewDefaultAppConfig() *AppConfig {
	// 获取当前工作目录
	currentDir, err := os.Getwd()
	if err != nil {
		currentDir = "."
	}

	// 默认路径配置 - 使用当前目录
	dataDir := filepath.Join(currentDir, "data")

	return &AppConfig{
		General: GeneralConfig{
			AlwaysOnTop:        false,
			DataPath:           dataDir,
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
			Language: LangZhCN,
		},
		KeyBindings: KeyBindingsConfig{
			// 预留给未来的快捷键配置
		},
		Updates: UpdatesConfig{
			// 预留给未来的更新配置
		},
		Metadata: ConfigMetadata{
			Version:     "1.0.0",
			LastUpdated: time.Now(),
		},
	}
}
