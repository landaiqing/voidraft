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
	logger          *log.LoggerService

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
func NewExtensionService(databaseService *DatabaseService, logger *log.LoggerService) *ExtensionService {
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
	db := es.databaseService.GetDB()
	if db == nil {
		return &ExtensionError{"get_database", "", fmt.Errorf("database connection is nil")}
	}

	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM extensions").Scan(&count)
	if err != nil {
		return &ExtensionError{"check_extensions_count", "", err}
	}

	es.logger.Info("Extension database check", "existing_count", count)

	// 如果没有数据，插入默认配置
	if count == 0 {
		es.logger.Info("No extensions found, inserting default extensions...")
		if err := es.insertDefaultExtensions(); err != nil {
			es.logger.Error("Failed to insert default extensions", "error", err)
			return err
		}
		es.logger.Info("Default extensions inserted successfully")
	} else {
		es.logger.Info("Extensions already exist, skipping default insertion")
	}

	return nil
}

// insertDefaultExtensions 插入默认扩展配置
func (es *ExtensionService) insertDefaultExtensions() error {
	defaultSettings := models.NewDefaultExtensionSettings()
	db := es.databaseService.GetDB()
	now := time.Now()

	es.logger.Info("Starting to insert default extensions", "count", len(defaultSettings.Extensions))

	for i, ext := range defaultSettings.Extensions {
		es.logger.Info("Inserting extension", "index", i+1, "id", ext.ID, "enabled", ext.Enabled)

		configJSON, err := json.Marshal(ext.Config)
		if err != nil {
			es.logger.Error("Failed to marshal config", "extension", ext.ID, "error", err)
			return &ExtensionError{"marshal_config", string(ext.ID), err}
		}

		_, err = db.Exec(sqlInsertExtension,
			string(ext.ID),
			ext.Enabled,
			ext.IsDefault,
			string(configJSON),
			now,
			now,
		)
		if err != nil {
			es.logger.Error("Failed to insert extension", "extension", ext.ID, "error", err)
			return &ExtensionError{"insert_extension", string(ext.ID), err}
		}

		es.logger.Info("Successfully inserted extension", "id", ext.ID)
	}

	es.logger.Info("Completed inserting all default extensions")
	return nil
}

// OnStartup 启动时调用
func (es *ExtensionService) OnStartup(ctx context.Context, _ application.ServiceOptions) error {
	es.ctx = ctx
	es.logger.Info("Extension service starting up")

	// 初始化数据库
	var initErr error
	es.initOnce.Do(func() {
		es.logger.Info("Initializing extension database...")
		if err := es.initDatabase(); err != nil {
			es.logger.Error("failed to initialize extension database", "error", err)
			initErr = err
		} else {
			es.logger.Info("Extension database initialized successfully")
		}
	})
	return initErr
}

// GetAllExtensions 获取所有扩展配置
func (es *ExtensionService) GetAllExtensions() ([]models.Extension, error) {
	es.mu.RLock()
	defer es.mu.RUnlock()

	db := es.databaseService.GetDB()
	rows, err := db.Query(sqlGetAllExtensions)
	if err != nil {
		return nil, &ExtensionError{"query_extensions", "", err}
	}
	defer rows.Close()

	var extensions []models.Extension
	for rows.Next() {
		var ext models.Extension
		var configJSON string
		if err := rows.Scan(&ext.ID, &ext.Enabled, &ext.IsDefault, &configJSON); err != nil {
			return nil, &ExtensionError{"scan_extension", "", err}
		}
		if err := json.Unmarshal([]byte(configJSON), &ext.Config); err != nil {
			return nil, &ExtensionError{"unmarshal_config", string(ext.ID), err}
		}
		extensions = append(extensions, ext)
	}

	if err := rows.Err(); err != nil {
		return nil, &ExtensionError{"rows_error", "", err}
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

	db := es.databaseService.GetDB()
	var configJSON []byte
	var err error

	if config != nil {
		configJSON, err = json.Marshal(config)
		if err != nil {
			return &ExtensionError{"marshal_config", string(id), err}
		}
	} else {
		// 如果没有提供配置，保持原有配置
		var currentConfigJSON string
		err = db.QueryRow("SELECT config FROM extensions WHERE id = ?", string(id)).Scan(&currentConfigJSON)
		if err != nil {
			return &ExtensionError{"query_current_config", string(id), err}
		}
		configJSON = []byte(currentConfigJSON)
	}

	_, err = db.Exec(sqlUpdateExtension, enabled, string(configJSON), time.Now(), string(id))
	if err != nil {
		return &ExtensionError{"update_extension", string(id), err}
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

	// 删除所有现有扩展
	db := es.databaseService.GetDB()
	_, err := db.Exec(sqlDeleteAllExtensions)
	if err != nil {
		return &ExtensionError{"delete_all_extensions", "", err}
	}

	// 插入默认扩展配置
	if err := es.insertDefaultExtensions(); err != nil {
		return err
	}

	es.logger.Info("all extensions reset to default")
	return nil
}
