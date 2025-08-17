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
	logger          *log.LogService

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
func NewKeyBindingService(databaseService *DatabaseService, logger *log.LogService) *KeyBindingService {
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

	if kbs.databaseService == nil || kbs.databaseService.db == nil {
		return &KeyBindingError{"check_db", "", errors.New("database service not available")}
	}

	// 检查是否已有快捷键数据
	var count int64
	err := kbs.databaseService.db.QueryRow("SELECT COUNT(*) FROM key_bindings").Scan(&count)
	if err != nil {
		return &KeyBindingError{"check_keybindings_count", "", err}
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
	now := time.Now().Format("2006-01-02 15:04:05")

	for _, kb := range defaultConfig.KeyBindings {
		_, err := kbs.databaseService.db.Exec(sqlInsertKeyBinding,
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

	if kbs.databaseService == nil || kbs.databaseService.db == nil {
		return nil, &KeyBindingError{"query_db", "", errors.New("database service not available")}
	}

	rows, err := kbs.databaseService.db.Query(sqlGetAllKeyBindings)
	if err != nil {
		return nil, &KeyBindingError{"query_keybindings", "", err}
	}
	defer rows.Close()

	var keyBindings []models.KeyBinding
	for rows.Next() {
		var kb models.KeyBinding
		var command, extension string
		var enabled, isDefault int

		err := rows.Scan(
			&command,
			&extension,
			&kb.Key,
			&enabled,
			&isDefault,
		)

		if err != nil {
			return nil, &KeyBindingError{"scan_keybinding", "", err}
		}

		kb.Command = models.KeyBindingCommand(command)
		kb.Extension = models.ExtensionID(extension)
		kb.Enabled = enabled == 1
		kb.IsDefault = isDefault == 1

		keyBindings = append(keyBindings, kb)
	}

	if err = rows.Err(); err != nil {
		return nil, &KeyBindingError{"iterate_keybindings", "", err}
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
