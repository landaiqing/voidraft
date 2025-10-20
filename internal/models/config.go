package models

import (
	"os"
	"path/filepath"
	"time"
	"voidraft/internal/version"
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

// UpdateSourceType 更新源类型
type UpdateSourceType string

const (
	// UpdateSourceGithub GitHub更新源
	UpdateSourceGithub UpdateSourceType = "github"
	// UpdateSourceGitea Gitea更新源
	UpdateSourceGitea UpdateSourceType = "gitea"
)

// GithubConfig GitHub配置
type GithubConfig struct {
	Owner string `json:"owner"` // 仓库所有者
	Repo  string `json:"repo"`  // 仓库名称
}

// GiteaConfig Gitea配置
type GiteaConfig struct {
	BaseURL string `json:"baseURL"` // Gitea服务器URL
	Owner   string `json:"owner"`   // 仓库所有者
	Repo    string `json:"repo"`    // 仓库名称
}

// GeneralConfig 通用设置配置
type GeneralConfig struct {
	AlwaysOnTop      bool   `json:"alwaysOnTop"`      // 窗口是否置顶
	DataPath         string `json:"dataPath"`         // 数据存储路径
	EnableSystemTray bool   `json:"enableSystemTray"` // 是否启用系统托盘
	StartAtLogin     bool   `json:"startAtLogin"`     // 开机启动设置

	// 窗口吸附设置
	EnableWindowSnap bool `json:"enableWindowSnap"` // 是否启用窗口吸附功能（阈值现在是自适应的）

	// 全局热键设置
	EnableGlobalHotkey bool        `json:"enableGlobalHotkey"` // 是否启用全局热键
	GlobalHotkey       HotkeyCombo `json:"globalHotkey"`       // 全局热键组合

	// 界面设置
	EnableLoadingAnimation bool `json:"enableLoadingAnimation"` // 是否启用加载动画
	EnableTabs             bool `json:"enableTabs"`             // 是否启用标签页模式
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
	Language     LanguageType    `json:"language"`     // 界面语言
	SystemTheme  SystemThemeType `json:"systemTheme"`  // 系统界面主题
	CurrentTheme string          `json:"currentTheme"` // 当前选择的预设主题名称
}

// UpdatesConfig 更新设置配置
type UpdatesConfig struct {
	Version            string           `json:"version"`            // 当前版本号
	AutoUpdate         bool             `json:"autoUpdate"`         // 是否自动更新
	PrimarySource      UpdateSourceType `json:"primarySource"`      // 主要更新源
	BackupSource       UpdateSourceType `json:"backupSource"`       // 备用更新源
	BackupBeforeUpdate bool             `json:"backupBeforeUpdate"` // 更新前是否备份
	UpdateTimeout      int              `json:"updateTimeout"`      // 更新超时时间(秒)
	Github             GithubConfig     `json:"github"`             // GitHub配置
	Gitea              GiteaConfig      `json:"gitea"`              // Gitea配置
}

// AppConfig 应用配置 - 按照前端设置页面分类组织
type AppConfig struct {
	General    GeneralConfig    `json:"general"`    // 通用设置
	Editing    EditingConfig    `json:"editing"`    // 编辑设置
	Appearance AppearanceConfig `json:"appearance"` // 外观设置
	Updates    UpdatesConfig    `json:"updates"`    // 更新设置
	Backup     GitBackupConfig  `json:"backup"`     // Git备份设置
	Metadata   ConfigMetadata   `json:"metadata"`   // 配置元数据
}

// ConfigMetadata 配置元数据
type ConfigMetadata struct {
	LastUpdated string `json:"lastUpdated"` // 最后更新时间
	Version     string `json:"version"`     // 配置版本号
}

// NewDefaultAppConfig 创建默认应用配置
func NewDefaultAppConfig() *AppConfig {

	currentDir, _ := os.UserHomeDir()
	dataDir := filepath.Join(currentDir, ".voidraft", "data")

	return &AppConfig{
		General: GeneralConfig{
			AlwaysOnTop:            false,
			DataPath:               dataDir,
			EnableSystemTray:       true,
			StartAtLogin:           false,
			EnableWindowSnap:       true, // 默认启用窗口吸附
			EnableGlobalHotkey:     false,
			EnableLoadingAnimation: true,  // 默认启用加载动画
			EnableTabs:             false, // 默认不启用标签页模式
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
			FontFamily: `"HarmonyOS"`,
			FontWeight: "400",
			LineHeight: 1.5,
			// Tab设置
			EnableTabIndent: true,
			TabSize:         4,
			TabType:         TabTypeTab,
			// 保存选项
			AutoSaveDelay: 2000,
		},
		Appearance: AppearanceConfig{
			Language:     LangEnUS,
			SystemTheme:  SystemThemeAuto,
			CurrentTheme: "default-dark", // 默认使用 default-dark 主题
		},
		Updates: UpdatesConfig{
			Version:            version.Version,
			AutoUpdate:         true,
			PrimarySource:      UpdateSourceGitea,
			BackupSource:       UpdateSourceGithub,
			BackupBeforeUpdate: true,
			UpdateTimeout:      30,
			Github: GithubConfig{
				Owner: "landaiqing",
				Repo:  "voidraft",
			},
			Gitea: GiteaConfig{
				BaseURL: "https://git.landaiqing.cn",
				Owner:   "landaiqing",
				Repo:    "voidraft",
			},
		},
		Backup: GitBackupConfig{
			Enabled:        false,
			RepoURL:        "",
			AuthMethod:     UserPass,
			Username:       "",
			Password:       "",
			Token:          "",
			SSHKeyPath:     "",
			BackupInterval: 60,
			AutoBackup:     false,
		},
		Metadata: ConfigMetadata{
			LastUpdated: time.Now().Format(time.RFC3339),
			Version:     version.Version,
		},
	}
}

// GetVersion 获取配置版本
func (ac *AppConfig) GetVersion() string {
	return ac.Metadata.Version
}

// SetVersion 设置配置版本
func (ac *AppConfig) SetVersion(version string) {
	ac.Metadata.Version = version
}

// SetLastUpdated 设置最后更新时间
func (ac *AppConfig) SetLastUpdated(timeStr string) {
	ac.Metadata.LastUpdated = timeStr
}

// GetDefaultConfig 获取默认配置
func (ac *AppConfig) GetDefaultConfig() any {
	return NewDefaultAppConfig()
}
