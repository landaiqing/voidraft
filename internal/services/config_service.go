package services

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
	"voidraft/internal/models"

	"github.com/fsnotify/fsnotify"
	"github.com/spf13/viper"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// ConfigService 提供基于 Viper 的配置管理功能
type ConfigService struct {
	viper  *viper.Viper       // Viper 实例
	logger *log.LoggerService // 日志服务
	mu     sync.RWMutex       // 读写锁
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
	var configError *ConfigError
	ok := errors.As(target, &configError)
	return ok
}

// ConfigLimits 配置限制定义
type ConfigLimits struct {
	FontSizeMin int
	FontSizeMax int
	TabSizeMin  int
	TabSizeMax  int
}

// getConfigLimits 获取配置限制
func getConfigLimits() ConfigLimits {
	return ConfigLimits{
		FontSizeMin: 12,
		FontSizeMax: 28,
		TabSizeMin:  2,
		TabSizeMax:  8,
	}
}

// validateAndFixValue 验证并修正配置值
func (cs *ConfigService) validateAndFixValue(key string, value interface{}) (interface{}, bool) {
	limits := getConfigLimits()
	fixed := false

	switch key {
	case "editor.font_size":
		if intVal, ok := value.(int); ok {
			if intVal < limits.FontSizeMin {
				cs.logger.Warning("Config: Font size too small, fixing", "original", intVal, "fixed", limits.FontSizeMin)
				return limits.FontSizeMin, true
			}
			if intVal > limits.FontSizeMax {
				cs.logger.Warning("Config: Font size too large, fixing", "original", intVal, "fixed", limits.FontSizeMax)
				return limits.FontSizeMax, true
			}
		}

	case "editor.tab_size":
		if intVal, ok := value.(int); ok {
			if intVal < limits.TabSizeMin {
				cs.logger.Warning("Config: Tab size too small, fixing", "original", intVal, "fixed", limits.TabSizeMin)
				return limits.TabSizeMin, true
			}
			if intVal > limits.TabSizeMax {
				cs.logger.Warning("Config: Tab size too large, fixing", "original", intVal, "fixed", limits.TabSizeMax)
				return limits.TabSizeMax, true
			}
		}

	case "editor.tab_type":
		if strVal, ok := value.(string); ok {
			validTypes := []string{string(models.TabTypeSpaces), string(models.TabTypeTab)}
			isValid := false
			for _, validType := range validTypes {
				if strVal == validType {
					isValid = true
					break
				}
			}
			if !isValid {
				cs.logger.Warning("Config: Invalid tab type, fixing", "original", strVal, "fixed", string(models.TabTypeSpaces))
				return string(models.TabTypeSpaces), true
			}
		}

	case "editor.language":
		if strVal, ok := value.(string); ok {
			validLanguages := []string{string(models.LangZhCN), string(models.LangEnUS)}
			isValid := false
			for _, validLang := range validLanguages {
				if strVal == validLang {
					isValid = true
					break
				}
			}
			if !isValid {
				cs.logger.Warning("Config: Invalid language, fixing", "original", strVal, "fixed", string(models.LangZhCN))
				return string(models.LangZhCN), true
			}
		}

	case "document.auto_save_delay":
		if intVal, ok := value.(int); ok {
			if intVal < 1000 {
				cs.logger.Warning("Config: Auto save delay too small, fixing", "original", intVal, "fixed", 1000)
				return 1000, true
			}
			if intVal > 30000 {
				cs.logger.Warning("Config: Auto save delay too large, fixing", "original", intVal, "fixed", 30000)
				return 30000, true
			}
		}

	case "document.change_threshold":
		if intVal, ok := value.(int); ok {
			if intVal < 10 {
				cs.logger.Warning("Config: Change threshold too small, fixing", "original", intVal, "fixed", 10)
				return 10, true
			}
			if intVal > 10000 {
				cs.logger.Warning("Config: Change threshold too large, fixing", "original", intVal, "fixed", 10000)
				return 10000, true
			}
		}

	case "document.min_save_interval":
		if intVal, ok := value.(int); ok {
			if intVal < 100 {
				cs.logger.Warning("Config: Min save interval too small, fixing", "original", intVal, "fixed", 100)
				return 100, true
			}
			if intVal > 10000 {
				cs.logger.Warning("Config: Min save interval too large, fixing", "original", intVal, "fixed", 10000)
				return 10000, true
			}
		}
	}

	return value, fixed
}

// validateAllConfig 验证并修正所有配置
func (cs *ConfigService) validateAllConfig() error {
	hasChanges := false

	// 获取当前配置
	var config models.AppConfig
	if err := cs.viper.Unmarshal(&config); err != nil {
		return &ConfigError{Operation: "unmarshal_for_validation", Err: err}
	}

	// 验证编辑器配置
	if fixedValue, fixed := cs.validateAndFixValue("editor.font_size", config.Editor.FontSize); fixed {
		cs.viper.Set("editor.font_size", fixedValue)
		hasChanges = true
	}

	if fixedValue, fixed := cs.validateAndFixValue("editor.tab_size", config.Editor.TabSize); fixed {
		cs.viper.Set("editor.tab_size", fixedValue)
		hasChanges = true
	}

	if fixedValue, fixed := cs.validateAndFixValue("editor.tab_type", string(config.Editor.TabType)); fixed {
		cs.viper.Set("editor.tab_type", fixedValue)
		hasChanges = true
	}

	if fixedValue, fixed := cs.validateAndFixValue("editor.language", string(config.Editor.Language)); fixed {
		cs.viper.Set("editor.language", fixedValue)
		hasChanges = true
	}

	// 验证文档配置
	if fixedValue, fixed := cs.validateAndFixValue("document.auto_save_delay", config.Document.AutoSaveDelay); fixed {
		cs.viper.Set("document.auto_save_delay", fixedValue)
		hasChanges = true
	}

	if fixedValue, fixed := cs.validateAndFixValue("document.change_threshold", config.Document.ChangeThreshold); fixed {
		cs.viper.Set("document.change_threshold", fixedValue)
		hasChanges = true
	}

	if fixedValue, fixed := cs.validateAndFixValue("document.min_save_interval", config.Document.MinSaveInterval); fixed {
		cs.viper.Set("document.min_save_interval", fixedValue)
		hasChanges = true
	}

	// 如果有修正，保存配置
	if hasChanges {
		if err := cs.viper.WriteConfig(); err != nil {
			return &ConfigError{Operation: "save_validated_config", Err: err}
		}
		cs.logger.Info("Config: Configuration validated and fixed")
	}

	return nil
}

// NewConfigService 创建新的配置服务实例
func NewConfigService(logger *log.LoggerService) *ConfigService {
	// 设置日志服务
	if logger == nil {
		logger = log.New()
	}

	// 获取当前工作目录
	currentDir, err := os.Getwd()
	if err != nil {
		currentDir = "."
	}

	// 固定配置路径和文件名
	configPath := filepath.Join(currentDir, "config")
	configName := "config"

	// 创建 Viper 实例
	v := viper.New()

	// 配置 Viper
	v.SetConfigName(configName)
	v.SetConfigType("yaml")
	v.AddConfigPath(configPath)

	// 设置环境变量前缀
	v.SetEnvPrefix("VOIDRAFT")
	v.AutomaticEnv()

	// 设置默认值
	setDefaults(v)

	// 构造配置服务实例
	service := &ConfigService{
		viper:  v,
		logger: logger,
	}

	// 初始化配置
	if err := service.initConfig(); err != nil {
		service.logger.Error("Config: Failed to initialize config", "error", err)
	}

	// 验证并修正配置
	if err := service.validateAllConfig(); err != nil {
		service.logger.Error("Config: Failed to validate config", "error", err)
	}

	// 启动配置文件监听
	service.startWatching()

	return service
}

// setDefaults 设置默认配置值
func setDefaults(v *viper.Viper) {
	defaultConfig := models.NewDefaultAppConfig()

	// 编辑器配置默认值
	v.SetDefault("editor.font_size", defaultConfig.Editor.FontSize)
	v.SetDefault("editor.enable_tab_indent", defaultConfig.Editor.EnableTabIndent)
	v.SetDefault("editor.tab_size", defaultConfig.Editor.TabSize)
	v.SetDefault("editor.tab_type", defaultConfig.Editor.TabType)
	v.SetDefault("editor.language", defaultConfig.Editor.Language)
	v.SetDefault("editor.always_on_top", defaultConfig.Editor.AlwaysOnTop)

	// 文档配置默认值
	v.SetDefault("document.auto_save_delay", defaultConfig.Document.AutoSaveDelay)
	v.SetDefault("document.change_threshold", defaultConfig.Document.ChangeThreshold)
	v.SetDefault("document.min_save_interval", defaultConfig.Document.MinSaveInterval)

	// 路径配置默认值
	v.SetDefault("paths.data_path", defaultConfig.Paths.DataPath)

	// 元数据默认值
	v.SetDefault("metadata.version", defaultConfig.Metadata.Version)
	v.SetDefault("metadata.last_updated", defaultConfig.Metadata.LastUpdated)
}

// initConfig 初始化配置
func (cs *ConfigService) initConfig() error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	// 尝试读取配置文件
	if err := cs.viper.ReadInConfig(); err != nil {
		var configFileNotFoundError viper.ConfigFileNotFoundError
		if errors.As(err, &configFileNotFoundError) {
			// 配置文件不存在，创建默认配置文件
			cs.logger.Info("Config: Config file not found, creating default config")
			return cs.createDefaultConfig()
		}
		// 配置文件存在但读取失败
		return &ConfigError{Operation: "read_config", Err: err}
	}

	cs.logger.Info("Config: Successfully loaded config file", "file", cs.viper.ConfigFileUsed())
	return nil
}

// createDefaultConfig 创建默认配置文件
func (cs *ConfigService) createDefaultConfig() error {
	// 获取配置目录路径
	currentDir, err := os.Getwd()
	if err != nil {
		currentDir = "."
	}
	configDir := filepath.Join(currentDir, "config")
	configPath := filepath.Join(configDir, "config.yaml")

	// 确保配置目录存在
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return &ConfigError{Operation: "create_config_dir", Err: err}
	}

	// 设置当前时间为最后更新时间
	cs.viper.Set("metadata.last_updated", time.Now())

	// 使用 SafeWriteConfigAs 写入配置文件（如果文件不存在则创建）
	if err := cs.viper.SafeWriteConfigAs(configPath); err != nil {
		return &ConfigError{Operation: "write_default_config", Err: err}
	}

	cs.logger.Info("Config: Created default config file", "path", configPath)
	return nil
}

// startWatching 启动配置文件监听
func (cs *ConfigService) startWatching() {
	// 设置配置变化回调
	cs.viper.OnConfigChange(func(e fsnotify.Event) {
		cs.logger.Info("Config: Config file changed", "file", e.Name, "operation", e.Op.String())
		// 注释掉自动更新时间戳，避免无限循环
		// err := cs.Set("metadata.last_updated", time.Now())
		// if err != nil {
		// 	cs.logger.Error("Config: Failed to update last_updated field", "error", err)
		// }
	})

	// 启动配置文件监听
	cs.viper.WatchConfig()
	cs.logger.Info("Config: Started watching config file for changes")
}

// GetConfig 获取完整应用配置
func (cs *ConfigService) GetConfig() (*models.AppConfig, error) {
	cs.mu.RLock()
	defer cs.mu.RUnlock()

	var config models.AppConfig
	if err := cs.viper.Unmarshal(&config); err != nil {
		return nil, &ConfigError{Operation: "unmarshal_config", Err: err}
	}

	return &config, nil
}

// Set 设置配置项
func (cs *ConfigService) Set(key string, value interface{}) error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	// 验证并修正配置值
	validatedValue, wasFixed := cs.validateAndFixValue(key, value)

	// 设置验证后的值
	cs.viper.Set(key, validatedValue)

	// 使用 WriteConfig 写入配置文件（会触发文件监听）
	if err := cs.viper.WriteConfig(); err != nil {
		return &ConfigError{Operation: "set_config", Err: err}
	}

	if wasFixed {
		cs.logger.Debug("Config: Successfully set config with validation", "key", key, "original", value, "fixed", validatedValue)
	} else {
		cs.logger.Debug("Config: Successfully set config", "key", key, "value", value)
	}

	return nil
}

// Get 获取配置项
func (cs *ConfigService) Get(key string) interface{} {
	cs.mu.RLock()
	defer cs.mu.RUnlock()
	return cs.viper.Get(key)
}

// ResetConfig 重置为默认配置
func (cs *ConfigService) ResetConfig() error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	// 重新设置默认值
	setDefaults(cs.viper)

	// 使用 WriteConfig 写入配置文件（会触发文件监听）
	if err := cs.viper.WriteConfig(); err != nil {
		return &ConfigError{Operation: "reset_config", Err: err}
	}

	cs.logger.Info("Config: Successfully reset to default configuration")
	return nil
}
