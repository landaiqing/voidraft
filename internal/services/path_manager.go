package services

import (
	"os"
	"path/filepath"
)

// PathManager 路径管理器
type PathManager struct {
	configDir    string // 配置目录
	settingsPath string // 设置文件路径
	keybindsPath string // 快捷键配置文件路径
}

// NewPathManager 创建新的路径管理器
func NewPathManager() *PathManager {
	// 获取用户配置目录
	userConfigDir, err := os.UserConfigDir()
	if err != nil {
		// 如果获取失败，使用当前目录
		userConfigDir, _ = os.Getwd()
	}

	// 设置voidraft配置目录
	configDir := filepath.Join(userConfigDir, ".voidraft", "config")

	return &PathManager{
		configDir:    configDir,
		settingsPath: filepath.Join(configDir, "settings.json"),
		keybindsPath: filepath.Join(configDir, "keybindings.json"),
	}
}

// GetConfigDir 获取配置目录路径
func (pm *PathManager) GetConfigDir() string {
	return pm.configDir
}

// GetSettingsPath 获取设置文件路径
func (pm *PathManager) GetSettingsPath() string {
	return pm.settingsPath
}

// GetKeybindsPath 获取快捷键配置文件路径
func (pm *PathManager) GetKeybindsPath() string {
	return pm.keybindsPath
}

// EnsureConfigDir 确保配置目录存在
func (pm *PathManager) EnsureConfigDir() error {
	return os.MkdirAll(pm.configDir, 0755)
}

// GetConfigName 获取配置文件
func (pm *PathManager) GetConfigName() string {
	return "settings"
}

// GetKeybindsName 获取快捷键配置文件名
func (pm *PathManager) GetKeybindsName() string {
	return "keybindings"
}
