package services

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
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
	koanf        *koanf.Koanf    // koanf 实例
	logger       *log.LogService // 日志服务
	configDir    string          // 配置目录
	settingsPath string          // 设置文件路径
	mu           sync.RWMutex    // 读写锁
	fileProvider *file.File      // 文件提供器，用于监听

	observer *ConfigObserver

	// 配置迁移器
	configMigrator *ConfigMigrator
}

// NewConfigService 创建新的配置服务实例
func NewConfigService(logger *log.LogService) *ConfigService {
	// 获取用户主目录
	homeDir, err := os.UserHomeDir()
	if err != nil {
		panic(fmt.Errorf("unable to get the user's home directory: %w", err))
	}

	// 设置配置目录和设置文件路径
	configDir := filepath.Join(homeDir, ".voidraft", "config")
	settingsPath := filepath.Join(configDir, "settings.json")

	cs := &ConfigService{
		logger:       logger,
		configDir:    configDir,
		settingsPath: settingsPath,
		koanf:        koanf.New("."),
	}

	// 初始化配置观察者系统
	cs.observer = NewConfigObserver(logger)

	// 初始化配置迁移器
	cs.configMigrator = NewConfigMigrator(logger, configDir, "settings", settingsPath)

	cs.initConfig()

	// 启动配置文件监听
	cs.startWatching()

	return cs
}

// setDefaults 设置默认配置
func (cs *ConfigService) setDefaults() error {
	defaultConfig := models.NewDefaultAppConfig()

	if err := cs.koanf.Load(structs.Provider(defaultConfig, "json"), nil); err != nil {
		return err
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

	// 配置文件存在，直接加载现有配置
	cs.fileProvider = file.Provider(cs.settingsPath)
	if err := cs.koanf.Load(cs.fileProvider, jsonparser.Parser()); err != nil {
		return err
	}

	return nil
}

// MigrateConfig 执行配置迁移
func (cs *ConfigService) MigrateConfig() error {
	if cs.configMigrator == nil {
		return nil
	}

	defaultConfig := models.NewDefaultAppConfig()
	result, err := cs.configMigrator.AutoMigrate(defaultConfig, cs.koanf)

	if err != nil {
		cs.logger.Error("Failed to check config migration", "error", err)
		return err
	}

	if result != nil && result.Migrated {
		cs.logger.Info("Config migration performed",
			"fields", result.MissingFields,
			"backup", result.BackupPath)
	}

	return nil
}

// createDefaultConfig 创建默认配置文件
func (cs *ConfigService) createDefaultConfig() error {
	// 确保配置目录存在
	if err := os.MkdirAll(cs.configDir, 0755); err != nil {
		return err
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
		return err
	}
	return nil
}

// startWatching 启动配置文件监听
func (cs *ConfigService) startWatching() {
	if cs.fileProvider == nil {
		return
	}
	cs.fileProvider.Watch(func(event interface{}, err error) {
		if err != nil {
			return
		}

		cs.mu.Lock()
		oldSnapshot := cs.createConfigSnapshot()
		cs.koanf.Load(cs.fileProvider, jsonparser.Parser())
		cs.mu.Unlock()

		// 检测配置变更并通知观察者
		cs.detectAndNotifyChanges(oldSnapshot)
	})

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
		return nil, err
	}

	return &config, nil
}

// Set 设置配置项
func (cs *ConfigService) Set(key string, value interface{}) error {
	cs.mu.Lock()

	// 获取旧值
	oldValue := cs.koanf.Get(key)

	// 设置值到koanf
	cs.koanf.Set(key, value)

	// 更新时间戳
	cs.koanf.Set("metadata.lastUpdated", time.Now().Format(time.RFC3339))

	// 将配置写回文件
	err := cs.writeConfigToFile()
	cs.mu.Unlock()

	if err != nil {
		return err
	}

	if cs.observer != nil {
		cs.observer.Notify(key, oldValue, value)
	}

	return nil
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

	// 保存旧配置快照
	oldSnapshot := cs.createConfigSnapshot()

	// 停止文件监听
	if cs.fileProvider != nil {
		cs.fileProvider.Unwatch()
		cs.fileProvider = nil
	}

	// 设置默认配置
	if err := cs.setDefaults(); err != nil {
		cs.mu.Unlock()
		return err
	}

	// 写入配置文件
	if err := cs.writeConfigToFile(); err != nil {
		cs.mu.Unlock()
		return err
	}

	// 重新创建koanf实例
	cs.koanf = koanf.New(".")

	// 重新加载默认配置到koanf
	if err := cs.setDefaults(); err != nil {
		cs.mu.Unlock()
		return err
	}

	// 重新创建文件提供器
	cs.fileProvider = file.Provider(cs.settingsPath)

	// 重新加载配置文件
	if err := cs.koanf.Load(cs.fileProvider, jsonparser.Parser()); err != nil {
		cs.mu.Unlock()
		return err
	}

	cs.mu.Unlock()

	// 重新启动文件监听
	cs.startWatching()

	// 检测配置变更并通知观察者
	cs.detectAndNotifyChanges(oldSnapshot)

	return nil
}

// writeConfigToFile 将配置写回JSON文件
func (cs *ConfigService) writeConfigToFile() error {
	configBytes, err := cs.koanf.Marshal(jsonparser.Parser())
	if err != nil {
		return err
	}

	if err := os.WriteFile(cs.settingsPath, configBytes, 0644); err != nil {
		return err
	}

	return nil
}

// Watch 注册配置变更监听器
func (cs *ConfigService) Watch(path string, callback ObserverCallback) CancelFunc {
	return cs.observer.Watch(path, callback)
}

// WatchWithContext 使用 Context 注册监听器
func (cs *ConfigService) WatchWithContext(ctx context.Context, path string, callback ObserverCallback) {
	cs.observer.WatchWithContext(ctx, path, callback)
}

// createConfigSnapshot 创建当前配置的快照
func (cs *ConfigService) createConfigSnapshot() map[string]interface{} {
	cs.mu.RLock()
	defer cs.mu.RUnlock()
	snapshot := make(map[string]interface{})
	allKeys := cs.koanf.All()

	// 递归展平配置
	flattenMap("", allKeys, snapshot)
	return snapshot
}

// flattenMap 递归展平嵌套的 map（使用 strings.Builder 优化字符串拼接）
func flattenMap(prefix string, data map[string]interface{}, result map[string]interface{}) {
	var builder strings.Builder
	for key, value := range data {
		builder.Reset()
		if prefix != "" {
			builder.WriteString(prefix)
			builder.WriteString(".")
		}
		builder.WriteString(key)
		fullKey := builder.String()

		if valueMap, ok := value.(map[string]interface{}); ok {
			// 递归处理嵌套 map
			flattenMap(fullKey, valueMap, result)
		} else {
			// 保存叶子节点
			result[fullKey] = value
		}
	}
}

// detectAndNotifyChanges 检测配置变更并通知观察者
func (cs *ConfigService) detectAndNotifyChanges(oldSnapshot map[string]interface{}) {
	// 创建新快照
	newSnapshot := cs.createConfigSnapshot()

	// 检测变更
	changes := make(map[string]struct {
		OldValue interface{}
		NewValue interface{}
	})

	// 检查新增和修改的键
	for key, newValue := range newSnapshot {
		oldValue, exists := oldSnapshot[key]
		if !exists || !isEqual(oldValue, newValue) {
			changes[key] = struct {
				OldValue interface{}
				NewValue interface{}
			}{
				OldValue: oldValue,
				NewValue: newValue,
			}
		}
	}

	// 检查删除的键
	for key, oldValue := range oldSnapshot {
		if _, exists := newSnapshot[key]; !exists {
			changes[key] = struct {
				OldValue interface{}
				NewValue interface{}
			}{
				OldValue: oldValue,
				NewValue: nil,
			}
		}
	}

	// 通知所有变更
	if cs.observer != nil && len(changes) > 0 {
		cs.observer.NotifyAll(changes)
	}
}

// isEqual 值相等比较
func isEqual(a, b interface{}) bool {
	aJSON, _ := json.Marshal(a)
	bJSON, _ := json.Marshal(b)
	return string(aJSON) == string(bJSON)
}

// ServiceShutdown 关闭服务
func (cs *ConfigService) ServiceShutdown() error {
	cs.stopWatching()
	if cs.observer != nil {
		cs.observer.Shutdown()
	}
	return nil
}
