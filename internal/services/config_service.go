package services

import (
	"fmt"
	"os"
	"path/filepath"
	"time"
	"voidraft/internal/models"

	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// ConfigService 提供配置管理功能
type ConfigService struct {
	store      *Store[models.AppConfig]
	homePath   string
	configPath string
	logger     *log.LoggerService
}
type Service struct{}

// NewConfigService 创建新的配置服务实例
func NewConfigService() *ConfigService {
	// 初始化日志服务
	logger := log.New()

	// 获取用户主目录
	homePath, err := os.UserHomeDir()
	if err != nil {
		logger.Error("Config: Failed to get user home directory", "error", err)
		homePath = "."
	}

	// 创建默认配置
	defaultConfig := models.NewDefaultAppConfig()

	// 构建完整的配置文件路径
	configFilePath := filepath.Join(homePath, defaultConfig.Paths.RootDir, defaultConfig.Paths.ConfigPath)

	// 创建Store选项
	storeOption := StoreOption{
		FilePath: configFilePath,
		AutoSave: true,
		Logger:   logger,
	}

	// 创建存储服务
	store := NewStore[models.AppConfig](storeOption)

	// 构造配置服务实例
	service := &ConfigService{
		store:      store,
		homePath:   homePath,
		configPath: configFilePath,
		logger:     logger,
	}

	// 检查是否需要设置默认配置
	config := store.Get()
	if isEmptyConfig(config) {
		err := store.Set(*defaultConfig)
		if err != nil {
			logger.Error("Config: Failed to set default config", "error", err)
		}
	}

	return service
}

// isEmptyConfig 检查配置是否为空
func isEmptyConfig(config models.AppConfig) bool {
	// 检查基本字段
	if config.Editor.FontSize == 0 && config.Paths.RootDir == "" {
		return true
	}
	return false
}

// GetConfig 获取完整应用配置
func (cs *ConfigService) GetConfig() (*models.AppConfig, error) {
	config := cs.store.Get()

	// 如果配置为空，返回默认配置
	if isEmptyConfig(config) {
		defaultConfig := models.NewDefaultAppConfig()
		if err := cs.store.Set(*defaultConfig); err != nil {
			cs.logger.Error("Config: Failed to save default config", "error", err)
		}
		return defaultConfig, nil
	}

	return &config, nil
}

// SaveConfig 保存完整应用配置
func (cs *ConfigService) SaveConfig(config *models.AppConfig) error {
	// 更新配置元数据
	config.Metadata.LastUpdated = time.Now()

	return cs.store.Set(*config)
}

// ResetConfig 重置为默认配置
func (cs *ConfigService) ResetConfig() error {
	defaultConfig := models.NewDefaultAppConfig()

	err := cs.store.Set(*defaultConfig)
	if err != nil {
		cs.logger.Error("Config: Failed to save default config", "error", err)
		return fmt.Errorf("failed to reset config: %w", err)
	}

	return nil
}

// GetEditorConfig 获取编辑器配置
func (cs *ConfigService) GetEditorConfig() (models.EditorConfig, error) {
	config, err := cs.GetConfig()
	if err != nil {
		return models.EditorConfig{}, err
	}
	return config.Editor, nil
}

// UpdateEditorConfig 更新编辑器配置
func (cs *ConfigService) UpdateEditorConfig(editorConfig models.EditorConfig) error {
	// 获取当前配置
	config, err := cs.GetConfig()
	if err != nil {
		return err
	}

	// 更新编辑器配置
	config.Editor = editorConfig
	config.Metadata.LastUpdated = time.Now()

	// 保存更新后的配置
	return cs.store.Set(*config)
}

// GetLanguage 获取当前语言设置
func (cs *ConfigService) GetLanguage() (models.LanguageType, error) {
	editorConfig, err := cs.GetEditorConfig()
	if err != nil {
		return "", err
	}
	return editorConfig.Language, nil
}

// SetLanguage 设置语言
func (cs *ConfigService) SetLanguage(language models.LanguageType) error {
	// 验证语言类型有效
	if language != models.LangZhCN && language != models.LangEnUS {
		return fmt.Errorf("unsupported language: %s", language)
	}

	// 获取当前配置
	config, err := cs.GetConfig()
	if err != nil {
		return err
	}

	// 更新语言设置
	config.Editor.Language = language
	config.Metadata.LastUpdated = time.Now()

	// 保存更新后的配置
	return cs.store.Set(*config)
}

// GetPathConfig 获取路径配置
func (cs *ConfigService) GetPathConfig() (models.PathConfig, error) {
	config, err := cs.GetConfig()
	if err != nil {
		return models.PathConfig{}, err
	}
	return config.Paths, nil
}

// UpdatePathConfig 更新路径配置
func (cs *ConfigService) UpdatePathConfig(pathConfig models.PathConfig) error {
	// 获取当前配置
	config, err := cs.GetConfig()
	if err != nil {
		return err
	}

	// 更新路径配置
	config.Paths = pathConfig
	config.Metadata.LastUpdated = time.Now()

	// 保存更新后的配置
	return cs.store.Set(*config)
}

// GetMetadata 获取配置元数据
func (cs *ConfigService) GetMetadata() (models.ConfigMetadata, error) {
	config, err := cs.GetConfig()
	if err != nil {
		return models.ConfigMetadata{}, err
	}
	return config.Metadata, nil
}

// UpdateMetadata 更新配置元数据
func (cs *ConfigService) UpdateMetadata(metadata models.ConfigMetadata) error {
	// 获取当前配置
	config, err := cs.GetConfig()
	if err != nil {
		return err
	}

	// 更新元数据
	config.Metadata = metadata
	config.Metadata.LastUpdated = time.Now()

	// 保存更新后的配置
	return cs.store.Set(*config)
}

// OnShutdown 服务关闭时调用
func (cs *ConfigService) OnShutdown() error {
	// 如果有未保存的更改，保存数据
	if cs.store.HasUnsavedChanges() {
		return cs.store.Save()
	}
	return nil
}
