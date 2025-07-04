package services

import (
	"os"
	"path/filepath"
)

// PathManager 路径管理器
type PathManager struct {
	configDir      string // 配置目录
	settingsPath   string // 设置文件路径
	keybindsPath   string // 快捷键配置文件路径
	extensionsPath string // 扩展配置文件路径
}

// NewPathManager 创建新的路径管理器
func NewPathManager() *PathManager {
	// 获取用户配置目录
	userConfigDir, err := os.UserHomeDir()
	if err != nil {
		// 如果获取失败，使用当前目录
		userConfigDir, _ = os.Getwd()
	}

	// 设置voidraft配置目录
	configDir := filepath.Join(userConfigDir, ".voidraft", "config")

	return &PathManager{
		configDir:      configDir,
		settingsPath:   filepath.Join(configDir, "settings.json"),
		keybindsPath:   filepath.Join(configDir, "keybindings.json"),
		extensionsPath: filepath.Join(configDir, "extensions.json"),
	}
}

// GetSettingsPath 获取设置文件路径
func (pm *PathManager) GetSettingsPath() string {
	return pm.settingsPath
}

// GetKeybindsPath 获取快捷键配置文件路径
func (pm *PathManager) GetKeybindsPath() string {
	return pm.keybindsPath
}

// GetConfigDir 获取配置目录路径
func (pm *PathManager) GetConfigDir() string {
	return pm.configDir
}

// GetExtensionsPath 获取扩展配置文件路径
func (pm *PathManager) GetExtensionsPath() string {
	return pm.extensionsPath
}

// EnsureConfigDir 确保配置目录存在
func (pm *PathManager) EnsureConfigDir() error {
	return os.MkdirAll(pm.configDir, 0755)
}
