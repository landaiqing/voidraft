package services

import (
	"errors"
	"fmt"
	"github.com/wailsapp/wails/v3/pkg/services/log"
	"os"
	"path/filepath"
	"sync"
	"time"
	"voidraft/internal/models"

	"dario.cat/mergo"
)

// ConfigPath 配置路径提供接口
type ConfigPath interface {
	// GetConfigPath 获取配置文件路径
	GetConfigPath() string
}

// DefaultConfigPathProvider 默认配置路径提供者
type DefaultConfigPathProvider struct{}

// GetConfigPath 获取默认配置路径
func (p *DefaultConfigPathProvider) GetConfigPath() string {
	// 获取用户主目录
	homePath, err := os.UserHomeDir()
	if err != nil {
		homePath = "."
	}
	// 返回固定的配置路径
	return filepath.Join(homePath, ".voidraft", "config", "config.json")
}

// ConfigOption 配置服务选项
type ConfigOption struct {
	Logger          *log.LoggerService // 日志服务
	PathProvider    ConfigPath         // 路径提供者
	AutoSaveEnabled bool               // 是否启用自动保存
}

// ConfigService 提供配置管理功能
type ConfigService struct {
	store   *Store[models.AppConfig] // 配置存储
	logger  *log.LoggerService       // 日志服务
	cache   *models.AppConfig        // 配置缓存
	cacheMu sync.RWMutex             // 缓存锁
}

// ConfigError 配置错误
type ConfigError struct {
	Operation string // 操作名称
	Err       error  // 原始错误
}

// Error 实现error接口
func (e *ConfigError) Error() string {
	return fmt.Sprintf("config error during %s: %v", e.Operation, e.Err)
}

// Unwrap 获取原始错误
func (e *ConfigError) Unwrap() error {
	return e.Err
}

// Is 实现错误匹配
func (e *ConfigError) Is(target error) bool {
	_, ok := target.(*ConfigError)
	return ok
}

// NewConfigService 创建新的配置服务实例
func NewConfigService(opt ...ConfigOption) *ConfigService {
	var option ConfigOption

	// 使用第一个选项
	if len(opt) > 0 {
		option = opt[0]
	}

	// 设置日志服务
	logger := option.Logger
	if logger == nil {
		logger = log.New()
	}

	// 设置路径提供者
	pathProvider := option.PathProvider
	if pathProvider == nil {
		pathProvider = &DefaultConfigPathProvider{}
	}

	// 获取配置路径
	configPath := pathProvider.GetConfigPath()
	logger.Info("Config: Using config path", "path", configPath)

	// 创建存储
	store := NewStore[models.AppConfig](StoreOption{
		FilePath: configPath,
		AutoSave: option.AutoSaveEnabled,
		Logger:   logger,
	})

	// 构造配置服务实例
	service := &ConfigService{
		store:  store,
		logger: logger,
	}

	// 初始化加载配置
	if err := service.initConfig(); err != nil {
		service.logger.Error("Config: Failed to initialize config", "error", err)
	}

	return service
}

// initConfig 初始化配置
func (cs *ConfigService) initConfig() error {
	config, err := cs.loadConfig()

	if err != nil {
		// 如果加载失败，使用默认配置
		defaultConfig := models.NewDefaultAppConfig()
		cs.logger.Info("Config: Using default config")

		// 保存默认配置并更新缓存
		if err := cs.saveConfigWithCache(*defaultConfig); err != nil {
			return &ConfigError{Operation: "init_save_default", Err: err}
		}

		return nil
	}

	// 合并默认配置
	if err := cs.mergeWithDefaults(&config); err != nil {
		return &ConfigError{Operation: "init_merge_defaults", Err: err}
	}

	return nil
}

// mergeWithDefaults 将默认配置合并到现有配置中
func (cs *ConfigService) mergeWithDefaults(config *models.AppConfig) error {
	defaultConfig := models.NewDefaultAppConfig()

	// 使用mergo库合并配置
	if err := mergo.Merge(config, defaultConfig, mergo.WithOverrideEmptySlice); err != nil {
		return err
	}

	// 更新最后修改时间
	config.Metadata.LastUpdated = time.Now()

	// 保存合并后的配置
	return cs.saveConfigWithCache(*config)
}

// loadConfig 加载配置
func (cs *ConfigService) loadConfig() (models.AppConfig, error) {
	// 尝试从缓存获取
	cs.cacheMu.RLock()
	cachedConfig := cs.cache
	cs.cacheMu.RUnlock()

	if cachedConfig != nil {
		return *cachedConfig, nil
	}

	// 从存储加载
	config := cs.store.Get()

	// 检查配置是否有效
	if !isValidConfig(config) {
		return models.AppConfig{}, errors.New("invalid or empty configuration")
	}

	return config, nil
}

// isValidConfig 检查配置是否有效
func isValidConfig(config models.AppConfig) bool {
	// 检查关键字段
	if config.Metadata.Version == "" {
		return false
	}
	return true
}

// saveConfigWithCache 保存配置并更新缓存
func (cs *ConfigService) saveConfigWithCache(config models.AppConfig) error {
	// 更新缓存
	cs.cacheMu.Lock()
	cs.cache = &config
	cs.cacheMu.Unlock()

	// 保存到存储
	if err := cs.store.Set(config); err != nil {
		return err
	}

	return nil
}

// GetConfig 获取完整应用配置
func (cs *ConfigService) GetConfig() (*models.AppConfig, error) {
	// 优先使用缓存
	cs.cacheMu.RLock()
	if cs.cache != nil {
		config := *cs.cache
		cs.cacheMu.RUnlock()
		return &config, nil
	}
	cs.cacheMu.RUnlock()

	// 加载配置
	config, err := cs.loadConfig()
	if err != nil {
		// 加载失败，使用默认配置
		defaultConfig := models.NewDefaultAppConfig()

		// 保存默认配置
		if saveErr := cs.saveConfigWithCache(*defaultConfig); saveErr != nil {
			cs.logger.Error("Config: Failed to save default config", "error", saveErr)
			return nil, &ConfigError{Operation: "get_save_default", Err: saveErr}
		}

		return defaultConfig, nil
	}
	return &config, nil
}

// SaveConfig 保存完整应用配置
func (cs *ConfigService) SaveConfig(config *models.AppConfig) error {
	if config == nil {
		return errors.New("cannot save nil config")
	}

	// 更新配置元数据
	config.Metadata.LastUpdated = time.Now()

	// 保存配置
	return cs.saveConfigWithCache(*config)
}

// UpdateEditorConfig 更新编辑器配置
func (cs *ConfigService) UpdateEditorConfig(editorConfig models.EditorConfig) error {
	config, err := cs.GetConfig()
	if err != nil {
		return err
	}

	// 保存当前的语言设置
	currentLanguage := config.Editor.Language

	// 更新编辑器配置
	config.Editor = editorConfig

	// 如果更新后的语言设置为空，则使用之前的语言设置
	if editorConfig.Language == "" {
		config.Editor.Language = currentLanguage
	}

	return cs.SaveConfig(config)
}

// GetEditorConfig 获取编辑器配置
func (cs *ConfigService) GetEditorConfig() (models.EditorConfig, error) {
	config, err := cs.GetConfig()
	if err != nil {
		return models.EditorConfig{}, err
	}
	return config.Editor, nil
}

// SetLanguage 设置语言
func (cs *ConfigService) SetLanguage(language models.LanguageType) error {
	// 验证语言类型有效
	if language != models.LangZhCN && language != models.LangEnUS {
		return errors.New("invalid language type")
	}

	config, err := cs.GetConfig()
	if err != nil {
		return err
	}

	config.Editor.Language = language
	return cs.SaveConfig(config)
}

// GetLanguage 获取当前语言设置
func (cs *ConfigService) GetLanguage() (models.LanguageType, error) {
	editorConfig, err := cs.GetEditorConfig()
	if err != nil {
		return "", err
	}
	return editorConfig.Language, nil
}

// UpdatePaths 更新路径配置
func (cs *ConfigService) UpdatePaths(paths models.PathsConfig) error {
	config, err := cs.GetConfig()
	if err != nil {
		return err
	}

	config.Paths = paths
	return cs.SaveConfig(config)
}

// GetPaths 获取路径配置
func (cs *ConfigService) GetPaths() (models.PathsConfig, error) {
	config, err := cs.GetConfig()
	if err != nil {
		return models.PathsConfig{}, err
	}
	return config.Paths, nil
}

// UpdateMetadata 更新配置元数据
func (cs *ConfigService) UpdateMetadata(metadata models.ConfigMetadata) error {
	config, err := cs.GetConfig()
	if err != nil {
		return err
	}

	config.Metadata = metadata
	return cs.SaveConfig(config)
}

// GetMetadata 获取配置元数据
func (cs *ConfigService) GetMetadata() (models.ConfigMetadata, error) {
	config, err := cs.GetConfig()
	if err != nil {
		return models.ConfigMetadata{}, err
	}
	return config.Metadata, nil
}

// ResetConfig 重置为默认配置
func (cs *ConfigService) ResetConfig() error {
	defaultConfig := models.NewDefaultAppConfig()
	return cs.SaveConfig(defaultConfig)
}
