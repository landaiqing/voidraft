package services

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
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

	// 热键配置变更回调
	hotkeyChangeCallback func(enable bool, hotkey *models.HotkeyCombo) error

	// 热键变更防抖
	hotkeyNotificationTimer *time.Timer
	hotkeyNotificationMu    sync.Mutex
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
	case "editing.font_size":
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

	case "editing.tab_size":
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

	case "editing.tab_type":
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

	case "appearance.language":
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

	case "editing.auto_save_delay":
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

	case "editing.change_threshold":
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

	case "editing.min_save_interval":
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
	if fixedValue, fixed := cs.validateAndFixValue("editing.font_size", config.Editing.FontSize); fixed {
		cs.viper.Set("editing.font_size", fixedValue)
		hasChanges = true
	}

	if fixedValue, fixed := cs.validateAndFixValue("editing.tab_size", config.Editing.TabSize); fixed {
		cs.viper.Set("editing.tab_size", fixedValue)
		hasChanges = true
	}

	if fixedValue, fixed := cs.validateAndFixValue("editing.tab_type", string(config.Editing.TabType)); fixed {
		cs.viper.Set("editing.tab_type", fixedValue)
		hasChanges = true
	}

	if fixedValue, fixed := cs.validateAndFixValue("appearance.language", string(config.Appearance.Language)); fixed {
		cs.viper.Set("appearance.language", fixedValue)
		hasChanges = true
	}

	// 验证保存选项配置
	if fixedValue, fixed := cs.validateAndFixValue("editing.auto_save_delay", config.Editing.AutoSaveDelay); fixed {
		cs.viper.Set("editing.auto_save_delay", fixedValue)
		hasChanges = true
	}

	if fixedValue, fixed := cs.validateAndFixValue("editing.change_threshold", config.Editing.ChangeThreshold); fixed {
		cs.viper.Set("editing.change_threshold", fixedValue)
		hasChanges = true
	}

	if fixedValue, fixed := cs.validateAndFixValue("editing.min_save_interval", config.Editing.MinSaveInterval); fixed {
		cs.viper.Set("editing.min_save_interval", fixedValue)
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

	// 通用设置默认值
	v.SetDefault("general.always_on_top", defaultConfig.General.AlwaysOnTop)
	v.SetDefault("general.data_path", defaultConfig.General.DataPath)
	v.SetDefault("general.enable_global_hotkey", defaultConfig.General.EnableGlobalHotkey)
	v.SetDefault("general.global_hotkey.ctrl", defaultConfig.General.GlobalHotkey.Ctrl)
	v.SetDefault("general.global_hotkey.shift", defaultConfig.General.GlobalHotkey.Shift)
	v.SetDefault("general.global_hotkey.alt", defaultConfig.General.GlobalHotkey.Alt)
	v.SetDefault("general.global_hotkey.win", defaultConfig.General.GlobalHotkey.Win)
	v.SetDefault("general.global_hotkey.key", defaultConfig.General.GlobalHotkey.Key)

	// 编辑设置默认值
	v.SetDefault("editing.font_size", defaultConfig.Editing.FontSize)
	v.SetDefault("editing.font_family", defaultConfig.Editing.FontFamily)
	v.SetDefault("editing.font_weight", defaultConfig.Editing.FontWeight)
	v.SetDefault("editing.line_height", defaultConfig.Editing.LineHeight)
	v.SetDefault("editing.enable_tab_indent", defaultConfig.Editing.EnableTabIndent)
	v.SetDefault("editing.tab_size", defaultConfig.Editing.TabSize)
	v.SetDefault("editing.tab_type", defaultConfig.Editing.TabType)
	v.SetDefault("editing.auto_save_delay", defaultConfig.Editing.AutoSaveDelay)
	v.SetDefault("editing.change_threshold", defaultConfig.Editing.ChangeThreshold)
	v.SetDefault("editing.min_save_interval", defaultConfig.Editing.MinSaveInterval)

	// 外观设置默认值
	v.SetDefault("appearance.language", defaultConfig.Appearance.Language)

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

	// 检查是否是热键相关配置
	if cs.isHotkeyRelatedKey(key) {
		cs.logger.Info("Config: Detected hotkey configuration change", "key", key, "value", value)
		// 释放锁后通知，避免死锁
		go func() {
			cs.notifyHotkeyChange()
		}()
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

// SetHotkeyChangeCallback 设置热键配置变更回调
func (cs *ConfigService) SetHotkeyChangeCallback(callback func(enable bool, hotkey *models.HotkeyCombo) error) {
	cs.mu.Lock()
	defer cs.mu.Unlock()
	cs.hotkeyChangeCallback = callback
}

// notifyHotkeyChange 通知热键配置变更
func (cs *ConfigService) notifyHotkeyChange() {
	if cs.hotkeyChangeCallback == nil {
		return
	}

	cs.hotkeyNotificationMu.Lock()
	defer cs.hotkeyNotificationMu.Unlock()

	// 取消之前的定时器
	if cs.hotkeyNotificationTimer != nil {
		cs.hotkeyNotificationTimer.Stop()
	}

	// 设置新的防抖定时器（200ms延迟）
	cs.hotkeyNotificationTimer = time.AfterFunc(200*time.Millisecond, func() {
		cs.logger.Debug("Config: Executing hotkey change notification after debounce")

		// 获取当前热键配置
		config, err := cs.GetConfig()
		if err != nil {
			cs.logger.Error("Config: Failed to get config for hotkey notification", "error", err)
			return
		}

		cs.logger.Debug("Config: Notifying hotkey service of configuration change",
			"enable", config.General.EnableGlobalHotkey,
			"ctrl", config.General.GlobalHotkey.Ctrl,
			"shift", config.General.GlobalHotkey.Shift,
			"alt", config.General.GlobalHotkey.Alt,
			"win", config.General.GlobalHotkey.Win,
			"key", config.General.GlobalHotkey.Key)

		// 异步通知热键服务
		go func() {
			err := cs.hotkeyChangeCallback(config.General.EnableGlobalHotkey, &config.General.GlobalHotkey)
			if err != nil {
				cs.logger.Error("Config: Failed to notify hotkey change", "error", err)
			} else {
				cs.logger.Debug("Config: Successfully notified hotkey change")
			}
		}()
	})

	cs.logger.Debug("Config: Hotkey change notification scheduled with debounce")
}

// isHotkeyRelatedKey 检查是否是热键相关的配置键
func (cs *ConfigService) isHotkeyRelatedKey(key string) bool {
	hotkeyKeys := []string{
		"general.enable_global_hotkey",
		"general.global_hotkey",
		"general.global_hotkey.ctrl",
		"general.global_hotkey.shift",
		"general.global_hotkey.alt",
		"general.global_hotkey.win",
		"general.global_hotkey.key",
	}

	for _, hotkeyKey := range hotkeyKeys {
		if strings.HasPrefix(key, hotkeyKey) || key == hotkeyKey {
			return true
		}
	}
	return false
}
