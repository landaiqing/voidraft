package services

import (
	"encoding/json"
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

// KeyBindingService 快捷键管理服务
type KeyBindingService struct {
	viper  *viper.Viper       // Viper 实例
	logger *log.LoggerService // 日志服务
	mu     sync.RWMutex       // 读写锁
}

// KeyBindingError 快捷键错误
type KeyBindingError struct {
	Operation string // 操作名称
	Action    string // 快捷键Action
	Err       error  // 原始错误
}

// Error 实现error接口
func (e *KeyBindingError) Error() string {
	if e.Action != "" {
		return fmt.Sprintf("keybinding error during %s for action %s: %v", e.Operation, e.Action, e.Err)
	}
	return fmt.Sprintf("keybinding error during %s: %v", e.Operation, e.Err)
}

// Unwrap 获取原始错误
func (e *KeyBindingError) Unwrap() error {
	return e.Err
}

// Is 实现错误匹配
func (e *KeyBindingError) Is(target error) bool {
	var keyBindingError *KeyBindingError
	ok := errors.As(target, &keyBindingError)
	return ok
}

// NewKeyBindingService 创建新的快捷键服务实例
func NewKeyBindingService(logger *log.LoggerService) *KeyBindingService {
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
	configName := "keybindings"

	// 创建 Viper 实例
	v := viper.New()

	// 配置 Viper
	v.SetConfigName(configName)
	v.SetConfigType("json")
	v.AddConfigPath(configPath)

	// 设置环境变量前缀
	v.SetEnvPrefix("VOIDRAFT_KEYBINDING")
	v.AutomaticEnv()

	// 设置默认值
	setKeyBindingDefaults(v)

	// 构造快捷键服务实例
	service := &KeyBindingService{
		viper:  v,
		logger: logger,
	}

	// 初始化配置
	if err := service.initConfig(); err != nil {
		service.logger.Error("KeyBinding: Failed to initialize keybinding config", "error", err)
	}

	// 启动配置文件监听
	service.startWatching()

	return service
}

// setKeyBindingDefaults 设置默认快捷键配置值
func setKeyBindingDefaults(v *viper.Viper) {
	defaultConfig := models.NewDefaultKeyBindingConfig()

	// 快捷键列表默认值
	v.SetDefault("keyBindings", defaultConfig.KeyBindings)

	// 元数据默认值
	v.SetDefault("metadata.lastUpdated", defaultConfig.Metadata.LastUpdated)
}

// initConfig 初始化配置
func (kbs *KeyBindingService) initConfig() error {
	kbs.mu.Lock()
	defer kbs.mu.Unlock()

	// 尝试读取配置文件
	if err := kbs.viper.ReadInConfig(); err != nil {
		var configFileNotFoundError viper.ConfigFileNotFoundError
		if errors.As(err, &configFileNotFoundError) {
			// 配置文件不存在，创建默认配置文件
			kbs.logger.Info("KeyBinding: Config file not found, creating default keybinding config")
			return kbs.createDefaultConfig()
		}
		// 配置文件存在但读取失败
		return &KeyBindingError{Operation: "read_keybinding_config", Err: err}
	}

	kbs.logger.Info("KeyBinding: Successfully loaded keybinding config file", "file", kbs.viper.ConfigFileUsed())
	return nil
}

// createDefaultConfig 创建默认配置文件
func (kbs *KeyBindingService) createDefaultConfig() error {
	// 获取配置目录路径
	currentDir, err := os.Getwd()
	if err != nil {
		currentDir = "."
	}
	configDir := filepath.Join(currentDir, "config")
	configPath := filepath.Join(configDir, "keybindings.json")

	// 确保配置目录存在
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return &KeyBindingError{Operation: "create_keybinding_config_dir", Err: err}
	}

	// 获取默认配置
	defaultConfig := models.NewDefaultKeyBindingConfig()
	configBytes, err := json.MarshalIndent(defaultConfig, "", "  ")
	if err != nil {
		return &KeyBindingError{Operation: "marshal_default_keybinding_config", Err: err}
	}

	// 写入配置文件
	if err := os.WriteFile(configPath, configBytes, 0644); err != nil {
		return &KeyBindingError{Operation: "write_default_keybinding_config", Err: err}
	}

	// 重新读取配置文件到viper
	if err := kbs.viper.ReadInConfig(); err != nil {
		return &KeyBindingError{Operation: "read_created_keybinding_config", Err: err}
	}

	kbs.logger.Info("KeyBinding: Created default keybinding config file", "path", configPath)
	return nil
}

// startWatching 启动配置文件监听
func (kbs *KeyBindingService) startWatching() {
	// 设置配置变化回调
	kbs.viper.OnConfigChange(func(e fsnotify.Event) {
		kbs.logger.Info("KeyBinding: Config file changed", "file", e.Name, "operation", e.Op.String())
	})

	// 启动配置文件监听
	kbs.viper.WatchConfig()
	kbs.logger.Info("KeyBinding: Started watching keybinding config file for changes")
}

// GetKeyBindingConfig 获取完整快捷键配置
func (kbs *KeyBindingService) GetKeyBindingConfig() (*models.KeyBindingConfig, error) {
	kbs.mu.RLock()
	defer kbs.mu.RUnlock()

	var config models.KeyBindingConfig
	if err := kbs.viper.Unmarshal(&config); err != nil {
		return nil, &KeyBindingError{Operation: "unmarshal_keybinding_config", Err: err}
	}

	return &config, nil
}

// GetAllKeyBindings 获取所有快捷键配置
func (kbs *KeyBindingService) GetAllKeyBindings() ([]models.KeyBinding, error) {
	kbs.mu.RLock()
	defer kbs.mu.RUnlock()

	config, err := kbs.GetKeyBindingConfig()
	if err != nil {
		return nil, &KeyBindingError{Operation: "get_all_keybindings", Err: err}
	}

	return config.KeyBindings, nil
}

// GetKeyBindingsByCategory 根据分类获取快捷键
func (kbs *KeyBindingService) GetKeyBindingsByCategory(category models.KeyBindingCategory) ([]models.KeyBinding, error) {
	kbs.mu.RLock()
	defer kbs.mu.RUnlock()

	allKeyBindings, err := kbs.GetAllKeyBindings()
	if err != nil {
		return nil, err
	}

	var result []models.KeyBinding
	for _, kb := range allKeyBindings {
		if kb.Category == category {
			result = append(result, kb)
		}
	}

	return result, nil
}

// GetKeyBindingsByScope 根据作用域获取快捷键
func (kbs *KeyBindingService) GetKeyBindingsByScope(scope models.KeyBindingScope) ([]models.KeyBinding, error) {
	kbs.mu.RLock()
	defer kbs.mu.RUnlock()

	allKeyBindings, err := kbs.GetAllKeyBindings()
	if err != nil {
		return nil, err
	}

	var result []models.KeyBinding
	for _, kb := range allKeyBindings {
		if kb.Scope == scope && kb.Enabled {
			result = append(result, kb)
		}
	}

	return result, nil
}

// GetKeyBindingByAction 根据动作获取快捷键
func (kbs *KeyBindingService) GetKeyBindingByAction(action models.KeyBindingAction) (*models.KeyBinding, error) {
	kbs.mu.RLock()
	defer kbs.mu.RUnlock()

	allKeyBindings, err := kbs.GetAllKeyBindings()
	if err != nil {
		return nil, err
	}

	for _, kb := range allKeyBindings {
		if kb.Action == action && kb.Enabled {
			return &kb, nil
		}
	}

	return nil, &KeyBindingError{
		Operation: "get_keybinding_by_action",
		Err:       fmt.Errorf("keybinding for action %s not found", action),
	}
}

// UpdateKeyBinding 更新快捷键
func (kbs *KeyBindingService) UpdateKeyBinding(action models.KeyBindingAction, newKey string) error {
	kbs.mu.Lock()
	defer kbs.mu.Unlock()

	// 验证新的快捷键格式
	if err := kbs.validateKeyFormat(newKey); err != nil {
		return &KeyBindingError{
			Operation: "update_keybinding",
			Action:    string(action),
			Err:       fmt.Errorf("invalid key format: %v", err),
		}
	}

	// 检查快捷键冲突
	if err := kbs.checkKeyConflict(action, newKey); err != nil {
		return &KeyBindingError{
			Operation: "update_keybinding",
			Action:    string(action),
			Err:       fmt.Errorf("key conflict: %v", err),
		}
	}

	// 获取当前配置
	config, err := kbs.GetKeyBindingConfig()
	if err != nil {
		return &KeyBindingError{Operation: "update_keybinding", Action: string(action), Err: err}
	}

	// 查找并更新快捷键
	found := false
	for i, kb := range config.KeyBindings {
		if kb.Action == action {
			config.KeyBindings[i].Key = newKey
			config.KeyBindings[i].IsDefault = false // 标记为非默认
			found = true
			break
		}
	}

	if !found {
		return &KeyBindingError{
			Operation: "update_keybinding",
			Action:    string(action),
			Err:       errors.New("keybinding not found"),
		}
	}

	// 更新时间戳
	config.Metadata.LastUpdated = time.Now().Format(time.RFC3339)

	// 保存配置
	if err := kbs.saveConfig(config); err != nil {
		return &KeyBindingError{Operation: "update_keybinding", Action: string(action), Err: err}
	}

	kbs.logger.Info("KeyBinding: Updated keybinding", "action", action, "newKey", newKey)
	return nil
}

// EnableKeyBinding 启用快捷键
func (kbs *KeyBindingService) EnableKeyBinding(action models.KeyBindingAction) error {
	return kbs.setKeyBindingEnabled(action, true)
}

// DisableKeyBinding 禁用快捷键
func (kbs *KeyBindingService) DisableKeyBinding(action models.KeyBindingAction) error {
	return kbs.setKeyBindingEnabled(action, false)
}

// setKeyBindingEnabled 设置快捷键启用状态
func (kbs *KeyBindingService) setKeyBindingEnabled(action models.KeyBindingAction, enabled bool) error {
	kbs.mu.Lock()
	defer kbs.mu.Unlock()

	// 获取当前配置
	config, err := kbs.GetKeyBindingConfig()
	if err != nil {
		return &KeyBindingError{Operation: "set_keybinding_enabled", Action: string(action), Err: err}
	}

	// 查找并更新快捷键
	found := false
	for i, kb := range config.KeyBindings {
		if kb.Action == action {
			config.KeyBindings[i].Enabled = enabled
			found = true
			break
		}
	}

	if !found {
		return &KeyBindingError{
			Operation: "set_keybinding_enabled",
			Action:    string(action),
			Err:       errors.New("keybinding not found"),
		}
	}

	// 更新时间戳
	config.Metadata.LastUpdated = time.Now().Format(time.RFC3339)

	// 保存配置
	if err := kbs.saveConfig(config); err != nil {
		return &KeyBindingError{Operation: "set_keybinding_enabled", Action: string(action), Err: err}
	}

	status := "enabled"
	if !enabled {
		status = "disabled"
	}
	kbs.logger.Info("KeyBinding: "+status+" keybinding", "action", action)
	return nil
}

// ResetKeyBinding 重置快捷键到默认值
func (kbs *KeyBindingService) ResetKeyBinding(action models.KeyBindingAction) error {
	kbs.mu.Lock()
	defer kbs.mu.Unlock()

	// 获取默认配置
	defaultKeyBindings := models.NewDefaultKeyBindings()
	var defaultKeyBinding *models.KeyBinding
	for _, kb := range defaultKeyBindings {
		if kb.Action == action {
			defaultKeyBinding = &kb
			break
		}
	}

	if defaultKeyBinding == nil {
		return &KeyBindingError{
			Operation: "reset_keybinding",
			Action:    string(action),
			Err:       errors.New("default keybinding not found"),
		}
	}

	// 获取当前配置
	config, err := kbs.GetKeyBindingConfig()
	if err != nil {
		return &KeyBindingError{Operation: "reset_keybinding", Action: string(action), Err: err}
	}

	// 查找并重置快捷键
	found := false
	for i, kb := range config.KeyBindings {
		if kb.Action == action {
			config.KeyBindings[i].Key = defaultKeyBinding.Key
			config.KeyBindings[i].Enabled = defaultKeyBinding.Enabled
			config.KeyBindings[i].IsDefault = true
			found = true
			break
		}
	}

	if !found {
		return &KeyBindingError{
			Operation: "reset_keybinding",
			Action:    string(action),
			Err:       errors.New("keybinding not found"),
		}
	}

	// 更新时间戳
	config.Metadata.LastUpdated = time.Now().Format(time.RFC3339)

	// 保存配置
	if err := kbs.saveConfig(config); err != nil {
		return &KeyBindingError{Operation: "reset_keybinding", Action: string(action), Err: err}
	}

	kbs.logger.Info("KeyBinding: Reset keybinding to default", "action", action, "key", defaultKeyBinding.Key)
	return nil
}

// ResetAllKeyBindings 重置所有快捷键到默认值
func (kbs *KeyBindingService) ResetAllKeyBindings() error {
	kbs.mu.Lock()
	defer kbs.mu.Unlock()

	// 获取默认配置
	defaultConfig := models.NewDefaultKeyBindingConfig()

	// 保存配置
	if err := kbs.saveConfig(defaultConfig); err != nil {
		return &KeyBindingError{Operation: "reset_all_keybindings", Err: err}
	}

	kbs.logger.Info("KeyBinding: Reset all keybindings to default")
	return nil
}

// saveConfig 保存配置到文件
func (kbs *KeyBindingService) saveConfig(config *models.KeyBindingConfig) error {
	// 设置快捷键列表到viper
	kbs.viper.Set("keyBindings", config.KeyBindings)
	kbs.viper.Set("metadata.lastUpdated", config.Metadata.LastUpdated)

	// 写入配置文件
	if err := kbs.viper.WriteConfig(); err != nil {
		return fmt.Errorf("failed to write keybinding config: %v", err)
	}

	return nil
}

// validateKeyFormat 验证快捷键格式
func (kbs *KeyBindingService) validateKeyFormat(key string) error {
	if key == "" {
		return errors.New("key cannot be empty")
	}

	// 基本格式验证
	// 支持的修饰符: Mod, Ctrl, Shift, Alt, Win
	// 支持的组合: Mod-f, Ctrl-Shift-p, Alt-ArrowUp 等
	validModifiers := []string{"Mod", "Ctrl", "Shift", "Alt", "Win"}
	parts := strings.Split(key, "-")

	if len(parts) == 0 {
		return errors.New("invalid key format")
	}

	// 检查修饰符
	for i := 0; i < len(parts)-1; i++ {
		modifier := parts[i]
		valid := false
		for _, validMod := range validModifiers {
			if modifier == validMod {
				valid = true
				break
			}
		}
		if !valid {
			return fmt.Errorf("invalid modifier: %s", modifier)
		}
	}

	// 最后一部分应该是主键
	mainKey := parts[len(parts)-1]
	if mainKey == "" {
		return errors.New("main key cannot be empty")
	}

	return nil
}

// checkKeyConflict 检查快捷键冲突
func (kbs *KeyBindingService) checkKeyConflict(excludeAction models.KeyBindingAction, key string) error {
	allKeyBindings, err := kbs.GetAllKeyBindings()
	if err != nil {
		return err
	}

	for _, kb := range allKeyBindings {
		if kb.Action != excludeAction && kb.Key == key && kb.Enabled {
			return fmt.Errorf("key %s is already used by %s", key, kb.Action)
		}
	}

	return nil
}

// GetKeyBindingCategories 获取所有快捷键分类
func (kbs *KeyBindingService) GetKeyBindingCategories() []models.KeyBindingCategory {
	return []models.KeyBindingCategory{
		models.CategorySearch,
		models.CategoryEdit,
		models.CategoryCodeBlock,
		models.CategoryNavigation,
		models.CategoryView,
		models.CategoryFile,
		models.CategoryApp,
	}
}

// GetKeyBindingScopes 获取所有快捷键作用域
func (kbs *KeyBindingService) GetKeyBindingScopes() []models.KeyBindingScope {
	return []models.KeyBindingScope{
		models.ScopeGlobal,
		models.ScopeEditor,
		models.ScopeSearch,
	}
}

// ExportKeyBindings 导出快捷键配置
func (kbs *KeyBindingService) ExportKeyBindings() ([]models.KeyBinding, error) {
	kbs.mu.RLock()
	defer kbs.mu.RUnlock()

	return kbs.GetAllKeyBindings()
}

// ImportKeyBindings 导入快捷键配置
func (kbs *KeyBindingService) ImportKeyBindings(keyBindings []models.KeyBinding) error {
	kbs.mu.Lock()
	defer kbs.mu.Unlock()

	// 验证导入的快捷键
	for _, kb := range keyBindings {
		if err := kbs.validateKeyFormat(kb.Key); err != nil {
			return &KeyBindingError{
				Operation: "import_keybindings",
				Action:    string(kb.Action),
				Err:       fmt.Errorf("invalid key format for %s: %v", kb.Action, err),
			}
		}
	}

	// 检查重复的快捷键
	keyMap := make(map[string]models.KeyBindingAction)
	for _, kb := range keyBindings {
		if kb.Enabled {
			if existingAction, exists := keyMap[kb.Key]; exists {
				return &KeyBindingError{
					Operation: "import_keybindings",
					Err:       fmt.Errorf("duplicate key %s found in %s and %s", kb.Key, existingAction, kb.Action),
				}
			}
			keyMap[kb.Key] = kb.Action
		}
	}

	// 创建新的配置
	config := &models.KeyBindingConfig{
		KeyBindings: keyBindings,
		Metadata: models.KeyBindingMetadata{
			LastUpdated: time.Now().Format(time.RFC3339),
		},
	}

	// 保存配置
	if err := kbs.saveConfig(config); err != nil {
		return &KeyBindingError{Operation: "import_keybindings", Err: err}
	}

	kbs.logger.Info("KeyBinding: Imported keybindings", "count", len(keyBindings))
	return nil
}
