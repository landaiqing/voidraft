package services

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sync"
	"voidraft/internal/models"

	jsonparser "github.com/knadh/koanf/parsers/json"
	"github.com/knadh/koanf/providers/file"
	"github.com/knadh/koanf/providers/structs"
	"github.com/knadh/koanf/v2"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// KeyBindingService 快捷键管理服务
type KeyBindingService struct {
	koanf        *koanf.Koanf
	logger       *log.LoggerService
	pathManager  *PathManager
	fileProvider *file.File

	mu       sync.RWMutex
	ctx      context.Context
	cancel   context.CancelFunc
	initOnce sync.Once

	// 配置迁移服务
	migrationService *ConfigMigrationService[*models.KeyBindingConfig]
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

	k := koanf.New(".")

	migrationService := NewKeyBindingMigrationService(logger, pathManager)

	service := &KeyBindingService{
		koanf:            k,
		logger:           logger,
		pathManager:      pathManager,
		ctx:              ctx,
		cancel:           cancel,
		migrationService: migrationService,
	}

	// 异步初始化
	go service.initialize()

	return service
}

// initialize 初始化配置
func (kbs *KeyBindingService) initialize() {
	kbs.initOnce.Do(func() {
		if err := kbs.initConfig(); err != nil {
			kbs.logger.Error("failed to initialize keybinding config", "error", err)
		}
	})
}

// setDefaults 设置默认值
func (kbs *KeyBindingService) setDefaults() error {
	defaultConfig := models.NewDefaultKeyBindingConfig()

	if err := kbs.koanf.Load(structs.Provider(defaultConfig, "json"), nil); err != nil {
		return &KeyBindingError{"load_defaults", "", err}
	}

	return nil
}

// initConfig 初始化配置
func (kbs *KeyBindingService) initConfig() error {
	kbs.mu.Lock()
	defer kbs.mu.Unlock()

	// 检查配置文件是否存在
	configPath := kbs.pathManager.GetKeybindsPath()
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return kbs.createDefaultConfig()
	}

	// 配置文件存在，先加载现有配置
	kbs.fileProvider = file.Provider(configPath)
	if err := kbs.koanf.Load(kbs.fileProvider, jsonparser.Parser()); err != nil {
		return &KeyBindingError{"load_config_file", "", err}
	}

	// 检查并执行配置迁移
	if kbs.migrationService != nil {
		result, err := kbs.migrationService.MigrateConfig(kbs.koanf)
		if err != nil {
			return &KeyBindingError{"migrate_config", "", err}
		}

		if result.Migrated && result.ConfigUpdated {
			// 迁移完成且配置已更新，重新创建文件提供器以监听新文件
			kbs.fileProvider = file.Provider(configPath)
		}
	}

	return nil
}

// createDefaultConfig 创建默认配置文件
func (kbs *KeyBindingService) createDefaultConfig() error {
	if err := kbs.pathManager.EnsureConfigDir(); err != nil {
		return &KeyBindingError{"create_config_dir", "", err}
	}

	if err := kbs.setDefaults(); err != nil {
		return err
	}

	configBytes, err := kbs.koanf.Marshal(jsonparser.Parser())
	if err != nil {
		return &KeyBindingError{"marshal_config", "", err}
	}

	if err := os.WriteFile(kbs.pathManager.GetKeybindsPath(), configBytes, 0644); err != nil {
		return &KeyBindingError{"write_config", "", err}
	}

	// 创建文件提供器
	kbs.fileProvider = file.Provider(kbs.pathManager.GetKeybindsPath())
	if err = kbs.koanf.Load(kbs.fileProvider, jsonparser.Parser()); err != nil {
		return err
	}
	return nil
}

// GetKeyBindingConfig 获取完整快捷键配置
func (kbs *KeyBindingService) GetKeyBindingConfig() (*models.KeyBindingConfig, error) {
	kbs.mu.RLock()
	defer kbs.mu.RUnlock()

	var config models.KeyBindingConfig
	if err := kbs.koanf.Unmarshal("", &config); err != nil {
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

// OnShutdown 关闭服务
func (kbs *KeyBindingService) OnShutdown() error {
	kbs.cancel()
	return nil
}
