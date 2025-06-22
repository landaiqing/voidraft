package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sync"
	"voidraft/internal/models"

	"github.com/fsnotify/fsnotify"
	"github.com/spf13/viper"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// KeyBindingService 快捷键管理服务
type KeyBindingService struct {
	viper       *viper.Viper
	logger      *log.LoggerService
	pathManager *PathManager

	mu       sync.RWMutex
	ctx      context.Context
	cancel   context.CancelFunc
	initOnce sync.Once
}

// KeyBindingError 快捷键错误
type KeyBindingError struct {
	Operation string
	Command   string
	Err       error
}

func (e *KeyBindingError) Error() string {
	if e.Command != "" {
		return fmt.Sprintf("keybinding %s for %s: %v", e.Operation, e.Command, e.Err)
	}
	return fmt.Sprintf("keybinding %s: %v", e.Operation, e.Err)
}

func (e *KeyBindingError) Unwrap() error {
	return e.Err
}

func (e *KeyBindingError) Is(target error) bool {
	var keyBindingError *KeyBindingError
	return errors.As(target, &keyBindingError)
}

// NewKeyBindingService 创建快捷键服务实例
func NewKeyBindingService(logger *log.LoggerService, pathManager *PathManager) *KeyBindingService {
	if logger == nil {
		logger = log.New()
	}
	if pathManager == nil {
		pathManager = NewPathManager()
	}

	ctx, cancel := context.WithCancel(context.Background())

	// 创建并配置 Viper
	v := viper.New()
	v.SetConfigName(pathManager.GetKeybindsName())
	v.SetConfigType("json")
	v.AddConfigPath(pathManager.GetConfigDir())
	v.SetEnvPrefix("VOIDRAFT_KEYBINDING")
	v.AutomaticEnv()

	service := &KeyBindingService{
		viper:       v,
		logger:      logger,
		pathManager: pathManager,
		ctx:         ctx,
		cancel:      cancel,
	}

	// 异步初始化
	go service.initialize()

	return service
}

// initialize 初始化配置
func (kbs *KeyBindingService) initialize() {
	kbs.initOnce.Do(func() {
		kbs.setDefaults()

		if err := kbs.initConfig(); err != nil {
			kbs.logger.Error("failed to initialize keybinding config", "error", err)
		}

		kbs.startWatching()
	})
}

// setDefaults 设置默认值
func (kbs *KeyBindingService) setDefaults() {
	defaultConfig := models.NewDefaultKeyBindingConfig()
	kbs.viper.SetDefault("keyBindings", defaultConfig.KeyBindings)
	kbs.viper.SetDefault("metadata.lastUpdated", defaultConfig.Metadata.LastUpdated)
}

// initConfig 初始化配置
func (kbs *KeyBindingService) initConfig() error {
	kbs.mu.Lock()
	defer kbs.mu.Unlock()

	if err := kbs.viper.ReadInConfig(); err != nil {
		var configFileNotFoundError viper.ConfigFileNotFoundError
		if errors.As(err, &configFileNotFoundError) {
			return kbs.createDefaultConfig()
		}
		return &KeyBindingError{"read_config", "", err}
	}
	return nil
}

// createDefaultConfig 创建默认配置文件
func (kbs *KeyBindingService) createDefaultConfig() error {
	if err := kbs.pathManager.EnsureConfigDir(); err != nil {
		return &KeyBindingError{"create_config_dir", "", err}
	}

	defaultConfig := models.NewDefaultKeyBindingConfig()
	configBytes, err := json.MarshalIndent(defaultConfig, "", "  ")
	if err != nil {
		return &KeyBindingError{"marshal_config", "", err}
	}

	if err := os.WriteFile(kbs.pathManager.GetKeybindsPath(), configBytes, 0644); err != nil {
		return &KeyBindingError{"write_config", "", err}
	}

	return kbs.viper.ReadInConfig()
}

// startWatching 启动配置文件监听
func (kbs *KeyBindingService) startWatching() {
	kbs.viper.OnConfigChange(func(e fsnotify.Event) {

	})
	kbs.viper.WatchConfig()
}

// GetKeyBindingConfig 获取完整快捷键配置
func (kbs *KeyBindingService) GetKeyBindingConfig() (*models.KeyBindingConfig, error) {
	kbs.mu.RLock()
	defer kbs.mu.RUnlock()

	var config models.KeyBindingConfig
	if err := kbs.viper.Unmarshal(&config); err != nil {
		return nil, &KeyBindingError{"unmarshal_config", "", err}
	}
	return &config, nil
}

// GetAllKeyBindings 获取所有快捷键配置
func (kbs *KeyBindingService) GetAllKeyBindings() ([]models.KeyBinding, error) {
	config, err := kbs.GetKeyBindingConfig()
	if err != nil {
		return nil, err
	}
	return config.KeyBindings, nil
}

// Shutdown 关闭服务
func (kbs *KeyBindingService) Shutdown() error {
	kbs.cancel()
	return nil
}
