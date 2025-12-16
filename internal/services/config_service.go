package services

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"sync"
	"time"
	"voidraft/internal/common/helper"
	"voidraft/internal/models"

	jsonparser "github.com/knadh/koanf/parsers/json"
	"github.com/knadh/koanf/providers/file"
	"github.com/knadh/koanf/providers/structs"
	"github.com/knadh/koanf/v2"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// ConfigService 应用配置服务
type ConfigService struct {
	koanf        *koanf.Koanf
	logger       *log.LogService
	configDir    string
	settingsPath string
	mu           sync.RWMutex
	observer     *helper.ConfigObserver

	// 配置迁移器
	configMigrator *ConfigMigrator
}

// NewConfigService 创建新的配置服务实例
func NewConfigService(logger *log.LogService) *ConfigService {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		panic(fmt.Errorf("unable to get the user's home directory: %w", err))
	}

	configDir := filepath.Join(homeDir, ".voidraft", "config")
	settingsPath := filepath.Join(configDir, "settings.json")

	return &ConfigService{
		logger:         logger,
		configDir:      configDir,
		settingsPath:   settingsPath,
		koanf:          koanf.New("."),
		observer:       helper.NewConfigObserver(logger),
		configMigrator: NewConfigMigrator(logger, configDir, "settings", settingsPath),
	}
}

// ServiceStartup 服务启动时初始化
func (cs *ConfigService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	if err := cs.initConfig(); err != nil {
		panic(err)
	}
	return nil
}

// initConfig 初始化配置
func (cs *ConfigService) initConfig() error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	// 确保配置目录存在
	if err := os.MkdirAll(cs.configDir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	// 配置文件不存在，创建默认配置
	if _, err := os.Stat(cs.settingsPath); os.IsNotExist(err) {
		return cs.createDefaultConfig()
	}

	// 加载现有配置
	if err := cs.koanf.Load(file.Provider(cs.settingsPath), jsonparser.Parser()); err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	return nil
}

// createDefaultConfig 创建默认配置
func (cs *ConfigService) createDefaultConfig() error {
	// 重置 koanf 实例
	cs.koanf = koanf.New(".")

	// 加载默认配置
	defaultConfig := models.NewDefaultAppConfig()
	if err := cs.koanf.Load(structs.Provider(defaultConfig, "json"), nil); err != nil {
		return fmt.Errorf("failed to load default config: %w", err)
	}

	// 写入配置文件
	if err := cs.writeConfigToFile(); err != nil {
		return fmt.Errorf("failed to write default config: %w", err)
	}

	return nil
}

// MigrateConfig 执行配置迁移
func (cs *ConfigService) MigrateConfig() error {
	if cs.configMigrator == nil {
		return nil
	}

	cs.mu.Lock()
	defer cs.mu.Unlock()

	defaultConfig := models.NewDefaultAppConfig()
	_, err := cs.configMigrator.AutoMigrate(defaultConfig, cs.koanf)
	return err
}

// GetConfig 获取完整应用配置
func (cs *ConfigService) GetConfig() (*models.AppConfig, error) {
	cs.mu.RLock()
	defer cs.mu.RUnlock()

	var config models.AppConfig
	if err := cs.koanf.UnmarshalWithConf("", &config, koanf.UnmarshalConf{Tag: "json"}); err != nil {
		return nil, err
	}
	return &config, nil
}

// Get 获取配置项
func (cs *ConfigService) Get(key string) interface{} {
	cs.mu.RLock()
	defer cs.mu.RUnlock()
	return cs.koanf.Get(key)
}

// Set 设置配置项
func (cs *ConfigService) Set(key string, value interface{}) error {
	cs.mu.Lock()

	// 获取旧值
	oldValue := cs.koanf.Get(key)

	// 值未变化，直接返回
	if reflect.DeepEqual(oldValue, value) {
		cs.mu.Unlock()
		return nil
	}

	// 设置新值
	err := cs.koanf.Set(key, value)
	if err != nil {
		cs.mu.Unlock()
		return err
	}
	err = cs.koanf.Set("metadata.lastUpdated", time.Now().Format(time.RFC3339))
	if err != nil {
		cs.mu.Unlock()
		return err
	}

	// 写入文件
	if err = cs.writeConfigToFile(); err != nil {
		cs.mu.Unlock()
		return fmt.Errorf("failed to write config: %w", err)
	}

	cs.mu.Unlock()

	// 通知观察者
	if cs.observer != nil {
		cs.observer.Notify(key, oldValue, value)
	} else {
		cs.logger.Error("config observer is nil")
	}

	return nil
}

// ResetConfig 重置所有配置为默认值
func (cs *ConfigService) ResetConfig() error {
	cs.mu.Lock()

	// 保存旧配置快照
	oldSnapshot := cs.createSnapshot()

	// 重置为默认配置
	cs.koanf = koanf.New(".")
	defaultConfig := models.NewDefaultAppConfig()
	if err := cs.koanf.Load(structs.Provider(defaultConfig, "json"), nil); err != nil {
		cs.mu.Unlock()
		return fmt.Errorf("failed to load default config: %w", err)
	}

	// 写入配置文件
	if err := cs.writeConfigToFile(); err != nil {
		cs.mu.Unlock()
		return fmt.Errorf("failed to write config: %w", err)
	}

	newSnapshot := cs.createSnapshot()
	cs.mu.Unlock()

	// 通知配置变更
	cs.notifyChanges(oldSnapshot, newSnapshot)

	return nil
}

// writeConfigToFile 将配置写入文件
func (cs *ConfigService) writeConfigToFile() error {
	configBytes, err := cs.koanf.Marshal(jsonparser.Parser())
	if err != nil {
		return err
	}
	return os.WriteFile(cs.settingsPath, configBytes, 0644)
}

// Watch 注册配置变更监听器
func (cs *ConfigService) Watch(path string, callback helper.ObserverCallback) helper.CancelFunc {
	return cs.observer.Watch(path, callback)
}

// WatchWithContext 使用 Context 注册监听器
func (cs *ConfigService) WatchWithContext(ctx context.Context, path string, callback helper.ObserverCallback) {
	cs.observer.WatchWithContext(ctx, path, callback)
}

// createSnapshotLocked 创建配置快照
func (cs *ConfigService) createSnapshot() map[string]interface{} {
	snapshot := make(map[string]interface{})
	for _, key := range cs.koanf.Keys() {
		snapshot[key] = cs.koanf.Get(key)
	}
	return snapshot
}

// notifyChanges 检测配置变更并通知观察者
func (cs *ConfigService) notifyChanges(oldSnapshot, newSnapshot map[string]interface{}) {
	if cs.observer == nil {
		return
	}

	changes := make(map[string]struct {
		OldValue interface{}
		NewValue interface{}
	})

	// 检查新增和修改的键
	for key, newValue := range newSnapshot {
		oldValue, exists := oldSnapshot[key]
		if !exists || !reflect.DeepEqual(oldValue, newValue) {
			changes[key] = struct {
				OldValue interface{}
				NewValue interface{}
			}{oldValue, newValue}
		}
	}

	// 检查删除的键
	for key, oldValue := range oldSnapshot {
		if _, exists := newSnapshot[key]; !exists {
			changes[key] = struct {
				OldValue interface{}
				NewValue interface{}
			}{oldValue, nil}
		}
	}

	// 批量通知
	if len(changes) > 0 {
		cs.observer.NotifyAll(changes)
	}
}

// ServiceShutdown 关闭服务
func (cs *ConfigService) ServiceShutdown() error {
	if cs.observer != nil {
		cs.observer.Shutdown()
	}
	return nil
}
