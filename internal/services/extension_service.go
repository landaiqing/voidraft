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
	logger          *log.LogService

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
func NewExtensionService(databaseService *DatabaseService, logger *log.LogService) *ExtensionService {
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

	if es.databaseService == nil || es.databaseService.db == nil {
		return &ExtensionError{"check_db", "", errors.New("database service not available")}
	}

	// 检查是否已有扩展数据
	var count int64
	err := es.databaseService.db.QueryRow("SELECT COUNT(*) FROM extensions").Scan(&count)
	if err != nil {
		return &ExtensionError{"check_extensions_count", "", err}
	}

	// 如果没有数据，插入默认配置
	if count == 0 {
		if err := es.insertDefaultExtensions(); err != nil {
			es.logger.Error("Failed to insert default extensions", "error", err)
			return err
		}
	} else {
		// 检查并补充缺失的扩展
		if err := es.syncExtensions(); err != nil {
			es.logger.Error("Failed to ensure all extensions exist", "error", err)
			return err
		}
	}

	return nil
}

// insertDefaultExtensions 插入默认扩展配置
func (es *ExtensionService) insertDefaultExtensions() error {
	defaultSettings := models.NewDefaultExtensionSettings()
	now := time.Now().Format("2006-01-02 15:04:05")

	for _, ext := range defaultSettings.Extensions {
		configJSON, err := json.Marshal(ext.Config)
		if err != nil {
			return &ExtensionError{"marshal_config", string(ext.ID), err}
		}

		_, err = es.databaseService.db.Exec(sqlInsertExtension,
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

// syncExtensions 确保数据库中的扩展与代码定义同步
func (es *ExtensionService) syncExtensions() error {
	defaultSettings := models.NewDefaultExtensionSettings()
	now := time.Now().Format("2006-01-02 15:04:05")

	// 构建代码中定义的扩展ID集合
	definedExtensions := make(map[string]bool)
	for _, ext := range defaultSettings.Extensions {
		definedExtensions[string(ext.ID)] = true
	}

	// 1. 添加缺失的扩展
	for _, ext := range defaultSettings.Extensions {
		var exists int
		err := es.databaseService.db.QueryRow("SELECT COUNT(*) FROM extensions WHERE id = ?", string(ext.ID)).Scan(&exists)
		if err != nil {
			return &ExtensionError{"check_extension_exists", string(ext.ID), err}
		}

		if exists == 0 {
			configJSON, err := json.Marshal(ext.Config)
			if err != nil {
				return &ExtensionError{"marshal_config", string(ext.ID), err}
			}

			_, err = es.databaseService.db.Exec(sqlInsertExtension,
				string(ext.ID),
				ext.Enabled,
				ext.IsDefault,
				string(configJSON),
				now,
				now,
			)
			if err != nil {
				return &ExtensionError{"insert_missing_extension", string(ext.ID), err}
			}
			es.logger.Info("Added missing extension to database", "id", ext.ID)
		}
	}

	// 2. 删除数据库中已不存在于代码定义的扩展
	rows, err := es.databaseService.db.Query("SELECT id FROM extensions")
	if err != nil {
		return &ExtensionError{"query_all_extension_ids", "", err}
	}
	defer rows.Close()

	var toDelete []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return &ExtensionError{"scan_extension_id", "", err}
		}
		if !definedExtensions[id] {
			toDelete = append(toDelete, id)
		}
	}

	if err = rows.Err(); err != nil {
		return &ExtensionError{"iterate_extension_ids", "", err}
	}

	// 删除不再定义的扩展
	for _, id := range toDelete {
		_, err := es.databaseService.db.Exec("DELETE FROM extensions WHERE id = ?", id)
		if err != nil {
			return &ExtensionError{"delete_obsolete_extension", id, err}
		}
		es.logger.Info("Removed obsolete extension from database", "id", id)
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

	if es.databaseService == nil || es.databaseService.db == nil {
		return nil, &ExtensionError{"query_db", "", errors.New("database service not available")}
	}

	rows, err := es.databaseService.db.Query(sqlGetAllExtensions)
	if err != nil {
		return nil, &ExtensionError{"query_extensions", "", err}
	}
	defer rows.Close()

	var extensions []models.Extension
	for rows.Next() {
		var ext models.Extension
		var id string
		var configJSON string
		var enabled, isDefault int

		err := rows.Scan(
			&id,
			&enabled,
			&isDefault,
			&configJSON,
		)

		if err != nil {
			return nil, &ExtensionError{"scan_extension", "", err}
		}

		ext.ID = models.ExtensionID(id)
		ext.Enabled = enabled == 1
		ext.IsDefault = isDefault == 1

		var config models.ExtensionConfig
		if err := json.Unmarshal([]byte(configJSON), &config); err != nil {
			return nil, &ExtensionError{"unmarshal_config", id, err}
		}
		ext.Config = config

		extensions = append(extensions, ext)
	}

	if err = rows.Err(); err != nil {
		return nil, &ExtensionError{"iterate_extensions", "", err}
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

	if es.databaseService == nil || es.databaseService.db == nil {
		return &ExtensionError{"check_db", string(id), errors.New("database service not available")}
	}

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
		err := es.databaseService.db.QueryRow("SELECT config FROM extensions WHERE id = ?", string(id)).Scan(&currentConfigJSON)
		if err != nil {
			return &ExtensionError{"query_current_config", string(id), err}
		}
		configJSON = []byte(currentConfigJSON)
	}

	_, err = es.databaseService.db.Exec(sqlUpdateExtension,
		enabled,
		string(configJSON),
		time.Now().Format("2006-01-02 15:04:05"),
		string(id))
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

	if es.databaseService == nil || es.databaseService.db == nil {
		return &ExtensionError{"check_db", "", errors.New("database service not available")}
	}

	// 删除所有现有扩展
	_, err := es.databaseService.db.Exec(sqlDeleteAllExtensions)
	if err != nil {
		return &ExtensionError{"delete_all_extensions", "", err}
	}

	// 插入默认扩展配置
	if err := es.insertDefaultExtensions(); err != nil {
		return err
	}

	return nil
}
