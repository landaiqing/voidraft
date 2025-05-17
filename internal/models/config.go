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

// SaveOptions 保存选项
type SaveOptions struct {
	// 自动保存延迟（毫秒）- 内容变更后多久自动保存
	AutoSaveDelay int `json:"autoSaveDelay"`
	// 变更字符阈值，超过此阈值立即触发保存
	ChangeThreshold int `json:"changeThreshold"`
	// 最小保存间隔（毫秒）- 两次保存之间的最小时间间隔，避免频繁IO
	MinSaveInterval int `json:"minSaveInterval"`
}

// DocumentConfig 定义文档配置
type DocumentConfig struct {
	SaveOptions SaveOptions `json:"saveOptions"` // 详细保存选项
}

// EditorConfig 定义编辑器配置
type EditorConfig struct {
	FontSize        int          `json:"fontSize"`        // 字体大小
	EnableTabIndent bool         `json:"enableTabIndent"` // 是否启用Tab缩进
	TabSize         int          `json:"tabSize"`         // Tab大小
	TabType         TabType      `json:"tabType"`         // Tab类型（空格或Tab）
	Language        LanguageType `json:"language"`        // 界面语言
	AlwaysOnTop     bool         `json:"alwaysOnTop"`     // 窗口是否置顶
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
	LogPath  string `json:"logPath"`  // 日志文件路径
	DataPath string `json:"dataPath"` // 数据存储路径
}

// AppConfig 应用配置 - 包含业务配置和路径配置
type AppConfig struct {
	Editor   EditorConfig   `json:"editor"`   // 编辑器配置
	Document DocumentConfig `json:"document"` // 文档配置
	Paths    PathsConfig    `json:"paths"`    // 路径配置
	Metadata ConfigMetadata `json:"metadata"` // 配置元数据
}

// ConfigMetadata 配置元数据
type ConfigMetadata struct {
	Version     string    `json:"version"`     // 配置版本
	LastUpdated time.Time `json:"lastUpdated"` // 最后更新时间
}

// NewDefaultAppConfig 创建默认应用配置
func NewDefaultAppConfig() *AppConfig {
	// 获取用户主目录
	homePath, err := os.UserHomeDir()
	if err != nil {
		homePath = "."
	}

	// 默认路径配置
	rootDir := filepath.Join(homePath, ".voidraft")
	dataDir := filepath.Join(rootDir, "data")

	return &AppConfig{
		Editor: EditorConfig{
			FontSize:        13,
			EnableTabIndent: true,
			TabSize:         4,
			TabType:         TabTypeSpaces,
			Language:        LangZhCN,
			AlwaysOnTop:     false,
		},
		Document: DocumentConfig{
			SaveOptions: SaveOptions{
				AutoSaveDelay:   5000, // 5秒后自动保存
				ChangeThreshold: 500,  // 500个字符变更触发保存
				MinSaveInterval: 1000, // 最小间隔1000毫秒
			},
		},
		Paths: PathsConfig{
			LogPath:  filepath.Join(rootDir, "logs"),
			DataPath: dataDir,
		},
		Metadata: ConfigMetadata{
			Version:     "1.0.0",
			LastUpdated: time.Now(),
		},
	}
}
