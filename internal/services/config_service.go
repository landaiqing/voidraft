package services

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
	"voidraft/internal/models"
)

// ConfigService 提供配置管理功能
type ConfigService struct {
	fileService *FileService
	configPath  string
	rootDir     string
	homePath    string
	config      *models.AppConfig
	lastModTime time.Time // 上次读取配置文件的修改时间
}

// NewConfigService 创建新的配置服务实例
func NewConfigService(fileService *FileService) *ConfigService {
	// 获取用户主目录
	homePath, err := os.UserHomeDir()
	if err != nil {
		log.Printf("Failed to get user home directory: %v", err)
		homePath = "."
	}

	log.Printf("User home directory: %s", homePath)

	// 创建默认配置
	defaultConfig := models.NewDefaultAppConfig()

	// 构造服务实例
	service := &ConfigService{
		fileService: fileService,
		rootDir:     defaultConfig.Paths.RootDir,
		configPath:  defaultConfig.Paths.ConfigPath,
		homePath:    homePath,
		config:      defaultConfig,
	}

	// 初始化配置目录和文件
	service.initializeConfig()

	return service
}

// initializeConfig 初始化配置目录和文件
func (cs *ConfigService) initializeConfig() {
	// 确保配置目录存在
	dirPath := filepath.Join(cs.homePath, cs.rootDir)
	log.Printf("Creating config directory: %s", dirPath)

	// 确保主目录存在
	if err := cs.fileService.EnsureDir(dirPath); err != nil {
		log.Printf("Failed to create config directory: %v", err)
		return
	}

	// 确保配置文件所在目录存在
	configDir := filepath.Dir(cs.GetFullConfigPath())
	if configDir != dirPath {
		if err := cs.fileService.EnsureDir(configDir); err != nil {
			log.Printf("Failed to create config file directory: %v", err)
			return
		}
	}

	// 检查配置文件是否存在
	configFilePath := cs.GetFullConfigPath()
	log.Printf("Config file path: %s", configFilePath)

	if !cs.fileService.FileExists(configFilePath) {
		log.Printf("Config file not found, creating default config")
		// 创建默认配置文件
		defaultConfig := models.NewDefaultAppConfig()
		if err := cs.saveAppConfig(defaultConfig); err != nil {
			log.Printf("Failed to save default config: %v", err)
		}
	} else {
		// 加载现有配置
		log.Printf("Loading existing config file")
		existingConfig, modTime, err := cs.loadAppConfigWithModTime()
		if err != nil {
			log.Printf("Failed to load existing config, using default: %v", err)
		} else {
			cs.config = existingConfig
			cs.lastModTime = modTime
		}
	}
}

// GetFullConfigPath 获取完整的配置文件路径
func (cs *ConfigService) GetFullConfigPath() string {
	return filepath.Join(cs.homePath, cs.rootDir, cs.configPath)
}

// mergeConfigs 合并两个配置，实现智能合并策略
func (cs *ConfigService) mergeConfigs(currentConfig *models.AppConfig, existingData []byte) (*models.AppConfig, error) {
	// 解析磁盘配置
	var diskConfig models.AppConfig
	if err := json.Unmarshal(existingData, &diskConfig); err != nil {
		return nil, fmt.Errorf("failed to parse existing config: %w", err)
	}

	// 创建合并后的配置（基于磁盘配置）
	mergedConfig := diskConfig

	// ===== 1. 编辑器配置合并策略 =====
	// 编辑器配置是用户最直接的操作，总是保留当前配置
	log.Printf("Merge: Preserving current editor config")
	mergedConfig.Editor = currentConfig.Editor

	// ===== 2. 路径配置合并策略 =====
	// 如果当前实例已经修改了根目录（非默认值），保留当前配置
	defaultConfig := models.NewDefaultAppConfig()

	if currentConfig.Paths.RootDir != defaultConfig.Paths.RootDir &&
		currentConfig.Paths.RootDir != diskConfig.Paths.RootDir {
		log.Printf("Merge: Using custom root directory from current config: %s", currentConfig.Paths.RootDir)
		mergedConfig.Paths.RootDir = currentConfig.Paths.RootDir
	} else {
		log.Printf("Merge: Using root directory from disk config: %s", diskConfig.Paths.RootDir)
	}

	// 对配置路径采用相同策略
	if currentConfig.Paths.ConfigPath != defaultConfig.Paths.ConfigPath &&
		currentConfig.Paths.ConfigPath != diskConfig.Paths.ConfigPath {
		log.Printf("Merge: Using custom config path from current config: %s", currentConfig.Paths.ConfigPath)
		mergedConfig.Paths.ConfigPath = currentConfig.Paths.ConfigPath
	} else {
		log.Printf("Merge: Using config path from disk config: %s", diskConfig.Paths.ConfigPath)
	}

	// ===== 3. 元数据合并策略 =====
	// 版本号使用较高的版本
	if compareVersions(currentConfig.Metadata.Version, diskConfig.Metadata.Version) > 0 {
		log.Printf("Merge: Using higher version from current config: %s", currentConfig.Metadata.Version)
		mergedConfig.Metadata.Version = currentConfig.Metadata.Version
	} else {
		log.Printf("Merge: Using version from disk config: %s", diskConfig.Metadata.Version)
	}

	// 更新时间总是使用当前时间
	mergedConfig.Metadata.LastUpdated = time.Now()

	// ===== 4. 其他配置项 =====

	log.Printf("Merge: Completed using comprehensive merge strategy")
	return &mergedConfig, nil
}

// compareVersions 比较两个版本号
// 返回: 1 如果v1>v2, 0 如果v1=v2, -1 如果v1<v2
func compareVersions(v1, v2 string) int {
	// 分割版本号
	parts1 := strings.Split(v1, ".")
	parts2 := strings.Split(v2, ".")

	// 确保两个版本号有相同数量的部分
	for len(parts1) < len(parts2) {
		parts1 = append(parts1, "0")
	}
	for len(parts2) < len(parts1) {
		parts2 = append(parts2, "0")
	}

	// 逐个比较各部分
	for i := 0; i < len(parts1); i++ {
		num1, err1 := strconv.Atoi(parts1[i])
		num2, err2 := strconv.Atoi(parts2[i])

		// 如果有无法解析为数字的部分，按字符串比较
		if err1 != nil || err2 != nil {
			if parts1[i] > parts2[i] {
				return 1
			} else if parts1[i] < parts2[i] {
				return -1
			}
			continue
		}

		// 数值比较
		if num1 > num2 {
			return 1
		} else if num1 < num2 {
			return -1
		}
	}

	// 所有部分都相等
	return 0
}

// loadAppConfigWithModTime 从文件加载配置，同时返回文件修改时间
func (cs *ConfigService) loadAppConfigWithModTime() (*models.AppConfig, time.Time, error) {
	config := &models.AppConfig{}
	configPath := cs.GetFullConfigPath()

	// 先获取文件修改时间
	modTime, err := cs.fileService.GetFileModTime(configPath)
	if err != nil {
		return nil, time.Time{}, fmt.Errorf("failed to get config file modification time: %w", err)
	}

	// 然后加载文件内容
	if err := cs.fileService.LoadJSON(configPath, config); err != nil {
		return nil, time.Time{}, fmt.Errorf("failed to load config file: %w", err)
	}

	return config, modTime, nil
}

// handleConfigConflict 处理配置冲突的回调函数
func (cs *ConfigService) handleConfigConflict(existingData []byte) (interface{}, error) {
	// 如果没有当前配置，无法合并
	if cs.config == nil {
		return nil, fmt.Errorf("no current config to merge")
	}

	// 合并配置
	mergedConfig, err := cs.mergeConfigs(cs.config, existingData)
	if err != nil {
		return nil, err
	}

	// 更新内存中的配置
	cs.config = mergedConfig

	return mergedConfig, nil
}

// 内部方法：从文件加载配置
func (cs *ConfigService) loadAppConfig() (*models.AppConfig, error) {
	config, modTime, err := cs.loadAppConfigWithModTime()
	if err != nil {
		return nil, err
	}

	// 更新最后修改时间
	cs.lastModTime = modTime
	return config, nil
}

// 内部方法：保存配置到文件
func (cs *ConfigService) saveAppConfig(config *models.AppConfig) error {
	// 更新配置元数据
	config.Metadata.LastUpdated = time.Now()

	// 保存到文件，使用乐观并发控制
	configPath := cs.GetFullConfigPath()
	log.Printf("saveAppConfig: Saving to %s with last mod time: %s",
		configPath, cs.lastModTime.Format(time.RFC3339))

	err := cs.fileService.SaveJSONWithCheck(
		configPath,
		config,
		cs.lastModTime,
		cs.handleConfigConflict,
	)

	if err != nil {
		return fmt.Errorf("failed to save config file: %w", err)
	}

	// 更新内存中的配置和最后修改时间
	cs.config = config

	// 获取最新的修改时间
	newModTime, err := cs.fileService.GetFileModTime(configPath)
	if err == nil {
		cs.lastModTime = newModTime
	}

	return nil
}

// GetAppConfig 获取应用配置
func (cs *ConfigService) GetAppConfig() (*models.AppConfig, error) {
	// 返回内存中的配置副本
	if cs.config != nil {
		return cs.config, nil
	}

	// 从文件加载
	config, err := cs.loadAppConfig()
	if err != nil {
		log.Printf("GetAppConfig: Failed to load config: %v", err)
		// 使用默认配置
		defaultConfig := models.NewDefaultAppConfig()
		cs.config = defaultConfig

		// 保存默认配置到文件
		if err := cs.saveAppConfig(defaultConfig); err != nil {
			log.Printf("GetAppConfig: Failed to save default config: %v", err)
		}

		return defaultConfig, nil
	}

	// 更新内存中的配置
	cs.config = config
	return config, nil
}

// SaveAppConfig 保存应用配置
func (cs *ConfigService) SaveAppConfig(config *models.AppConfig) error {
	return cs.saveAppConfig(config)
}

// UpdateEditorConfig 更新编辑器配置
func (cs *ConfigService) UpdateEditorConfig(editorConfig models.EditorConfig) error {
	// 如果内存中已有配置，直接更新
	if cs.config != nil {
		log.Printf("UpdateEditorConfig: Updating in-memory editor config: %+v", editorConfig)
		cs.config.Editor = editorConfig
		return cs.saveAppConfig(cs.config)
	}

	// 没有内存中的配置，需要先加载
	config, err := cs.loadAppConfig()
	if err != nil {
		log.Printf("UpdateEditorConfig: Failed to load config: %v", err)
		// 使用默认配置
		config = models.NewDefaultAppConfig()
	}

	// 更新编辑器配置
	config.Editor = editorConfig

	// 保存到文件
	return cs.saveAppConfig(config)
}

// GetEditorConfig 获取编辑器配置
func (cs *ConfigService) GetEditorConfig() (models.EditorConfig, error) {
	// 如果内存中已有配置，直接返回
	if cs.config != nil {
		return cs.config.Editor, nil
	}

	// 否则从文件加载
	config, err := cs.loadAppConfig()
	if err != nil {
		log.Printf("GetEditorConfig: Failed to load config: %v", err)
		// 使用默认配置
		defaultConfig := models.NewDefaultAppConfig()
		cs.config = defaultConfig
		return defaultConfig.Editor, nil
	}

	// 更新内存中的配置
	cs.config = config
	log.Printf("GetEditorConfig: Retrieved editor config: %+v", config.Editor)
	return config.Editor, nil
}

// ResetToDefault 重置为默认配置
func (cs *ConfigService) ResetToDefault() error {
	// 创建默认配置
	defaultConfig := models.NewDefaultAppConfig()

	log.Printf("ResetToDefault: Resetting to default config")

	// 保存到文件
	err := cs.saveAppConfig(defaultConfig)
	if err != nil {
		log.Printf("ResetToDefault: Failed to save default config: %v", err)
		return fmt.Errorf("failed to save default config: %w", err)
	}

	log.Printf("ResetToDefault: Successfully reset to default config")
	return nil
}
