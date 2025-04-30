package config

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// ConfigLocator 配置定位器接口
type ConfigLocator interface {
	// GetConfigPath 获取配置文件路径
	GetConfigPath() string

	// SetConfigPath 设置配置文件路径
	SetConfigPath(string) error
}

// FileConfigLocator 基于文件的配置定位器
type FileConfigLocator struct {
	locationFile string
	defaultPath  string
	logger       *log.LoggerService
	mu           sync.RWMutex
}

// NewFileConfigLocator 创建文件配置定位器
func NewFileConfigLocator(locationFile, defaultPath string, logger *log.LoggerService) *FileConfigLocator {
	if logger == nil {
		logger = log.New()
	}

	return &FileConfigLocator{
		locationFile: locationFile,
		defaultPath:  defaultPath,
		logger:       logger,
	}
}

// GetDefaultConfigPath 获取默认配置路径
func GetDefaultConfigPath() string {
	homePath, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(".voidraft", "config", "config.json")
	}
	return filepath.Join(homePath, ".voidraft", "config", "config.json")
}

// GetConfigPath 获取配置文件路径
func (fcl *FileConfigLocator) GetConfigPath() string {
	fcl.mu.RLock()
	defer fcl.mu.RUnlock()

	// 尝试从位置文件读取
	if _, err := os.Stat(fcl.locationFile); err == nil {
		if data, err := os.ReadFile(fcl.locationFile); err == nil && len(data) > 0 {
			path := string(data)

			// 验证路径目录是否存在
			if _, err := os.Stat(filepath.Dir(path)); err == nil {
				fcl.logger.Info("ConfigLocator: Using stored path", "path", path)
				return path
			}

			fcl.logger.Error("ConfigLocator: Stored path invalid, using default", "path", path)
		}
	}

	// 返回默认路径
	fcl.logger.Info("ConfigLocator: Using default path", "path", fcl.defaultPath)
	return fcl.defaultPath
}

// SetConfigPath 设置配置文件路径
func (fcl *FileConfigLocator) SetConfigPath(path string) error {
	fcl.mu.Lock()
	defer fcl.mu.Unlock()

	// 确保位置文件目录存在
	if err := os.MkdirAll(filepath.Dir(fcl.locationFile), 0755); err != nil {
		return fmt.Errorf("failed to create location directory: %w", err)
	}

	// 写入位置文件
	if err := os.WriteFile(fcl.locationFile, []byte(path), 0644); err != nil {
		return fmt.Errorf("failed to write location file: %w", err)
	}

	fcl.logger.Info("ConfigLocator: Updated config path", "path", path)
	return nil
}
