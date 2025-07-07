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
	logger          *log.LoggerService

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
func NewKeyBindingService(databaseService *DatabaseService, logger *log.LoggerService) *KeyBindingService {
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
	db := kbs.databaseService.GetDB()
	if db == nil {
		return &KeyBindingError{"get_database", "", fmt.Errorf("database connection is nil")}
	}

	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM key_bindings").Scan(&count)
	if err != nil {
		return &KeyBindingError{"check_keybindings_count", "", err}
	}

	kbs.logger.Info("KeyBinding database check", "existing_count", count)

	// 如果没有数据，插入默认配置
	if count == 0 {
		kbs.logger.Info("No key bindings found, inserting default key bindings...")
		if err := kbs.insertDefaultKeyBindings(); err != nil {
			kbs.logger.Error("Failed to insert default key bindings", "error", err)
			return err
		}
		kbs.logger.Info("Default key bindings inserted successfully")
	} else {
		kbs.logger.Info("Key bindings already exist, skipping default insertion")
	}

	return nil
}

// insertDefaultKeyBindings 插入默认快捷键配置
func (kbs *KeyBindingService) insertDefaultKeyBindings() error {
	defaultConfig := models.NewDefaultKeyBindingConfig()
	db := kbs.databaseService.GetDB()
	now := time.Now()

	kbs.logger.Info("Starting to insert default key bindings", "count", len(defaultConfig.KeyBindings))

	for i, kb := range defaultConfig.KeyBindings {
		kbs.logger.Info("Inserting key binding", "index", i+1, "command", kb.Command, "key", kb.Key, "extension", kb.Extension)

		_, err := db.Exec(sqlInsertKeyBinding,
			kb.Command,
			kb.Extension,
			kb.Key,
			kb.Enabled,
			kb.IsDefault,
			now,
			now,
		)
		if err != nil {
			kbs.logger.Error("Failed to insert key binding", "command", kb.Command, "error", err)
			return &KeyBindingError{"insert_keybinding", string(kb.Command), err}
		}

		kbs.logger.Info("Successfully inserted key binding", "command", kb.Command)
	}

	kbs.logger.Info("Completed inserting all default key bindings")
	return nil
}

// GetKeyBindingConfig 获取完整快捷键配置
func (kbs *KeyBindingService) GetKeyBindingConfig() (*models.KeyBindingConfig, error) {
	keyBindings, err := kbs.GetAllKeyBindings()
	if err != nil {
		return nil, err
	}

	config := &models.KeyBindingConfig{
		KeyBindings: keyBindings,
	}
	return config, nil
}

// GetAllKeyBindings 获取所有快捷键配置
func (kbs *KeyBindingService) GetAllKeyBindings() ([]models.KeyBinding, error) {
	kbs.mu.RLock()
	defer kbs.mu.RUnlock()

	db := kbs.databaseService.GetDB()
	rows, err := db.Query(sqlGetAllKeyBindings)
	if err != nil {
		return nil, &KeyBindingError{"query_keybindings", "", err}
	}
	defer rows.Close()

	var keyBindings []models.KeyBinding
	for rows.Next() {
		var kb models.KeyBinding
		if err := rows.Scan(&kb.Command, &kb.Extension, &kb.Key, &kb.Enabled, &kb.IsDefault); err != nil {
			return nil, &KeyBindingError{"scan_keybinding", "", err}
		}
		keyBindings = append(keyBindings, kb)
	}

	if err := rows.Err(); err != nil {
		return nil, &KeyBindingError{"rows_error", "", err}
	}

	return keyBindings, nil
}

// OnStartup 启动时调用
func (kbs *KeyBindingService) OnStartup(ctx context.Context, _ application.ServiceOptions) error {
	kbs.ctx = ctx
	kbs.logger.Info("KeyBinding service starting up")

	// 初始化数据库
	var initErr error
	kbs.initOnce.Do(func() {
		kbs.logger.Info("Initializing keybinding database...")
		if err := kbs.initDatabase(); err != nil {
			kbs.logger.Error("failed to initialize keybinding database", "error", err)
			initErr = err
		} else {
			kbs.logger.Info("KeyBinding database initialized successfully")
		}
	})
	return initErr
}
