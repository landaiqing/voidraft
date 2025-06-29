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

// ExtensionService 扩展管理服务
type ExtensionService struct {
	koanf        *koanf.Koanf
	logger       *log.LoggerService
	pathManager  *PathManager
	fileProvider *file.File

	mu       sync.RWMutex
	ctx      context.Context
	cancel   context.CancelFunc
	initOnce sync.Once

	// 配置迁移服务
	migrationService *ConfigMigrationService[*models.ExtensionSettings]
}

// ExtensionError 扩展错误
type ExtensionError struct {
	Operation string
	Extension string
	Err       error
}

func (e *ExtensionError) Error() string {
	if e.Extension != "" {
		return fmt.Sprintf("extension %s for %s: %v", e.Operation, e.Extension, e.Err)
	}
	return fmt.Sprintf("extension %s: %v", e.Operation, e.Err)
}

func (e *ExtensionError) Unwrap() error {
	return e.Err
}

func (e *ExtensionError) Is(target error) bool {
	var extensionError *ExtensionError
	return errors.As(target, &extensionError)
}

// NewExtensionService 创建扩展服务实例
func NewExtensionService(logger *log.LoggerService, pathManager *PathManager) *ExtensionService {
	if logger == nil {
		logger = log.New()
	}
	if pathManager == nil {
		pathManager = NewPathManager()
	}

	ctx, cancel := context.WithCancel(context.Background())

	k := koanf.New(".")

	migrationService := NewExtensionMigrationService(logger, pathManager)

	service := &ExtensionService{
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
func (es *ExtensionService) initialize() {
	es.initOnce.Do(func() {
		if err := es.initConfig(); err != nil {
			es.logger.Error("failed to initialize extension config", "error", err)
		}
	})
}

// setDefaults 设置默认值
func (es *ExtensionService) setDefaults() error {
	defaultConfig := models.NewDefaultExtensionSettings()

	if err := es.koanf.Load(structs.Provider(defaultConfig, "json"), nil); err != nil {
		return &ExtensionError{"load_defaults", "", err}
	}

	return nil
}

// initConfig 初始化配置
func (es *ExtensionService) initConfig() error {
	es.mu.Lock()
	defer es.mu.Unlock()

	// 检查配置文件是否存在
	configPath := es.pathManager.GetExtensionsPath()
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return es.createDefaultConfig()
	}

	// 配置文件存在，先加载现有配置
	es.fileProvider = file.Provider(configPath)
	if err := es.koanf.Load(es.fileProvider, jsonparser.Parser()); err != nil {
		return &ExtensionError{"load_config_file", "", err}
	}

	// 检查并执行配置迁移
	if es.migrationService != nil {
		result, err := es.migrationService.MigrateConfig(es.koanf)
		if err != nil {
			return &ExtensionError{"migrate_config", "", err}
		}

		if result.Migrated && result.ConfigUpdated {
			// 迁移完成且配置已更新，重新创建文件提供器以监听新文件
			es.fileProvider = file.Provider(configPath)
		}
	}

	return nil
}

// createDefaultConfig 创建默认配置文件
func (es *ExtensionService) createDefaultConfig() error {
	if err := es.pathManager.EnsureConfigDir(); err != nil {
		return &ExtensionError{"create_config_dir", "", err}
	}

	if err := es.setDefaults(); err != nil {
		return err
	}

	configBytes, err := es.koanf.Marshal(jsonparser.Parser())
	if err != nil {
		return &ExtensionError{"marshal_config", "", err}
	}

	if err := os.WriteFile(es.pathManager.GetExtensionsPath(), configBytes, 0644); err != nil {
		return &ExtensionError{"write_config", "", err}
	}

	// 创建文件提供器
	es.fileProvider = file.Provider(es.pathManager.GetExtensionsPath())
	if err = es.koanf.Load(es.fileProvider, jsonparser.Parser()); err != nil {
		return err
	}
	return nil
}

// saveConfig 保存配置到文件
func (es *ExtensionService) saveExtensionConfig() error {
	configBytes, err := es.koanf.Marshal(jsonparser.Parser())
	if err != nil {
		return &ExtensionError{"marshal_config", "", err}
	}

	if err := os.WriteFile(es.pathManager.GetExtensionsPath(), configBytes, 0644); err != nil {
		return &ExtensionError{"write_config", "", err}
	}

	return nil
}

// GetAllExtensions 获取所有扩展配置
func (es *ExtensionService) GetAllExtensions() ([]models.Extension, error) {
	es.mu.RLock()
	defer es.mu.RUnlock()

	var settings models.ExtensionSettings
	if err := es.koanf.Unmarshal("", &settings); err != nil {
		return nil, &ExtensionError{"unmarshal_config", "", err}
	}
	return settings.Extensions, nil
}

// UpdateExtensionEnabled 更新扩展启用状态
func (es *ExtensionService) UpdateExtensionEnabled(id models.ExtensionID, enabled bool) error {
	return es.UpdateExtensionState(id, enabled, nil)
}

// UpdateExtensionState 更新扩展状态
func (es *ExtensionService) UpdateExtensionState(id models.ExtensionID, enabled bool, config models.ExtensionConfig) error {
	es.mu.Lock()
	defer es.mu.Unlock()

	// 获取当前配置
	var settings models.ExtensionSettings
	if err := es.koanf.Unmarshal("", &settings); err != nil {
		return &ExtensionError{"unmarshal_config", string(id), err}
	}

	// 更新扩展状态
	if !settings.UpdateExtension(id, enabled, config) {
		return &ExtensionError{"extension_not_found", string(id), nil}
	}

	// 重新加载到koanf
	if err := es.koanf.Load(structs.Provider(&settings, "json"), nil); err != nil {
		return &ExtensionError{"reload_config", string(id), err}
	}

	// 保存到文件
	if err := es.saveExtensionConfig(); err != nil {
		return &ExtensionError{"save_config", string(id), err}
	}

	es.logger.Info("extension state updated", "id", id, "enabled", enabled)
	return nil
}

// ResetExtensionToDefault 重置扩展到默认状态
func (es *ExtensionService) ResetExtensionToDefault(id models.ExtensionID) error {
	// 获取默认配置
	defaultSettings := models.NewDefaultExtensionSettings()
	defaultExtension := defaultSettings.GetExtensionByID(id)
	if defaultExtension == nil {
		return &ExtensionError{"default_extension_not_found", string(id), nil}
	}

	return es.UpdateExtensionState(id, defaultExtension.Enabled, defaultExtension.Config)
}

// ResetAllExtensionsToDefault 重置所有扩展到默认状态
func (es *ExtensionService) ResetAllExtensionsToDefault() error {
	es.mu.Lock()
	defer es.mu.Unlock()

	// 加载默认配置
	defaultSettings := models.NewDefaultExtensionSettings()
	if err := es.koanf.Load(structs.Provider(defaultSettings, "json"), nil); err != nil {
		return &ExtensionError{"load_defaults", "", err}
	}

	// 保存到文件
	if err := es.saveExtensionConfig(); err != nil {
		return &ExtensionError{"save_config", "", err}
	}

	es.logger.Info("all extensions reset to default")
	return nil
}

// OnShutdown 关闭服务
func (es *ExtensionService) OnShutdown() error {
	es.cancel()
	return nil
}
