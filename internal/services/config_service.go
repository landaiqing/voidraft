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

	// 配置通知服务
	notificationService *ConfigNotificationService
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

	// 初始化配置通知服务
	service.notificationService = NewConfigNotificationService(v, logger)

	// 初始化配置
	if err := service.initConfig(); err != nil {
		service.logger.Error("Config: Failed to initialize config", "error", err)
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

		// 使用配置通知服务检查所有已注册的配置变更
		cs.notificationService.CheckConfigChanges()
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
	// 设置验证后的值
	cs.viper.Set(key, value)

	// 使用 WriteConfig 写入配置文件（会触发文件监听）
	if err := cs.viper.WriteConfig(); err != nil {
		return &ConfigError{Operation: "set_config", Err: err}
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
func (cs *ConfigService) SetHotkeyChangeCallback(callback func(enable bool, hotkey *models.HotkeyCombo) error) error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	// 创建热键监听器并注册
	hotkeyListener := CreateHotkeyListener(callback)
	return cs.notificationService.RegisterListener(hotkeyListener)
}

// SetDataPathChangeCallback 设置数据路径配置变更回调
func (cs *ConfigService) SetDataPathChangeCallback(callback func(oldPath, newPath string) error) error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	// 创建数据路径监听器并注册
	dataPathListener := CreateDataPathListener(callback)
	return cs.notificationService.RegisterListener(dataPathListener)
}
