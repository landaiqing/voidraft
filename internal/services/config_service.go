package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sync"
	"time"
	"voidraft/internal/models"

	"github.com/fsnotify/fsnotify"
	"github.com/spf13/viper"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// ConfigService 提供基于 Viper 的配置管理功能
type ConfigService struct {
	viper       *viper.Viper       // Viper 实例
	logger      *log.LoggerService // 日志服务
	pathManager *PathManager       // 路径管理器
	mu          sync.RWMutex       // 读写锁

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
func NewConfigService(logger *log.LoggerService, pathManager *PathManager) *ConfigService {
	// 设置日志服务
	if logger == nil {
		logger = log.New()
	}

	// 设置路径管理器
	if pathManager == nil {
		pathManager = NewPathManager()
	}

	// 创建 Viper 实例
	v := viper.New()

	// 配置 Viper
	v.SetConfigName(pathManager.GetConfigName())
	v.SetConfigType("json")
	v.AddConfigPath(pathManager.GetConfigDir())

	// 设置环境变量前缀
	v.SetEnvPrefix("VOIDRAFT")
	v.AutomaticEnv()

	// 设置默认值
	setDefaults(v)

	// 构造配置服务实例
	service := &ConfigService{
		viper:       v,
		logger:      logger,
		pathManager: pathManager,
	}

	// 初始化配置通知服务
	service.notificationService = NewConfigNotificationService(v, logger)

	// 初始化配置
	if err := service.initConfig(); err != nil {
		service.logger.Error("Failed to initialize config", "error", err)
	}

	// 启动配置文件监听
	service.startWatching()

	return service
}

// setDefaults 设置默认配置值
func setDefaults(v *viper.Viper) {
	defaultConfig := models.NewDefaultAppConfig()

	// 通用设置默认值
	v.SetDefault("general.alwaysOnTop", defaultConfig.General.AlwaysOnTop)
	v.SetDefault("general.dataPath", defaultConfig.General.DataPath)
	v.SetDefault("general.enableSystemTray", defaultConfig.General.EnableSystemTray)
	v.SetDefault("general.enableGlobalHotkey", defaultConfig.General.EnableGlobalHotkey)
	v.SetDefault("general.globalHotkey.ctrl", defaultConfig.General.GlobalHotkey.Ctrl)
	v.SetDefault("general.globalHotkey.shift", defaultConfig.General.GlobalHotkey.Shift)
	v.SetDefault("general.globalHotkey.alt", defaultConfig.General.GlobalHotkey.Alt)
	v.SetDefault("general.globalHotkey.win", defaultConfig.General.GlobalHotkey.Win)
	v.SetDefault("general.globalHotkey.key", defaultConfig.General.GlobalHotkey.Key)

	// 编辑设置默认值
	v.SetDefault("editing.fontSize", defaultConfig.Editing.FontSize)
	v.SetDefault("editing.fontFamily", defaultConfig.Editing.FontFamily)
	v.SetDefault("editing.fontWeight", defaultConfig.Editing.FontWeight)
	v.SetDefault("editing.lineHeight", defaultConfig.Editing.LineHeight)
	v.SetDefault("editing.enableTabIndent", defaultConfig.Editing.EnableTabIndent)
	v.SetDefault("editing.tabSize", defaultConfig.Editing.TabSize)
	v.SetDefault("editing.tabType", defaultConfig.Editing.TabType)
	v.SetDefault("editing.autoSaveDelay", defaultConfig.Editing.AutoSaveDelay)

	// 外观设置默认值
	v.SetDefault("appearance.language", defaultConfig.Appearance.Language)
	v.SetDefault("appearance.systemTheme", defaultConfig.Appearance.SystemTheme)

	// 元数据默认值
	v.SetDefault("metadata.lastUpdated", defaultConfig.Metadata.LastUpdated)
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
			return cs.createDefaultConfig()
		}
		// 配置文件存在但读取失败
		return &ConfigError{Operation: "read_config", Err: err}
	}

	return nil
}

// createDefaultConfig 创建默认配置文件
func (cs *ConfigService) createDefaultConfig() error {
	// 确保配置目录存在
	if err := cs.pathManager.EnsureConfigDir(); err != nil {
		return &ConfigError{Operation: "create_config_dir", Err: err}
	}

	// 获取默认配置
	defaultConfig := models.NewDefaultAppConfig()

	// 使用 JSON marshal 方式设置完整的默认配置
	configBytes, err := json.MarshalIndent(defaultConfig, "", "  ")
	if err != nil {
		return &ConfigError{Operation: "marshal_default_config", Err: err}
	}

	// 写入配置文件
	if err := os.WriteFile(cs.pathManager.GetSettingsPath(), configBytes, 0644); err != nil {
		return &ConfigError{Operation: "write_default_config", Err: err}
	}

	// 重新读取配置文件到viper
	if err := cs.viper.ReadInConfig(); err != nil {
		return &ConfigError{Operation: "read_created_config", Err: err}
	}

	return nil
}

// startWatching 启动配置文件监听
func (cs *ConfigService) startWatching() {
	// 设置配置变化回调
	cs.viper.OnConfigChange(func(e fsnotify.Event) {
		// 使用配置通知服务检查所有已注册的配置变更
		cs.notificationService.CheckConfigChanges()
	})

	// 启动配置文件监听
	cs.viper.WatchConfig()
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

	// 设置值到viper
	cs.viper.Set(key, value)

	// 直接从viper获取配置并构建AppConfig结构
	var config models.AppConfig
	if err := cs.viper.Unmarshal(&config); err != nil {
		return &ConfigError{Operation: "unmarshal_config_for_set", Err: err}
	}

	// 更新时间戳
	config.Metadata.LastUpdated = time.Now().Format(time.RFC3339)

	// 直接写入JSON文件
	if err := cs.writeConfigToFile(&config); err != nil {
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

// ResetConfig 强制重置所有配置为默认值
func (cs *ConfigService) ResetConfig() {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	defaultConfig := models.NewDefaultAppConfig()

	// 直接写入JSON文件
	if err := cs.writeConfigToFile(defaultConfig); err != nil {
		return
	}

	// 重新读取配置文件到viper
	if err := cs.viper.ReadInConfig(); err != nil {
		return
	}

	// 手动触发配置变更检查，确保通知系统能感知到变更
	cs.notificationService.CheckConfigChanges()
}

// writeConfigToFile 直接写入配置到JSON文件
func (cs *ConfigService) writeConfigToFile(config *models.AppConfig) error {
	// 序列化为JSON
	configBytes, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %v", err)
	}

	// 写入文件
	if err := os.WriteFile(cs.pathManager.GetSettingsPath(), configBytes, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %v", err)
	}

	// 重新读取到viper中
	if err := cs.viper.ReadInConfig(); err != nil {
		return fmt.Errorf("failed to reload config: %v", err)
	}

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
