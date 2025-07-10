package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"
	"voidraft/internal/models"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// SQL constants for extension operations
const (
	// Extension operations
	sqlGetAllExtensions = `
SELECT id, enabled, is_default, config 
FROM extensions 
ORDER BY id`

	sqlGetExtensionByID = `
SELECT id, enabled, is_default, config 
FROM extensions 
WHERE id = ?`

	sqlInsertExtension = `
INSERT INTO extensions (id, enabled, is_default, config, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?)`

	sqlUpdateExtension = `
UPDATE extensions 
SET enabled = ?, config = ?, updated_at = ?
WHERE id = ?`

	sqlDeleteAllExtensions = `DELETE FROM extensions`
)

// ExtensionService 扩展管理服务
type ExtensionService struct {
	databaseService *DatabaseService
	logger          *log.Service

	mu       sync.RWMutex
	ctx      context.Context
	cancel   context.CancelFunc
	initOnce sync.Once
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
func NewExtensionService(databaseService *DatabaseService, logger *log.Service) *ExtensionService {
	if logger == nil {
		logger = log.New()
	}

	ctx, cancel := context.WithCancel(context.Background())

	service := &ExtensionService{
		databaseService: databaseService,
		logger:          logger,
		ctx:             ctx,
		cancel:          cancel,
	}

	return service
}

// initialize 初始化配置
func (es *ExtensionService) initialize() {
	es.initOnce.Do(func() {
		if err := es.initDatabase(); err != nil {
			es.logger.Error("failed to initialize extension database", "error", err)
		}
	})
}

// initDatabase 初始化数据库数据
func (es *ExtensionService) initDatabase() error {
	es.mu.Lock()
	defer es.mu.Unlock()

	// 检查是否已有扩展数据
	rows, err := es.databaseService.SQLite.Query("SELECT COUNT(*) FROM extensions")
	if err != nil {
		return &ExtensionError{"check_extensions_count", "", err}
	}

	if len(rows) == 0 {
		return &ExtensionError{"check_extensions_count", "", fmt.Errorf("no rows returned")}
	}

	count, ok := rows[0]["COUNT(*)"].(int64)
	if !ok {
		return &ExtensionError{"convert_count", "", fmt.Errorf("failed to convert count to int64")}
	}

	// 如果没有数据，插入默认配置
	if count == 0 {
		if err := es.insertDefaultExtensions(); err != nil {
			es.logger.Error("Failed to insert default extensions", "error", err)
			return err
		}
	}

	return nil
}

// insertDefaultExtensions 插入默认扩展配置
func (es *ExtensionService) insertDefaultExtensions() error {
	defaultSettings := models.NewDefaultExtensionSettings()
	now := time.Now()

	for _, ext := range defaultSettings.Extensions {

		configJSON, err := json.Marshal(ext.Config)
		if err != nil {
			return &ExtensionError{"marshal_config", string(ext.ID), err}
		}

		err = es.databaseService.SQLite.Execute(sqlInsertExtension,
			string(ext.ID),
			ext.Enabled,
			ext.IsDefault,
			string(configJSON),
			now,
			now,
		)
		if err != nil {
			return &ExtensionError{"insert_extension", string(ext.ID), err}
		}

	}

	return nil
}

// ServiceStartup 启动时调用
func (es *ExtensionService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	es.ctx = ctx

	// 初始化数据库
	var initErr error
	es.initOnce.Do(func() {
		if err := es.initDatabase(); err != nil {
			es.logger.Error("failed to initialize extension database", "error", err)
			initErr = err
		}
	})
	return initErr
}

// GetAllExtensions 获取所有扩展配置
func (es *ExtensionService) GetAllExtensions() ([]models.Extension, error) {
	es.mu.RLock()
	defer es.mu.RUnlock()

	rows, err := es.databaseService.SQLite.Query(sqlGetAllExtensions)
	if err != nil {
		return nil, &ExtensionError{"query_extensions", "", err}
	}

	var extensions []models.Extension
	for _, row := range rows {
		var ext models.Extension

		if id, ok := row["id"].(string); ok {
			ext.ID = models.ExtensionID(id)
		}

		if enabled, ok := row["enabled"].(int64); ok {
			ext.Enabled = enabled == 1
		}

		if isDefault, ok := row["is_default"].(int64); ok {
			ext.IsDefault = isDefault == 1
		}

		if configJSON, ok := row["config"].(string); ok {
			var config models.ExtensionConfig
			if err := json.Unmarshal([]byte(configJSON), &config); err != nil {
				return nil, &ExtensionError{"unmarshal_config", string(ext.ID), err}
			}
			ext.Config = config
		}

		extensions = append(extensions, ext)
	}

	return extensions, nil
}

// UpdateExtensionEnabled 更新扩展启用状态
func (es *ExtensionService) UpdateExtensionEnabled(id models.ExtensionID, enabled bool) error {
	return es.UpdateExtensionState(id, enabled, nil)
}

// UpdateExtensionState 更新扩展状态
func (es *ExtensionService) UpdateExtensionState(id models.ExtensionID, enabled bool, config models.ExtensionConfig) error {
	es.mu.Lock()
	defer es.mu.Unlock()

	var configJSON []byte
	var err error

	if config != nil {
		configJSON, err = json.Marshal(config)
		if err != nil {
			return &ExtensionError{"marshal_config", string(id), err}
		}
	} else {
		// 如果没有提供配置，保持原有配置
		rows, err := es.databaseService.SQLite.Query("SELECT config FROM extensions WHERE id = ?", string(id))
		if err != nil {
			return &ExtensionError{"query_current_config", string(id), err}
		}

		if len(rows) == 0 {
			return &ExtensionError{"query_current_config", string(id), fmt.Errorf("extension not found")}
		}

		currentConfigJSON, ok := rows[0]["config"].(string)
		if !ok {
			return &ExtensionError{"convert_config", string(id), fmt.Errorf("failed to get current config")}
		}

		configJSON = []byte(currentConfigJSON)
	}

	err = es.databaseService.SQLite.Execute(sqlUpdateExtension, enabled, string(configJSON), time.Now(), string(id))
	if err != nil {
		return &ExtensionError{"update_extension", string(id), err}
	}

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

	// 删除所有现有扩展
	err := es.databaseService.SQLite.Execute(sqlDeleteAllExtensions)
	if err != nil {
		return &ExtensionError{"delete_all_extensions", "", err}
	}

	// 插入默认扩展配置
	if err := es.insertDefaultExtensions(); err != nil {
		return err
	}

	return nil
}
