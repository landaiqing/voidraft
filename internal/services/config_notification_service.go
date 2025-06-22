package services

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"sync"
	"time"
	"voidraft/internal/models"

	"github.com/knadh/koanf/v2"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// ConfigChangeType 配置变更类型
type ConfigChangeType string

const (
	// ConfigChangeTypeHotkey 热键配置变更
	ConfigChangeTypeHotkey ConfigChangeType = "hotkey"
	// ConfigChangeTypeDataPath 数据路径配置变更
	ConfigChangeTypeDataPath ConfigChangeType = "datapath"
)

// ConfigChangeCallback 配置变更回调函数类型
type ConfigChangeCallback func(changeType ConfigChangeType, oldConfig, newConfig *models.AppConfig) error

// ConfigListener 配置监听器
type ConfigListener struct {
	Name          string                               // 监听器名称
	ChangeType    ConfigChangeType                     // 监听的配置变更类型
	Callback      ConfigChangeCallback                 // 回调函数（现在包含新旧配置）
	DebounceDelay time.Duration                        // 防抖延迟时间
	GetConfigFunc func(*koanf.Koanf) *models.AppConfig // 获取相关配置的函数

	// 内部状态
	mu             sync.RWMutex      // 监听器状态锁
	timer          *time.Timer       // 防抖定时器
	lastConfigHash string            // 上次配置的哈希值，用于变更检测
	lastConfig     *models.AppConfig // 上次的配置副本
	ctx            context.Context
	cancel         context.CancelFunc
}

// ConfigNotificationService 配置通知服务
type ConfigNotificationService struct {
	listeners sync.Map           // 使用sync.Map替代普通map+锁
	logger    *log.LoggerService // 日志服务
	koanf     *koanf.Koanf       // koanf实例
	ctx       context.Context
	cancel    context.CancelFunc
	wg        sync.WaitGroup
}

// NewConfigNotificationService 创建配置通知服务
func NewConfigNotificationService(k *koanf.Koanf, logger *log.LoggerService) *ConfigNotificationService {
	ctx, cancel := context.WithCancel(context.Background())
	return &ConfigNotificationService{
		logger: logger,
		koanf:  k,
		ctx:    ctx,
		cancel: cancel,
	}
}

// RegisterListener 注册配置监听器
func (cns *ConfigNotificationService) RegisterListener(listener *ConfigListener) error {
	// 清理已存在的监听器
	if existingValue, loaded := cns.listeners.LoadAndDelete(listener.ChangeType); loaded {
		if existing, ok := existingValue.(interface{ cancel() }); ok {
			existing.cancel()
		}
	}

	// 初始化新监听器
	listener.ctx, listener.cancel = context.WithCancel(cns.ctx)
	if err := cns.initializeListenerState(listener); err != nil {
		listener.cancel()
		return fmt.Errorf("failed to initialize listener state: %w", err)
	}

	cns.listeners.Store(listener.ChangeType, listener)
	return nil
}

// initializeListenerState 初始化监听器状态
func (cns *ConfigNotificationService) initializeListenerState(listener *ConfigListener) error {
	if listener.GetConfigFunc == nil {
		return fmt.Errorf("GetConfigFunc is required")
	}

	if config := listener.GetConfigFunc(cns.koanf); config != nil {
		listener.mu.Lock()
		listener.lastConfig = deepCopyConfig(config)
		listener.lastConfigHash = computeConfigHash(config)
		listener.mu.Unlock()
	}

	return nil
}

// UnregisterListener 注销配置监听器
func (cns *ConfigNotificationService) UnregisterListener(changeType ConfigChangeType) {
	if value, loaded := cns.listeners.LoadAndDelete(changeType); loaded {
		if listener, ok := value.(*ConfigListener); ok {
			listener.cancel()
		}
	}
}

// CheckConfigChanges 检查配置变更并通知相关监听器
func (cns *ConfigNotificationService) CheckConfigChanges() {
	cns.listeners.Range(func(key, value interface{}) bool {
		if listener, ok := value.(*ConfigListener); ok {
			cns.checkAndNotify(listener)
		}
		return true
	})
}

// checkAndNotify 检查配置变更并通知
func (cns *ConfigNotificationService) checkAndNotify(listener *ConfigListener) {
	if listener.GetConfigFunc == nil {
		return
	}

	currentConfig := listener.GetConfigFunc(cns.koanf)

	listener.mu.RLock()
	lastHash := listener.lastConfigHash
	lastConfig := listener.lastConfig
	listener.mu.RUnlock()

	var hasChanges bool
	var currentHash string

	if currentConfig != nil {
		currentHash = computeConfigHash(currentConfig)
		hasChanges = currentHash != lastHash
	} else {
		hasChanges = lastConfig != nil
	}

	if hasChanges {
		listener.mu.Lock()
		listener.lastConfig = deepCopyConfig(currentConfig)
		listener.lastConfigHash = currentHash
		listener.mu.Unlock()

		cns.debounceNotify(listener, lastConfig, currentConfig)
	}
}

// computeConfigHash 计算配置的哈希值
func computeConfigHash(config *models.AppConfig) string {
	if config == nil {
		return ""
	}

	jsonBytes, err := json.Marshal(config)
	if err != nil {
		return fmt.Sprintf("%p", config)
	}

	hash := sha256.Sum256(jsonBytes)
	return fmt.Sprintf("%x", hash)
}

// deepCopyConfig 深拷贝配置对象
func deepCopyConfig(src *models.AppConfig) *models.AppConfig {
	if src == nil {
		return nil
	}

	jsonBytes, err := json.Marshal(src)
	if err != nil {
		return src
	}

	var dst models.AppConfig
	if err := json.Unmarshal(jsonBytes, &dst); err != nil {
		return src
	}

	return &dst
}

// debounceNotify 防抖通知
func (cns *ConfigNotificationService) debounceNotify(listener *ConfigListener, oldConfig, newConfig *models.AppConfig) {
	listener.mu.Lock()
	defer listener.mu.Unlock()

	// 取消之前的定时器
	if listener.timer != nil {
		listener.timer.Stop()
	}

	// 创建配置副本，避免在闭包中持有原始引用
	oldConfigCopy := deepCopyConfig(oldConfig)
	newConfigCopy := deepCopyConfig(newConfig)

	changeType := listener.ChangeType

	listener.timer = time.AfterFunc(listener.DebounceDelay, func() {
		cns.executeCallback(listener.ctx, changeType, listener.Callback, oldConfigCopy, newConfigCopy)
	})
}

// executeCallback 执行回调函数
func (cns *ConfigNotificationService) executeCallback(
	ctx context.Context,
	changeType ConfigChangeType,
	callback ConfigChangeCallback,
	oldConfig, newConfig *models.AppConfig,
) {
	cns.wg.Add(1)
	go func() {
		defer cns.wg.Done()
		defer func() {
			if r := recover(); r != nil {
				cns.logger.Error("config callback panic", "error", r)
			}
		}()

		callbackCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()

		done := make(chan error, 1)
		go func() {
			done <- callback(changeType, oldConfig, newConfig)
		}()

		select {
		case <-callbackCtx.Done():
			cns.logger.Error("config callback timeout")
		case err := <-done:
			if err != nil {
				cns.logger.Error("config callback error", "error", err)
			}
		}
	}()
}

// Cleanup 清理所有监听器
func (cns *ConfigNotificationService) Cleanup() {
	cns.cancel() // 取消所有context

	cns.listeners.Range(func(key, value interface{}) bool {
		cns.listeners.Delete(key)
		return true
	})

	cns.wg.Wait() // 等待所有协程完成
}

// CreateHotkeyListener 创建热键配置监听器
func CreateHotkeyListener(callback func(enable bool, hotkey *models.HotkeyCombo) error) *ConfigListener {
	return &ConfigListener{
		Name:       "HotkeyListener",
		ChangeType: ConfigChangeTypeHotkey,
		Callback: func(changeType ConfigChangeType, oldConfig, newConfig *models.AppConfig) error {
			if newConfig != nil {
				return callback(newConfig.General.EnableGlobalHotkey, &newConfig.General.GlobalHotkey)
			}
			// 使用默认配置
			defaultConfig := models.NewDefaultAppConfig()
			return callback(defaultConfig.General.EnableGlobalHotkey, &defaultConfig.General.GlobalHotkey)
		},
		DebounceDelay: 200 * time.Millisecond,
		GetConfigFunc: func(k *koanf.Koanf) *models.AppConfig {
			var config models.AppConfig
			if err := k.Unmarshal("", &config); err != nil {
				return nil
			}
			return &config
		},
	}
}

// CreateDataPathListener 创建数据路径配置监听器
func CreateDataPathListener(callback func(oldPath, newPath string) error) *ConfigListener {
	return &ConfigListener{
		Name:       "DataPathListener",
		ChangeType: ConfigChangeTypeDataPath,
		Callback: func(changeType ConfigChangeType, oldConfig, newConfig *models.AppConfig) error {
			var oldPath, newPath string

			if oldConfig != nil {
				oldPath = oldConfig.General.DataPath
			}

			if newConfig != nil {
				newPath = newConfig.General.DataPath
			} else {
				defaultConfig := models.NewDefaultAppConfig()
				newPath = defaultConfig.General.DataPath
			}

			if oldPath != newPath {
				return callback(oldPath, newPath)
			}
			return nil
		},
		DebounceDelay: 100 * time.Millisecond,
		GetConfigFunc: func(k *koanf.Koanf) *models.AppConfig {
			var config models.AppConfig
			if err := k.Unmarshal("", &config); err != nil {
				return nil
			}
			return &config
		},
	}
}

// ServiceShutdown 关闭服务
func (cns *ConfigNotificationService) ServiceShutdown() error {
	cns.Cleanup()
	return nil
}
