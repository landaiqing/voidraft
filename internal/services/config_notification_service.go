package services

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"reflect"
	"sync"
	"time"
	"voidraft/internal/models"

	"github.com/spf13/viper"
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
type ConfigChangeCallback func(changeType ConfigChangeType, oldConfig, newConfig interface{}) error

// ConfigListener 配置监听器
type ConfigListener struct {
	Name          string                         // 监听器名称
	ChangeType    ConfigChangeType               // 监听的配置变更类型
	Callback      ConfigChangeCallback           // 回调函数（现在包含新旧配置）
	DebounceDelay time.Duration                  // 防抖延迟时间
	GetConfigFunc func(*viper.Viper) interface{} // 获取相关配置的函数

	// 内部状态
	mu             sync.RWMutex  // 监听器状态锁
	timer          *time.Timer   // 防抖定时器
	lastConfigHash string        // 上次配置的哈希值，用于变更检测
	lastConfig     interface{}   // 上次的配置副本
	stopChan       chan struct{} // 停止通道，用于停止异步goroutine
}

// ConfigNotificationService 配置通知服务
type ConfigNotificationService struct {
	listeners map[ConfigChangeType]*ConfigListener // 监听器映射
	mu        sync.RWMutex                         // 读写锁
	logger    *log.LoggerService                   // 日志服务
	viper     *viper.Viper                         // Viper实例
}

// NewConfigNotificationService 创建配置通知服务
func NewConfigNotificationService(viper *viper.Viper, logger *log.LoggerService) *ConfigNotificationService {
	return &ConfigNotificationService{
		listeners: make(map[ConfigChangeType]*ConfigListener),
		logger:    logger,
		viper:     viper,
	}
}

// RegisterListener 注册配置监听器
func (cns *ConfigNotificationService) RegisterListener(listener *ConfigListener) error {
	cns.mu.Lock()
	defer cns.mu.Unlock()

	// 检查是否已存在同类型监听器
	if existingListener, exists := cns.listeners[listener.ChangeType]; exists {
		cns.logger.Warning("ConfigNotification: Listener already exists, will be replaced",
			"existing_name", existingListener.Name,
			"new_name", listener.Name,
			"type", string(listener.ChangeType))

		// 清理旧监听器
		cns.cleanupListener(existingListener)
	}

	// 初始化新监听器
	listener.stopChan = make(chan struct{})

	// 初始化监听器的配置状态
	if err := cns.initializeListenerState(listener); err != nil {
		cns.logger.Error("ConfigNotification: Failed to initialize listener state",
			"listener", listener.Name,
			"error", err)
		return fmt.Errorf("failed to initialize listener state: %w", err)
	}

	cns.listeners[listener.ChangeType] = listener
	cns.logger.Info("ConfigNotification: Registered listener",
		"name", listener.Name,
		"type", string(listener.ChangeType))

	return nil
}

// cleanupListener 清理监听器资源
func (cns *ConfigNotificationService) cleanupListener(listener *ConfigListener) {
	listener.mu.Lock()
	defer listener.mu.Unlock()

	// 停止防抖定时器
	if listener.timer != nil {
		listener.timer.Stop()
		listener.timer = nil
	}

	// 关闭停止通道，通知goroutine退出
	if listener.stopChan != nil {
		close(listener.stopChan)
		listener.stopChan = nil
	}
}

// initializeListenerState 初始化监听器状态
func (cns *ConfigNotificationService) initializeListenerState(listener *ConfigListener) error {
	if listener.GetConfigFunc == nil {
		return fmt.Errorf("GetConfigFunc is required")
	}

	// 获取初始配置
	config := listener.GetConfigFunc(cns.viper)
	if config != nil {
		listener.mu.Lock()
		listener.lastConfig = cns.deepCopy(config)
		listener.lastConfigHash = cns.computeConfigHash(config)
		listener.mu.Unlock()
	}

	return nil
}

// UnregisterListener 注销配置监听器
func (cns *ConfigNotificationService) UnregisterListener(changeType ConfigChangeType) {
	cns.mu.Lock()
	defer cns.mu.Unlock()

	if listener, exists := cns.listeners[changeType]; exists {
		cns.cleanupListener(listener)
		delete(cns.listeners, changeType)
		cns.logger.Info("ConfigNotification: Unregistered listener", "type", string(changeType))
	}
}

// CheckConfigChanges 检查配置变更并通知相关监听器
func (cns *ConfigNotificationService) CheckConfigChanges() {
	cns.mu.RLock()
	listeners := make([]*ConfigListener, 0, len(cns.listeners))
	for _, listener := range cns.listeners {
		listeners = append(listeners, listener)
	}
	cns.mu.RUnlock()

	// 检查每个监听器的配置变更
	for _, listener := range listeners {
		if hasChanges, oldConfig, newConfig := cns.checkListenerConfigChanges(listener); hasChanges {
			cns.logger.Debug("ConfigNotification: Actual config change detected",
				"type", string(listener.ChangeType),
				"listener", listener.Name)

			// 触发防抖通知，传递新旧配置
			cns.debounceNotifyWithChanges(listener, oldConfig, newConfig)
		}
	}
}

// checkListenerConfigChanges 检查单个监听器的配置变更
func (cns *ConfigNotificationService) checkListenerConfigChanges(listener *ConfigListener) (bool, interface{}, interface{}) {
	if listener.GetConfigFunc == nil {
		return false, nil, nil
	}

	// 获取当前配置
	currentConfig := listener.GetConfigFunc(cns.viper)

	// 读取监听器状态
	listener.mu.RLock()
	lastHash := listener.lastConfigHash
	lastConfig := listener.lastConfig
	listener.mu.RUnlock()

	if currentConfig == nil {
		// 配置不存在或获取失败
		if lastConfig != nil {
			// 配置被删除，更新状态
			listener.mu.Lock()
			listener.lastConfig = nil
			listener.lastConfigHash = ""
			listener.mu.Unlock()
			return true, lastConfig, nil
		}
		return false, nil, nil
	}

	// 计算当前配置的哈希
	currentHash := cns.computeConfigHash(currentConfig)

	// 检查是否有变更
	if currentHash != lastHash {
		// 更新监听器状态
		listener.mu.Lock()
		listener.lastConfig = cns.deepCopy(currentConfig)
		listener.lastConfigHash = currentHash
		listener.mu.Unlock()

		return true, lastConfig, currentConfig
	}

	return false, nil, nil
}

// computeConfigHash 计算配置的哈希值 - 安全稳定版本
func (cns *ConfigNotificationService) computeConfigHash(config interface{}) string {
	if config == nil {
		return ""
	}

	// 使用JSON序列化确保稳定性和准确性
	jsonBytes, err := json.Marshal(config)
	if err != nil {
		// 如果JSON序列化失败，回退到字符串表示
		cns.logger.Warning("ConfigNotification: JSON marshal failed, using string representation",
			"error", err)
		configStr := fmt.Sprintf("%+v", config)
		jsonBytes = []byte(configStr)
	}

	hash := sha256.Sum256(jsonBytes)
	return fmt.Sprintf("%x", hash)
}

// deepCopy 深拷贝配置对象 - 完整实现
func (cns *ConfigNotificationService) deepCopy(src interface{}) interface{} {
	if src == nil {
		return nil
	}

	// 首先尝试JSON序列化方式深拷贝（适用于大多数配置对象）
	jsonBytes, err := json.Marshal(src)
	if err != nil {
		cns.logger.Warning("ConfigNotification: JSON marshal for deep copy failed, using reflection",
			"error", err)
		return cns.reflectDeepCopy(src)
	}

	// 创建同类型的新对象
	srcType := reflect.TypeOf(src)
	var dst interface{}

	if srcType.Kind() == reflect.Ptr {
		// 对于指针类型，创建指向新对象的指针
		elemType := srcType.Elem()
		newObj := reflect.New(elemType)
		dst = newObj.Interface()
	} else {
		// 对于值类型，创建零值
		newObj := reflect.New(srcType)
		dst = newObj.Interface()
	}

	// 反序列化到新对象
	err = json.Unmarshal(jsonBytes, dst)
	if err != nil {
		cns.logger.Warning("ConfigNotification: JSON unmarshal for deep copy failed, using reflection",
			"error", err)
		return cns.reflectDeepCopy(src)
	}

	// 如果原对象不是指针类型，返回值而不是指针
	if srcType.Kind() != reflect.Ptr {
		return reflect.ValueOf(dst).Elem().Interface()
	}

	return dst
}

// reflectDeepCopy 使用反射进行深拷贝的备用方法
func (cns *ConfigNotificationService) reflectDeepCopy(src interface{}) interface{} {
	srcValue := reflect.ValueOf(src)
	return cns.reflectDeepCopyValue(srcValue).Interface()
}

// reflectDeepCopyValue 递归深拷贝reflect.Value
func (cns *ConfigNotificationService) reflectDeepCopyValue(src reflect.Value) reflect.Value {
	if !src.IsValid() {
		return reflect.Value{}
	}

	switch src.Kind() {
	case reflect.Ptr:
		if src.IsNil() {
			return reflect.New(src.Type()).Elem()
		}
		dst := reflect.New(src.Type().Elem())
		dst.Elem().Set(cns.reflectDeepCopyValue(src.Elem()))
		return dst

	case reflect.Struct:
		dst := reflect.New(src.Type()).Elem()
		for i := 0; i < src.NumField(); i++ {
			if dst.Field(i).CanSet() {
				dst.Field(i).Set(cns.reflectDeepCopyValue(src.Field(i)))
			}
		}
		return dst

	case reflect.Slice:
		if src.IsNil() {
			return reflect.Zero(src.Type())
		}
		dst := reflect.MakeSlice(src.Type(), src.Len(), src.Cap())
		for i := 0; i < src.Len(); i++ {
			dst.Index(i).Set(cns.reflectDeepCopyValue(src.Index(i)))
		}
		return dst

	case reflect.Map:
		if src.IsNil() {
			return reflect.Zero(src.Type())
		}
		dst := reflect.MakeMap(src.Type())
		for _, key := range src.MapKeys() {
			dst.SetMapIndex(key, cns.reflectDeepCopyValue(src.MapIndex(key)))
		}
		return dst

	default:
		return src
	}
}

// debounceNotifyWithChanges 防抖通知（带变更信息）- 修复内存泄漏
func (cns *ConfigNotificationService) debounceNotifyWithChanges(listener *ConfigListener, oldConfig, newConfig interface{}) {
	listener.mu.Lock()
	defer listener.mu.Unlock()

	// 取消之前的定时器
	if listener.timer != nil {
		listener.timer.Stop()
	}

	// 创建配置副本，避免在闭包中持有原始引用
	oldConfigCopy := cns.deepCopy(oldConfig)
	newConfigCopy := cns.deepCopy(newConfig)

	// 获取监听器信息的副本
	listenerName := listener.Name
	changeType := listener.ChangeType
	stopChan := listener.stopChan

	// 设置新的防抖定时器
	listener.timer = time.AfterFunc(listener.DebounceDelay, func() {
		cns.logger.Debug("ConfigNotification: Executing callback after debounce",
			"listener", listenerName,
			"type", string(changeType))

		// 启动独立的goroutine处理回调，带有超时和停止信号检查
		go func() {
			defer func() {
				if r := recover(); r != nil {
					cns.logger.Error("ConfigNotification: Callback panic recovered",
						"listener", listenerName,
						"type", string(changeType),
						"panic", r)
				}
			}()

			// 检查是否收到停止信号
			select {
			case <-stopChan:
				cns.logger.Debug("ConfigNotification: Callback cancelled due to stop signal",
					"listener", listenerName)
				return
			default:
			}

			// 执行回调，设置超时
			callbackDone := make(chan error, 1)
			go func() {
				callbackDone <- listener.Callback(changeType, oldConfigCopy, newConfigCopy)
			}()

			select {
			case <-stopChan:
				cns.logger.Debug("ConfigNotification: Callback interrupted by stop signal",
					"listener", listenerName)
				return
			case err := <-callbackDone:
				if err != nil {
					cns.logger.Error("ConfigNotification: Callback execution failed",
						"listener", listenerName,
						"type", string(changeType),
						"error", err)
				} else {
					cns.logger.Debug("ConfigNotification: Callback executed successfully",
						"listener", listenerName,
						"type", string(changeType))
				}
			case <-time.After(30 * time.Second): // 30秒超时
				cns.logger.Error("ConfigNotification: Callback execution timeout",
					"listener", listenerName,
					"type", string(changeType),
					"timeout", "30s")
			}
		}()
	})

	cns.logger.Debug("ConfigNotification: Debounce timer scheduled",
		"listener", listenerName,
		"delay", listener.DebounceDelay)
}

// Cleanup 清理所有监听器
func (cns *ConfigNotificationService) Cleanup() {
	cns.mu.Lock()
	defer cns.mu.Unlock()

	for changeType, listener := range cns.listeners {
		cns.cleanupListener(listener)
		delete(cns.listeners, changeType)
	}

	cns.logger.Info("ConfigNotification: All listeners cleaned up")
}

// CreateHotkeyListener 创建热键配置监听器
func CreateHotkeyListener(callback func(enable bool, hotkey *models.HotkeyCombo) error) *ConfigListener {
	return &ConfigListener{
		Name:       "HotkeyListener",
		ChangeType: ConfigChangeTypeHotkey,
		Callback: func(changeType ConfigChangeType, oldConfig, newConfig interface{}) error {
			// 处理新配置
			if newAppConfig, ok := newConfig.(*models.AppConfig); ok {
				return callback(newAppConfig.General.EnableGlobalHotkey, &newAppConfig.General.GlobalHotkey)
			}
			// 如果新配置为空，说明配置被删除，使用默认值
			if newConfig == nil {
				defaultConfig := models.NewDefaultAppConfig()
				return callback(defaultConfig.General.EnableGlobalHotkey, &defaultConfig.General.GlobalHotkey)
			}
			return nil
		},
		DebounceDelay: 200 * time.Millisecond,
		GetConfigFunc: func(v *viper.Viper) interface{} {
			var config models.AppConfig
			if err := v.Unmarshal(&config); err != nil {
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
		Callback: func(changeType ConfigChangeType, oldConfig, newConfig interface{}) error {
			var oldPath, newPath string

			// 处理旧配置
			if oldAppConfig, ok := oldConfig.(*models.AppConfig); ok {
				oldPath = oldAppConfig.General.DataPath
			}

			// 处理新配置
			if newAppConfig, ok := newConfig.(*models.AppConfig); ok {
				newPath = newAppConfig.General.DataPath
			} else if newConfig == nil {
				// 如果新配置为空，说明配置被删除，使用默认值
				defaultConfig := models.NewDefaultAppConfig()
				newPath = defaultConfig.General.DataPath
			}

			// 只有路径真正改变时才调用回调
			if oldPath != newPath {
				return callback(oldPath, newPath)
			}
			return nil
		},
		DebounceDelay: 100 * time.Millisecond, // 较短的防抖延迟，因为数据路径变更需要快速响应
		GetConfigFunc: func(v *viper.Viper) interface{} {
			var config models.AppConfig
			if err := v.Unmarshal(&config); err != nil {
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
