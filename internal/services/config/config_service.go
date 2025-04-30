package config

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
	"voidraft/internal/models"

	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// ConfigService 提供配置管理功能
type ConfigService struct {
	storage ConfigStorage // 配置存储接口
	locator ConfigLocator // 配置定位器接口
	logger  *log.LoggerService
	cache   *models.AppConfig // 配置缓存
	cacheMu sync.RWMutex      // 缓存锁
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

	// 获取默认配置路径
	defaultPath := GetDefaultConfigPath()

	// 创建配置定位器
	locationFile := filepath.Join(homePath, ".voidraft", "config.location")
	locator := NewFileConfigLocator(locationFile, defaultPath, logger)

	// 获取实际配置路径
	configPath := locator.GetConfigPath()
	logger.Info("Config: Using config path", "path", configPath)

	// 创建配置存储
	storage := NewFileConfigStorage(configPath, logger)

	// 构造配置服务实例
	service := &ConfigService{
		storage: storage,
		locator: locator,
		logger:  logger,
	}

	// 初始化加载配置
	service.loadInitialConfig()

	return service
}

// loadInitialConfig 加载初始配置
func (cs *ConfigService) loadInitialConfig() {
	// 尝试加载配置
	config, err := cs.storage.Load()
	if err != nil {
		// 如果加载失败，使用默认配置
		defaultConfig := models.NewDefaultAppConfig()
		defaultConfig.Paths.ConfigPath = cs.storage.GetPath()

		// 保存默认配置
		if err := cs.storage.Save(*defaultConfig); err != nil {
			cs.logger.Error("Config: Failed to save default config", "error", err)
		} else {
			// 更新缓存
			cs.cacheMu.Lock()
			cs.cache = defaultConfig
			cs.cacheMu.Unlock()
		}
	} else {
		// 确保配置中的路径与实际使用的路径一致
		if config.Paths.ConfigPath != cs.storage.GetPath() {
			config.Paths.ConfigPath = cs.storage.GetPath()
			if err := cs.storage.Save(config); err != nil {
				cs.logger.Error("Config: Failed to sync config path", "error", err)
			}
		}

		// 更新缓存
		cs.cacheMu.Lock()
		cs.cache = &config
		cs.cacheMu.Unlock()
	}
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
	config, err := cs.storage.Load()
	if err != nil {
		// 加载失败，使用默认配置
		defaultConfig := models.NewDefaultAppConfig()
		defaultConfig.Paths.ConfigPath = cs.storage.GetPath()

		// 保存默认配置
		if saveErr := cs.storage.Save(*defaultConfig); saveErr != nil {
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

	// 确保ConfigPath与当前路径一致
	config.Paths.ConfigPath = cs.storage.GetPath()

	// 更新缓存
	cs.cacheMu.Lock()
	cs.cache = config
	cs.cacheMu.Unlock()

	// 保存到存储
	return cs.storage.Save(*config)
}

// UpdateConfigPath 更新配置文件路径
func (cs *ConfigService) UpdateConfigPath(newPath string) error {
	// 如果路径相同，无需更改
	if newPath == cs.storage.GetPath() {
		return nil
	}

	// 获取当前配置（优先使用缓存）
	config, err := cs.GetConfig()
	if err != nil {
		return fmt.Errorf("failed to get current config: %w", err)
	}

	// 更新配置中的路径
	config.Paths.ConfigPath = newPath

	// 移动到新路径
	if err := cs.storage.MoveTo(newPath, *config); err != nil {
		return fmt.Errorf("failed to move config to new path: %w", err)
	}

	// 更新定位器
	if err := cs.locator.SetConfigPath(newPath); err != nil {
		cs.logger.Error("Config: Failed to update location file", "error", err)
		// 继续执行，这不是致命错误
	}

	cs.logger.Info("Config: Config path updated", "path", newPath)

	return nil
}

// UpdatePaths 更新路径配置
func (cs *ConfigService) UpdatePaths(paths models.PathsConfig) error {
	config, err := cs.GetConfig()
	if err != nil {
		return err
	}

	// 检查配置文件路径是否变更
	if paths.ConfigPath != "" && paths.ConfigPath != cs.storage.GetPath() {
		// 如果配置路径有变化，使用专门的方法处理
		if err := cs.UpdateConfigPath(paths.ConfigPath); err != nil {
			return fmt.Errorf("failed to update config path: %w", err)
		}
		// 更新后重新加载配置
		config, err = cs.GetConfig()
		if err != nil {
			return err
		}
	}

	// 更新其他路径，但保持ConfigPath不变
	config.Paths.LogPath = paths.LogPath
	config.Paths.DataPath = paths.DataPath

	// 确保ConfigPath与当前一致
	config.Paths.ConfigPath = cs.storage.GetPath()

	return cs.SaveConfig(config)
}

// ResetConfig 重置为默认配置
func (cs *ConfigService) ResetConfig() error {
	defaultConfig := models.NewDefaultAppConfig()
	// 保留当前配置路径
	defaultConfig.Paths.ConfigPath = cs.storage.GetPath()

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
		return fmt.Errorf("unsupported language: %s", language)
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

// GetConfigPath 获取当前配置文件路径
func (cs *ConfigService) GetConfigPath() string {
	return cs.storage.GetPath()
}
