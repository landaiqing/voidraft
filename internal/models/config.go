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

// EncodingType 定义文件编码格式类型
type EncodingType string

const (
	// EncodingUTF8 UTF-8编码
	EncodingUTF8 EncodingType = "UTF-8"
	// EncodingUTF8BOM UTF-8带BOM编码
	EncodingUTF8BOM EncodingType = "UTF-8-BOM"
	// EncodingUTF16LE UTF-16小端编码
	EncodingUTF16LE EncodingType = "UTF-16 LE"
	// EncodingUTF16BE UTF-16大端编码
	EncodingUTF16BE EncodingType = "UTF-16 BE"
	// EncodingISO88591 ISO-8859-1编码
	EncodingISO88591 EncodingType = "ISO-8859-1"
	// EncodingGB18030 GB18030编码
	EncodingGB18030 EncodingType = "GB18030"
	// EncodingGBK GBK编码
	EncodingGBK EncodingType = "GBK"
	// EncodingBig5 Big5编码
	EncodingBig5 EncodingType = "Big5"
)

// EditorConfig 定义编辑器配置
type EditorConfig struct {
	FontSize        int          `json:"fontSize"`        // 字体大小
	Encoding        EncodingType `json:"encoding"`        // 文件保存的编码
	EnableTabIndent bool         `json:"enableTabIndent"` // 是否启用Tab缩进
	TabSize         int          `json:"tabSize"`         // Tab大小
	TabType         TabType      `json:"tabType"`         // Tab类型（空格或Tab）
	Language        LanguageType `json:"language"`        // 界面语言
}

// LanguageType 语言类型定义
type LanguageType string

const (
	// LangZhCN 中文简体
	LangZhCN LanguageType = "zh-CN"
	// LangEnUS 英文-美国
	LangEnUS LanguageType = "en-US"
)

// PathConfig 定义配置文件路径相关配置
type PathConfig struct {
	RootDir    string `json:"rootDir"`    // 根目录
	ConfigPath string `json:"configPath"` // 配置文件路径
}

// AppConfig 应用配置
type AppConfig struct {
	Editor   EditorConfig   `json:"editor"`   // 编辑器配置
	Paths    PathConfig     `json:"paths"`    // 路径配置
	Metadata ConfigMetadata `json:"metadata"` // 配置元数据
}

// ConfigMetadata 配置元数据
type ConfigMetadata struct {
	Version     string    `json:"version"`     // 配置版本
	LastUpdated time.Time `json:"lastUpdated"` // 最后更新时间
}

// NewDefaultAppConfig 创建默认应用配置
func NewDefaultAppConfig() *AppConfig {
	return &AppConfig{
		Editor: EditorConfig{
			FontSize:        13,
			Encoding:        EncodingUTF8,
			EnableTabIndent: true,
			TabSize:         4,
			TabType:         TabTypeSpaces,
			Language:        LangZhCN,
		},
		Paths: PathConfig{
			RootDir:    ".voidraft",
			ConfigPath: "config/config.json",
		},
		Metadata: ConfigMetadata{
			Version:     "1.0.0",
			LastUpdated: time.Now(),
		},
	}
}
