package services

import (
	"fmt"
	"github.com/wailsapp/wails/v3/pkg/services/log"
	"os"
	"path/filepath"
	"sync"
	"time"
	"voidraft/internal/models"
)

// ConfigService 提供配置管理功能
type ConfigService struct {
	store   *Store[models.AppConfig] // 配置存储
	path    string                   // 配置文件路径
	logger  *log.LoggerService
	cache   *models.AppConfig // 配置缓存
	cacheMu sync.RWMutex      // 缓存锁
}

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

	// 固定配置路径
	configPath := filepath.Join(homePath, ".voidraft", "config", "config.json")
	logger.Info("Config: Using config path", "path", configPath)

	// 创建存储
	store := NewStore[models.AppConfig](StoreOption{
		FilePath: configPath,
		AutoSave: true,
		Logger:   logger,
	})

	// 构造配置服务实例
	service := &ConfigService{
		store:  store,
		path:   configPath,
		logger: logger,
	}

	// 初始化加载配置
	service.loadInitialConfig()

	return service
}

// loadInitialConfig 加载初始配置
func (cs *ConfigService) loadInitialConfig() {
	// 尝试加载配置
	config, err := cs.load()
	if err != nil {
		// 如果加载失败，使用默认配置
		defaultConfig := models.NewDefaultAppConfig()

		// 保存默认配置
		if err := cs.save(*defaultConfig); err != nil {
			cs.logger.Error("Config: Failed to save default config", "error", err)
		} else {
			// 更新缓存
			cs.cacheMu.Lock()
			cs.cache = defaultConfig
			cs.cacheMu.Unlock()
		}
	} else {
		// 更新缓存
		cs.cacheMu.Lock()
		cs.cache = &config
		cs.cacheMu.Unlock()
	}
}

// load 加载配置
func (cs *ConfigService) load() (models.AppConfig, error) {
	config := cs.store.Get()

	// 检查配置是否为空
	if isEmptyConfig(config) {
		return models.AppConfig{}, fmt.Errorf("empty config detected")
	}

	return config, nil
}

// save 保存配置
func (cs *ConfigService) save(config models.AppConfig) error {
	return cs.store.Set(config)
}

// isEmptyConfig 检查配置是否为空
func isEmptyConfig(config models.AppConfig) bool {
	return config.Editor.FontSize == 0
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

	// 缓存不存在，从存储加载
	config, err := cs.load()
	if err != nil {
		// 加载失败，使用默认配置
		defaultConfig := models.NewDefaultAppConfig()

		// 保存默认配置
		if saveErr := cs.save(*defaultConfig); saveErr != nil {
			cs.logger.Error("Config: Failed to save default config", "error", saveErr)
		}

		// 更新缓存
		cs.cacheMu.Lock()
		cs.cache = defaultConfig
		cs.cacheMu.Unlock()

		return defaultConfig, nil
	}

	// 更新缓存
	cs.cacheMu.Lock()
	cs.cache = &config
	cs.cacheMu.Unlock()

	return &config, nil
}

// SaveConfig 保存完整应用配置
func (cs *ConfigService) SaveConfig(config *models.AppConfig) error {
	// 更新配置元数据
	config.Metadata.LastUpdated = time.Now()

	// 更新缓存
	cs.cacheMu.Lock()
	cs.cache = config
	cs.cacheMu.Unlock()

	// 保存到存储
	return cs.save(*config)
}

// UpdatePaths 更新路径配置
func (cs *ConfigService) UpdatePaths(paths models.PathsConfig) error {
	config, err := cs.GetConfig()
	if err != nil {
		return err
	}

	// 更新路径配置
	config.Paths.LogPath = paths.LogPath
	config.Paths.DataPath = paths.DataPath

	return cs.SaveConfig(config)
}

// ResetConfig 重置为默认配置
func (cs *ConfigService) ResetConfig() error {
	defaultConfig := models.NewDefaultAppConfig()
	return cs.SaveConfig(defaultConfig)
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
	config, err := cs.GetConfig()
	if err != nil {
		return err
	}

	config.Editor = editorConfig
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

// SetLanguage 设置语言
func (cs *ConfigService) SetLanguage(language models.LanguageType) error {
	// 验证语言类型有效
	if language != models.LangZhCN && language != models.LangEnUS {
		return nil
	}

	config, err := cs.GetConfig()
	if err != nil {
		return err
	}

	config.Editor.Language = language
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
	config, err := cs.GetConfig()
	if err != nil {
		return err
	}

	config.Metadata = metadata
	return cs.SaveConfig(config)
}
