package services

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"
	"voidraft/internal/models"
)

// ConfigService 提供配置管理功能
type ConfigService struct {
	fileService *FileService
	configPath  string
	rootDir     string
	homePath    string
	mutex       sync.RWMutex
	config      *models.AppConfig // 缓存最新配置
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
		config:      defaultConfig, // 初始化缓存配置
	}

	// 初始化配置目录和文件（非锁定方式）
	service.initializeConfig()

	return service
}

// initializeConfig 初始化配置目录和文件，避免死锁
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
		if err := cs.saveAppConfigInitial(defaultConfig); err != nil {
			log.Printf("Failed to save default config: %v", err)
		}
	} else {
		// 加载现有配置
		log.Printf("Loading existing config file")
		existingConfig, err := cs.loadAppConfigInitial()
		if err != nil {
			log.Printf("Failed to load existing config, using default: %v", err)
		} else {
			cs.config = existingConfig
		}
	}
}

// saveAppConfigInitial 初始化时保存配置，不使用互斥锁
func (cs *ConfigService) saveAppConfigInitial(config *models.AppConfig) error {
	// 更新配置元数据
	config.Metadata.LastUpdated = time.Now()

	// 保存到文件
	configPath := cs.GetFullConfigPath()
	log.Printf("saveAppConfigInitial: Saving to %s", configPath)

	if err := cs.fileService.SaveJSON(configPath, config); err != nil {
		return fmt.Errorf("failed to save initial config file: %w", err)
	}

	// 更新内存中的配置
	cs.config = config
	return nil
}

// loadAppConfigInitial 初始化时加载配置，不使用互斥锁
func (cs *ConfigService) loadAppConfigInitial() (*models.AppConfig, error) {
	config := &models.AppConfig{}
	configPath := cs.GetFullConfigPath()

	if err := cs.fileService.LoadJSON(configPath, config); err != nil {
		return nil, fmt.Errorf("failed to load initial config file: %w", err)
	}

	return config, nil
}

// initConfigDir 确保目录存在，如不存在则创建
func (cs *ConfigService) initConfigDir() error {
	configDir := filepath.Join(cs.homePath, cs.rootDir)
	return cs.fileService.EnsureDir(configDir)
}

// GetFullConfigPath 获取完整的配置文件路径
func (cs *ConfigService) GetFullConfigPath() string {
	return filepath.Join(cs.homePath, cs.rootDir, cs.configPath)
}

// GetAppConfig 获取应用配置
func (cs *ConfigService) GetAppConfig() (*models.AppConfig, error) {
	cs.mutex.RLock()
	defer cs.mutex.RUnlock()

	// 返回内存中的配置副本
	if cs.config != nil {
		return cs.config, nil
	}

	// 从文件加载
	config := &models.AppConfig{}
	configPath := cs.GetFullConfigPath()

	log.Printf("GetAppConfig: Loading from %s", configPath)

	// 如果配置文件存在，则加载
	if cs.fileService.FileExists(configPath) {
		if err := cs.fileService.LoadJSON(configPath, config); err != nil {
			log.Printf("GetAppConfig: Failed to load config: %v", err)
			return nil, fmt.Errorf("failed to load config file: %w", err)
		}
		log.Printf("GetAppConfig: Successfully loaded config")
		// 更新内存中的配置
		cs.config = config
	} else {
		// 文件不存在，使用默认配置
		log.Printf("GetAppConfig: Config file not found, using default")
		config = models.NewDefaultAppConfig()

		// 保存默认配置到文件
		if err := cs.SaveAppConfig(config); err != nil {
			log.Printf("GetAppConfig: Failed to save default config: %v", err)
			return nil, fmt.Errorf("failed to save default config: %w", err)
		}
	}

	return config, nil
}

// SaveAppConfig 保存应用配置
func (cs *ConfigService) SaveAppConfig(config *models.AppConfig) error {
	cs.mutex.Lock()
	defer cs.mutex.Unlock()

	// 更新配置元数据
	config.Metadata.LastUpdated = time.Now()

	// 保存到文件
	configPath := cs.GetFullConfigPath()
	log.Printf("SaveAppConfig: Saving to %s", configPath)

	if err := cs.fileService.SaveJSON(configPath, config); err != nil {
		log.Printf("SaveAppConfig: Failed to save config: %v", err)
		return fmt.Errorf("failed to save config file: %w", err)
	}

	// 更新内存中的配置
	cs.config = config
	log.Printf("SaveAppConfig: Successfully saved config")

	return nil
}

// UpdateEditorConfig 更新编辑器配置
func (cs *ConfigService) UpdateEditorConfig(editorConfig models.EditorConfig) error {
	cs.mutex.Lock()
	defer cs.mutex.Unlock()

	// 如果内存中已有配置，直接更新
	if cs.config != nil {
		log.Printf("UpdateEditorConfig: Updating in-memory editor config: %+v", editorConfig)
		cs.config.Editor = editorConfig

		// 保存到文件
		configPath := cs.GetFullConfigPath()
		if err := cs.fileService.SaveJSON(configPath, cs.config); err != nil {
			log.Printf("UpdateEditorConfig: Failed to save config: %v", err)
			return fmt.Errorf("failed to save config file: %w", err)
		}

		log.Printf("UpdateEditorConfig: Successfully saved updated config")
		return nil
	}

	// 没有内存中的配置，需要先加载
	config, err := cs.loadAppConfigInitial()
	if err != nil {
		log.Printf("UpdateEditorConfig: Failed to load config: %v", err)
		// 使用默认配置
		config = models.NewDefaultAppConfig()
	}

	// 更新编辑器配置
	config.Editor = editorConfig

	// 更新配置元数据
	config.Metadata.LastUpdated = time.Now()

	// 保存到文件
	configPath := cs.GetFullConfigPath()
	if err := cs.fileService.SaveJSON(configPath, config); err != nil {
		log.Printf("UpdateEditorConfig: Failed to save config: %v", err)
		return fmt.Errorf("failed to save config file: %w", err)
	}

	// 更新内存中的配置
	cs.config = config
	log.Printf("UpdateEditorConfig: Successfully saved config with updated editor settings")

	return nil
}

// GetEditorConfig 获取编辑器配置
func (cs *ConfigService) GetEditorConfig() (models.EditorConfig, error) {
	cs.mutex.RLock()
	defer cs.mutex.RUnlock()

	// 如果内存中已有配置，直接返回
	if cs.config != nil {
		return cs.config.Editor, nil
	}

	// 否则从文件加载
	config, err := cs.loadAppConfigInitial()
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
	cs.mutex.Lock()
	defer cs.mutex.Unlock()

	// 创建默认配置
	defaultConfig := models.NewDefaultAppConfig()

	log.Printf("ResetToDefault: Resetting to default config")

	// 保存到文件
	configPath := cs.GetFullConfigPath()
	if err := cs.fileService.SaveJSON(configPath, defaultConfig); err != nil {
		log.Printf("ResetToDefault: Failed to save default config: %v", err)
		return fmt.Errorf("failed to save default config: %w", err)
	}

	// 更新内存中的配置
	cs.config = defaultConfig
	log.Printf("ResetToDefault: Successfully reset to default config")

	return nil
}
