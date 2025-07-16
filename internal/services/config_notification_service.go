package services

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"reflect"
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
	// ConfigChangeTypeBackup 备份配置变更
	ConfigChangeTypeBackup ConfigChangeType = "backup"
)

// ConfigChangeCallback 配置变更回调函数类型
type ConfigChangeCallback func(changeType ConfigChangeType, oldConfig, newConfig *models.AppConfig) error

// ConfigListener 配置监听器
type ConfigListener struct {
	ID            string                               // 监听器唯一ID
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
	listeners map[ConfigChangeType][]*ConfigListener // 支持多监听器的map
	mu        sync.RWMutex                           // 监听器map的读写锁
	logger    *log.Service                           // 日志服务
	koanf     *koanf.Koanf                           // koanf实例
	ctx       context.Context
	cancel    context.CancelFunc
	wg        sync.WaitGroup
}

// NewConfigNotificationService 创建配置通知服务
func NewConfigNotificationService(k *koanf.Koanf, logger *log.Service) *ConfigNotificationService {
	ctx, cancel := context.WithCancel(context.Background())
	return &ConfigNotificationService{
		listeners: make(map[ConfigChangeType][]*ConfigListener),
		logger:    logger,
		koanf:     k,
		ctx:       ctx,
		cancel:    cancel,
	}
}

// RegisterListener 注册配置监听器
func (cns *ConfigNotificationService) RegisterListener(listener *ConfigListener) error {
	// 生成唯一ID如果没有提供
	if listener.ID == "" {
		listener.ID = fmt.Sprintf("%s_%d", listener.Name, time.Now().UnixNano())
	}

	// 初始化新监听器
	listener.ctx, listener.cancel = context.WithCancel(cns.ctx)
	if err := cns.initializeListenerState(listener); err != nil {
		listener.cancel()
		return fmt.Errorf("failed to initialize listener state: %w", err)
	}

	// 添加到监听器列表
	cns.mu.Lock()
	cns.listeners[listener.ChangeType] = append(cns.listeners[listener.ChangeType], listener)
	cns.mu.Unlock()

	return nil
}

// initializeListenerState 初始化监听器状态
func (cns *ConfigNotificationService) initializeListenerState(listener *ConfigListener) error {
	if listener.GetConfigFunc == nil {
		return fmt.Errorf("GetConfigFunc is required")
	}

	if config := listener.GetConfigFunc(cns.koanf); config != nil {
		listener.mu.Lock()
		listener.lastConfig = deepCopyConfigReflect(config)
		listener.lastConfigHash = computeConfigHash(config)
		listener.mu.Unlock()
	}

	return nil
}

// UnregisterListener 注销指定ID的配置监听器
func (cns *ConfigNotificationService) UnregisterListener(changeType ConfigChangeType, listenerID string) {
	cns.mu.Lock()
	defer cns.mu.Unlock()

	listeners := cns.listeners[changeType]
	for i, listener := range listeners {
		if listener.ID == listenerID {
			// 取消监听器
			listener.cancel()
			// 从切片中移除
			cns.listeners[changeType] = append(listeners[:i], listeners[i+1:]...)
			break
		}
	}

	// 如果该类型没有监听器了，删除整个条目
	if len(cns.listeners[changeType]) == 0 {
		delete(cns.listeners, changeType)
	}
}

// UnregisterAllListeners 注销指定类型的所有监听器
func (cns *ConfigNotificationService) UnregisterAllListeners(changeType ConfigChangeType) {
	cns.mu.Lock()
	defer cns.mu.Unlock()

	if listeners, exists := cns.listeners[changeType]; exists {
		for _, listener := range listeners {
			listener.cancel()
		}
		delete(cns.listeners, changeType)
	}
}

// CheckConfigChanges 检查配置变更并通知相关监听器
func (cns *ConfigNotificationService) CheckConfigChanges() {
	cns.mu.RLock()
	allListeners := make(map[ConfigChangeType][]*ConfigListener)
	for changeType, listeners := range cns.listeners {
		// 创建监听器切片的副本以避免并发访问问题
		listenersCopy := make([]*ConfigListener, len(listeners))
		copy(listenersCopy, listeners)
		allListeners[changeType] = listenersCopy
	}
	cns.mu.RUnlock()

	// 检查所有监听器
	for _, listeners := range allListeners {
		for _, listener := range listeners {
			cns.checkAndNotify(listener)
		}
	}
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
		listener.lastConfig = deepCopyConfigReflect(currentConfig)
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

// deepCopyConfigReflect 使用反射实现高效深拷贝
func deepCopyConfigReflect(src *models.AppConfig) *models.AppConfig {
	if src == nil {
		return nil
	}

	// 使用反射进行深拷贝
	srcValue := reflect.ValueOf(src).Elem()
	dstValue := reflect.New(srcValue.Type()).Elem()

	deepCopyValue(srcValue, dstValue)

	return dstValue.Addr().Interface().(*models.AppConfig)
}

// deepCopyValue 递归深拷贝reflect.Value
func deepCopyValue(src, dst reflect.Value) {
	switch src.Kind() {
	case reflect.Ptr:
		if src.IsNil() {
			return
		}
		dst.Set(reflect.New(src.Elem().Type()))
		deepCopyValue(src.Elem(), dst.Elem())

	case reflect.Struct:
		for i := 0; i < src.NumField(); i++ {
			if dst.Field(i).CanSet() {
				deepCopyValue(src.Field(i), dst.Field(i))
			}
		}

	case reflect.Slice:
		if src.IsNil() {
			return
		}
		dst.Set(reflect.MakeSlice(src.Type(), src.Len(), src.Cap()))
		for i := 0; i < src.Len(); i++ {
			deepCopyValue(src.Index(i), dst.Index(i))
		}

	case reflect.Map:
		if src.IsNil() {
			return
		}
		dst.Set(reflect.MakeMap(src.Type()))
		for _, key := range src.MapKeys() {
			srcValue := src.MapIndex(key)
			dstValue := reflect.New(srcValue.Type()).Elem()
			deepCopyValue(srcValue, dstValue)
			dst.SetMapIndex(key, dstValue)
		}

	case reflect.Interface:
		if src.IsNil() {
			return
		}
		srcValue := src.Elem()
		dstValue := reflect.New(srcValue.Type()).Elem()
		deepCopyValue(srcValue, dstValue)
		dst.Set(dstValue)

	case reflect.Array:
		for i := 0; i < src.Len(); i++ {
			deepCopyValue(src.Index(i), dst.Index(i))
		}

	default:
		// 对于基本类型和string，直接赋值
		if dst.CanSet() {
			dst.Set(src)
		}
	}
}

// deepCopyConfig 保留原有的JSON深拷贝方法作为备用
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
	oldConfigCopy := deepCopyConfigReflect(oldConfig)
	newConfigCopy := deepCopyConfigReflect(newConfig)

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

	cns.mu.Lock()
	for changeType, listeners := range cns.listeners {
		for _, listener := range listeners {
			listener.cancel()
		}
		delete(cns.listeners, changeType)
	}
	cns.mu.Unlock()

	cns.wg.Wait() // 等待所有协程完成
}

// GetListeners 获取指定类型的所有监听器
func (cns *ConfigNotificationService) GetListeners(changeType ConfigChangeType) []*ConfigListener {
	cns.mu.RLock()
	defer cns.mu.RUnlock()

	listeners := cns.listeners[changeType]
	result := make([]*ConfigListener, len(listeners))
	copy(result, listeners)
	return result
}

// CreateHotkeyListener 创建热键配置监听器
func CreateHotkeyListener(name string, callback func(enable bool, hotkey *models.HotkeyCombo) error) *ConfigListener {
	return &ConfigListener{
		Name:       name,
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
func CreateDataPathListener(name string, callback func() error) *ConfigListener {
	return &ConfigListener{
		Name:       name,
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
				return callback()
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

// CreateBackupConfigListener 创建备份配置监听器
func CreateBackupConfigListener(name string, callback func(config *models.GitBackupConfig) error) *ConfigListener {
	return &ConfigListener{
		Name:       name,
		ChangeType: ConfigChangeTypeBackup,
		Callback: func(changeType ConfigChangeType, oldConfig, newConfig *models.AppConfig) error {
			if newConfig == nil {
				defaultConfig := models.NewDefaultAppConfig()
				return callback(&defaultConfig.Backup)
			}
			return callback(&newConfig.Backup)
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

// ServiceShutdown 关闭服务
func (cns *ConfigNotificationService) ServiceShutdown() error {
	cns.Cleanup()
	return nil
}
