package services

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"
	"voidraft/internal/models"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// SQL 查询语句
const (
	// 快捷键操作
	sqlGetAllKeyBindings = `
		SELECT command, extension, key, enabled, is_default 
		FROM key_bindings 
		ORDER BY command
	`

	sqlGetKeyBindingByCommand = `
		SELECT command, extension, key, enabled, is_default 
		FROM key_bindings 
		WHERE command = ?
	`

	sqlInsertKeyBinding = `
		INSERT INTO key_bindings (command, extension, key, enabled, is_default, created_at, updated_at) 
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`

	sqlUpdateKeyBinding = `
		UPDATE key_bindings 
		SET extension = ?, key = ?, enabled = ?, updated_at = ? 
		WHERE command = ?
	`

	sqlDeleteKeyBinding = `
		DELETE FROM key_bindings 
		WHERE command = ?
	`

	sqlDeleteAllKeyBindings = `
		DELETE FROM key_bindings
	`
)

// KeyBindingService 快捷键管理服务
type KeyBindingService struct {
	databaseService *DatabaseService
	logger          *log.Service

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
func NewKeyBindingService(databaseService *DatabaseService, logger *log.Service) *KeyBindingService {
	if logger == nil {
		logger = log.New()
	}

	ctx, cancel := context.WithCancel(context.Background())

	service := &KeyBindingService{
		databaseService: databaseService,
		logger:          logger,
		ctx:             ctx,
		cancel:          cancel,
	}

	return service
}

// initDatabase 初始化数据库数据
func (kbs *KeyBindingService) initDatabase() error {
	kbs.mu.Lock()
	defer kbs.mu.Unlock()

	// 检查是否已有快捷键数据
	rows, err := kbs.databaseService.SQLite.Query("SELECT COUNT(*) FROM key_bindings")
	if err != nil {
		return &KeyBindingError{"check_keybindings_count", "", err}
	}

	if len(rows) == 0 {
		return &KeyBindingError{"check_keybindings_count", "", fmt.Errorf("no rows returned")}
	}

	count, ok := rows[0]["COUNT(*)"].(int64)
	if !ok {
		return &KeyBindingError{"convert_count", "", fmt.Errorf("failed to convert count to int64")}
	}

	// 如果没有数据，插入默认配置
	if count == 0 {
		if err := kbs.insertDefaultKeyBindings(); err != nil {
			kbs.logger.Error("Failed to insert default key bindings", "error", err)
			return err
		}
	}

	return nil
}

// insertDefaultKeyBindings 插入默认快捷键配置
func (kbs *KeyBindingService) insertDefaultKeyBindings() error {
	defaultConfig := models.NewDefaultKeyBindingConfig()
	now := time.Now()

	for _, kb := range defaultConfig.KeyBindings {

		err := kbs.databaseService.SQLite.Execute(sqlInsertKeyBinding,
			string(kb.Command),   // 转换为字符串存储
			string(kb.Extension), // 转换为字符串存储
			kb.Key,
			kb.Enabled,
			kb.IsDefault,
			now,
			now,
		)
		if err != nil {
			return &KeyBindingError{"insert_keybinding", string(kb.Command), err}
		}

	}

	return nil
}

// GetAllKeyBindings 获取所有快捷键配置
func (kbs *KeyBindingService) GetAllKeyBindings() ([]models.KeyBinding, error) {
	kbs.mu.RLock()
	defer kbs.mu.RUnlock()

	rows, err := kbs.databaseService.SQLite.Query(sqlGetAllKeyBindings)
	if err != nil {
		return nil, &KeyBindingError{"query_keybindings", "", err}
	}

	var keyBindings []models.KeyBinding
	for _, row := range rows {
		var kb models.KeyBinding

		if command, ok := row["command"].(string); ok {
			kb.Command = models.KeyBindingCommand(command)
		}

		if extension, ok := row["extension"].(string); ok {
			kb.Extension = models.ExtensionID(extension)
		}

		if key, ok := row["key"].(string); ok {
			kb.Key = key
		}

		if enabled, ok := row["enabled"].(int64); ok {
			kb.Enabled = enabled == 1
		}

		if isDefault, ok := row["is_default"].(int64); ok {
			kb.IsDefault = isDefault == 1
		}

		keyBindings = append(keyBindings, kb)
	}

	return keyBindings, nil
}

// ServiceStartup 启动时调用
func (kbs *KeyBindingService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	kbs.ctx = ctx
	// 初始化数据库
	var initErr error
	kbs.initOnce.Do(func() {
		if err := kbs.initDatabase(); err != nil {
			kbs.logger.Error("failed to initialize keybinding database", "error", err)
			initErr = err
		}
	})
	return initErr
}
