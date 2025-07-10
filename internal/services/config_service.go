package services

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
	"voidraft/internal/models"

	jsonparser "github.com/knadh/koanf/parsers/json"
	"github.com/knadh/koanf/providers/file"
	"github.com/knadh/koanf/providers/structs"
	"github.com/knadh/koanf/v2"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// ConfigService 应用配置服务
type ConfigService struct {
	koanf        *koanf.Koanf // koanf 实例
	logger       *log.Service // 日志服务
	configDir    string       // 配置目录
	settingsPath string       // 设置文件路径
	mu           sync.RWMutex // 读写锁
	fileProvider *file.File   // 文件提供器，用于监听

	// 配置通知服务
	notificationService *ConfigNotificationService
	// 配置迁移服务
	migrationService *ConfigMigrationService[*models.AppConfig]
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
func NewConfigService(logger *log.Service) *ConfigService {
	// 获取用户主目录
	homeDir, err := os.UserHomeDir()
	if err != nil {
		panic(fmt.Errorf("unable to get the user's home directory: %w", err))
	}

	// 设置配置目录和设置文件路径
	configDir := filepath.Join(homeDir, ".voidraft", "config")
	settingsPath := filepath.Join(configDir, "settings.json")

	cs := &ConfigService{
		logger:           logger,
		configDir:        configDir,
		settingsPath:     settingsPath,
		koanf:            koanf.New("."),
		migrationService: NewAppConfigMigrationService(logger, configDir, settingsPath),
	}

	// 初始化配置通知服务
	cs.notificationService = NewConfigNotificationService(cs.koanf, logger)

	cs.initConfig()

	// 启动配置文件监听
	cs.startWatching()

	return cs
}

// setDefaults 设置默认配置
func (cs *ConfigService) setDefaults() error {
	defaultConfig := models.NewDefaultAppConfig()

	if err := cs.koanf.Load(structs.Provider(defaultConfig, "json"), nil); err != nil {
		return &ConfigError{Operation: "load_defaults", Err: err}
	}

	return nil
}

// initConfig 初始化配置
func (cs *ConfigService) initConfig() error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	// 检查配置文件是否存在
	if _, err := os.Stat(cs.settingsPath); os.IsNotExist(err) {
		return cs.createDefaultConfig()
	}

	// 配置文件存在，先加载现有配置
	cs.fileProvider = file.Provider(cs.settingsPath)
	if err := cs.koanf.Load(cs.fileProvider, jsonparser.Parser()); err != nil {
		return &ConfigError{Operation: "load_config_file", Err: err}
	}

	// 检查并执行配置迁移
	if cs.migrationService != nil {
		result, err := cs.migrationService.MigrateConfig(cs.koanf)
		if err != nil {
			return &ConfigError{Operation: "migrate_config", Err: err}
		}

		if result.Migrated && result.ConfigUpdated {
			// 迁移完成且配置已更新，重新创建文件提供器以监听新文件
			cs.fileProvider = file.Provider(cs.settingsPath)
		}
	}

	return nil
}

// createDefaultConfig 创建默认配置文件
func (cs *ConfigService) createDefaultConfig() error {
	// 确保配置目录存在
	if err := os.MkdirAll(cs.configDir, 0755); err != nil {
		return &ConfigError{Operation: "create_config_dir", Err: err}
	}

	if err := cs.setDefaults(); err != nil {
		return err
	}

	if err := cs.writeConfigToFile(); err != nil {
		return err
	}

	// 创建文件提供器
	cs.fileProvider = file.Provider(cs.settingsPath)

	if err := cs.koanf.Load(cs.fileProvider, jsonparser.Parser()); err != nil {
		return &ConfigError{Operation: "load_config_file", Err: err}
	}
	return nil
}

// startWatching 启动配置文件监听
func (cs *ConfigService) startWatching() {
	if cs.fileProvider == nil {
		return
	}
	err := cs.fileProvider.Watch(func(event interface{}, err error) {
		if err != nil {
			return
		}
		cs.koanf.Load(cs.fileProvider, jsonparser.Parser())

		// 使用配置通知服务检查所有已注册的配置变更
		if cs.notificationService != nil {
			cs.notificationService.CheckConfigChanges()
		}
	})

	if err != nil {
		cs.logger.Error("Failed to setup config file watcher", "error", err)
	}
}

// stopWatching 停止配置文件监听
func (cs *ConfigService) stopWatching() {
	if cs.fileProvider != nil {
		cs.fileProvider.Unwatch()
	}
}

// GetConfig 获取完整应用配置
func (cs *ConfigService) GetConfig() (*models.AppConfig, error) {
	cs.mu.RLock()
	defer cs.mu.RUnlock()

	var config models.AppConfig
	if err := cs.koanf.UnmarshalWithConf("", &config, koanf.UnmarshalConf{Tag: "json"}); err != nil {
		return nil, &ConfigError{Operation: "unmarshal_config", Err: err}
	}

	return &config, nil
}

// Set 设置配置项
func (cs *ConfigService) Set(key string, value interface{}) error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	// 设置值到koanf
	cs.koanf.Set(key, value)

	// 更新时间戳
	cs.koanf.Set("metadata.lastUpdated", time.Now().Format(time.RFC3339))

	// 将配置写回文件
	return cs.writeConfigToFile()
}

// Get 获取配置项
func (cs *ConfigService) Get(key string) interface{} {
	cs.mu.RLock()
	defer cs.mu.RUnlock()
	return cs.koanf.Get(key)
}

// ResetConfig 强制重置所有配置为默认值
func (cs *ConfigService) ResetConfig() error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	// 停止文件监听
	if cs.fileProvider != nil {
		cs.fileProvider.Unwatch()
		cs.fileProvider = nil
	}

	// 设置默认配置
	if err := cs.setDefaults(); err != nil {
		return &ConfigError{Operation: "reset_set_defaults", Err: err}
	}

	// 写入配置文件
	if err := cs.writeConfigToFile(); err != nil {
		return &ConfigError{Operation: "reset_write_config", Err: err}
	}

	// 重新创建koanf实例
	cs.koanf = koanf.New(".")

	// 重新加载默认配置到koanf
	if err := cs.setDefaults(); err != nil {
		return &ConfigError{Operation: "reset_reload_defaults", Err: err}
	}

	// 重新创建文件提供器
	cs.fileProvider = file.Provider(cs.settingsPath)

	// 重新加载配置文件
	if err := cs.koanf.Load(cs.fileProvider, jsonparser.Parser()); err != nil {
		return &ConfigError{Operation: "reset_reload_config", Err: err}
	}

	// 重新启动文件监听
	cs.startWatching()

	// 手动触发配置变更检查，确保通知系统能感知到变更
	if cs.notificationService != nil {
		cs.notificationService.CheckConfigChanges()
	}

	return nil
}

// writeConfigToFile 将配置写回JSON文件
func (cs *ConfigService) writeConfigToFile() error {
	configBytes, err := cs.koanf.Marshal(jsonparser.Parser())
	if err != nil {
		return &ConfigError{Operation: "marshal_config", Err: err}
	}

	if err := os.WriteFile(cs.settingsPath, configBytes, 0644); err != nil {
		return &ConfigError{Operation: "write_config_file", Err: err}
	}

	return nil
}

// SetHotkeyChangeCallback 设置热键配置变更回调
func (cs *ConfigService) SetHotkeyChangeCallback(callback func(enable bool, hotkey *models.HotkeyCombo) error) error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	// 创建热键监听器并注册
	hotkeyListener := CreateHotkeyListener("DefaultHotkeyListener", callback)
	return cs.notificationService.RegisterListener(hotkeyListener)
}

// SetDataPathChangeCallback 设置数据路径配置变更回调
func (cs *ConfigService) SetDataPathChangeCallback(callback func() error) error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	// 创建数据路径监听器并注册
	dataPathListener := CreateDataPathListener("DefaultDataPathListener", callback)
	return cs.notificationService.RegisterListener(dataPathListener)
}

// ServiceShutdown 关闭服务
func (cs *ConfigService) ServiceShutdown() error {
	cs.stopWatching()
	if cs.notificationService != nil {
		cs.notificationService.Cleanup()
	}
	return nil
}
