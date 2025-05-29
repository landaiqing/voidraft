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

// DocumentConfig 定义文档配置
type DocumentConfig struct {
	// 自动保存延迟（毫秒）- 内容变更后多久自动保存
	AutoSaveDelay int `json:"autoSaveDelay" yaml:"auto_save_delay" mapstructure:"auto_save_delay"`
	// 变更字符阈值，超过此阈值立即触发保存
	ChangeThreshold int `json:"changeThreshold" yaml:"change_threshold" mapstructure:"change_threshold"`
	// 最小保存间隔（毫秒）- 两次保存之间的最小时间间隔，避免频繁IO
	MinSaveInterval int `json:"minSaveInterval" yaml:"min_save_interval" mapstructure:"min_save_interval"`
}

// EditorConfig 定义编辑器配置
type EditorConfig struct {
	FontSize        int          `json:"fontSize" yaml:"font_size" mapstructure:"font_size"`                        // 字体大小
	FontFamily      string       `json:"fontFamily" yaml:"font_family" mapstructure:"font_family"`                  // 字体族
	FontWeight      string       `json:"fontWeight" yaml:"font_weight" mapstructure:"font_weight"`                  // 字体粗细
	LineHeight      float64      `json:"lineHeight" yaml:"line_height" mapstructure:"line_height"`                  // 行高
	EnableTabIndent bool         `json:"enableTabIndent" yaml:"enable_tab_indent" mapstructure:"enable_tab_indent"` // 是否启用Tab缩进
	TabSize         int          `json:"tabSize" yaml:"tab_size" mapstructure:"tab_size"`                           // Tab大小
	TabType         TabType      `json:"tabType" yaml:"tab_type" mapstructure:"tab_type"`                           // Tab类型（空格或Tab）
	Language        LanguageType `json:"language" yaml:"language" mapstructure:"language"`                          // 界面语言
	AlwaysOnTop     bool         `json:"alwaysOnTop" yaml:"always_on_top" mapstructure:"always_on_top"`             // 窗口是否置顶
}

// LanguageType 语言类型定义
type LanguageType string

const (
	// LangZhCN 中文简体
	LangZhCN LanguageType = "zh-CN"
	// LangEnUS 英文-美国
	LangEnUS LanguageType = "en-US"
)

// PathsConfig 路径配置集合
type PathsConfig struct {
	DataPath string `json:"dataPath" yaml:"data_path" mapstructure:"data_path"` // 数据存储路径
}

// AppConfig 应用配置 - 包含业务配置和路径配置
type AppConfig struct {
	Editor   EditorConfig   `json:"editor" yaml:"editor" mapstructure:"editor"`       // 编辑器配置
	Document DocumentConfig `json:"document" yaml:"document" mapstructure:"document"` // 文档配置
	Paths    PathsConfig    `json:"paths" yaml:"paths" mapstructure:"paths"`          // 路径配置
	Metadata ConfigMetadata `json:"metadata" yaml:"metadata" mapstructure:"metadata"` // 配置元数据
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
		Editor: EditorConfig{
			FontSize:        13,
			FontFamily:      `"HarmonyOS Sans SC", "HarmonyOS Sans", "Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, sans-serif`,
			FontWeight:      "normal",
			LineHeight:      1.5,
			EnableTabIndent: true,
			TabSize:         4,
			TabType:         TabTypeSpaces,
			Language:        LangZhCN,
			AlwaysOnTop:     false,
		},
		Document: DocumentConfig{
			AutoSaveDelay:   5000, // 5秒后自动保存
			ChangeThreshold: 500,  // 500个字符变更触发保存
			MinSaveInterval: 1000, // 最小间隔1000毫秒
		},
		Paths: PathsConfig{
			DataPath: dataDir,
		},
		Metadata: ConfigMetadata{
			Version:     "1.0.0",
			LastUpdated: time.Now(),
		},
	}
}
