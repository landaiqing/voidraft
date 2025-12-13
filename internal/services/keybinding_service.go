package services

import (
	"context"
	"fmt"
	"voidraft/internal/models"

	"voidraft/internal/models/ent"
	"voidraft/internal/models/ent/keybinding"
	"voidraft/internal/models/schema/mixin"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// KeyBindingService 快捷键服务
type KeyBindingService struct {
	db     *DatabaseService
	logger *log.LogService
}

// NewKeyBindingService 创建快捷键服务
func NewKeyBindingService(db *DatabaseService, logger *log.LogService) *KeyBindingService {
	if logger == nil {
		logger = log.New()
	}
	return &KeyBindingService{db: db, logger: logger}
}

// ServiceStartup 服务启动
func (s *KeyBindingService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	return s.SyncKeyBindings(ctx)
}

// SyncKeyBindings 同步快捷键配置
func (s *KeyBindingService) SyncKeyBindings(ctx context.Context) error {
	defaults := models.NewDefaultKeyBindings()
	definedKeys := make(map[models.KeyBindingKey]models.KeyBinding)
	for _, kb := range defaults {
		definedKeys[kb.Key] = kb
	}

	// 获取数据库中已有的快捷键
	existing, err := s.db.Client.KeyBinding.Query().All(ctx)
	if err != nil {
		return fmt.Errorf("find key bindings error: %w", err)
	}

	existingKeys := make(map[string]bool)
	for _, kb := range existing {
		existingKeys[kb.Key] = true
	}

	// 批量添加缺失的快捷键
	var builders []*ent.KeyBindingCreate
	for key, kb := range definedKeys {
		if !existingKeys[string(key)] {
			create := s.db.Client.KeyBinding.Create().
				SetKey(string(kb.Key)).
				SetCommand(kb.Command).
				SetEnabled(kb.Enabled)
			if kb.Extension != "" {
				create.SetExtension(string(kb.Extension))
			}
			builders = append(builders, create)
		}
	}
	if len(builders) > 0 {
		if _, err := s.db.Client.KeyBinding.CreateBulk(builders...).Save(ctx); err != nil {
			return fmt.Errorf("bulk insert key bindings error: %w", err)
		}
	}

	// 批量删除废弃的快捷键（硬删除）
	var deleteIDs []int
	for _, kb := range existing {
		if _, ok := definedKeys[models.KeyBindingKey(kb.Key)]; !ok {
			deleteIDs = append(deleteIDs, kb.ID)
		}
	}
	if len(deleteIDs) > 0 {
		if _, err := s.db.Client.KeyBinding.Delete().
			Where(keybinding.IDIn(deleteIDs...)).
			Exec(mixin.SkipSoftDelete(ctx)); err != nil {
			return fmt.Errorf("bulk delete key bindings error: %w", err)
		}
	}

	return nil
}

// GetAllKeyBindings 获取所有快捷键
func (s *KeyBindingService) GetAllKeyBindings(ctx context.Context) ([]*ent.KeyBinding, error) {
	return s.db.Client.KeyBinding.Query().All(ctx)
}

// GetKeyBindingByKey 根据Key获取快捷键
func (s *KeyBindingService) GetKeyBindingByKey(ctx context.Context, key string) (*ent.KeyBinding, error) {
	kb, err := s.db.Client.KeyBinding.Query().
		Where(keybinding.Key(key)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("get key binding error: %w", err)
	}
	return kb, nil
}

// UpdateKeyBindingCommand 更新快捷键命令
func (s *KeyBindingService) UpdateKeyBindingCommand(ctx context.Context, key string, command string) error {
	kb, err := s.GetKeyBindingByKey(ctx, key)
	if err != nil {
		return err
	}
	if kb == nil {
		return fmt.Errorf("key binding not found: %s", key)
	}
	return s.db.Client.KeyBinding.UpdateOneID(kb.ID).
		SetCommand(command).
		Exec(ctx)
}

// UpdateKeyBindingEnabled 更新快捷键启用状态
func (s *KeyBindingService) UpdateKeyBindingEnabled(ctx context.Context, key string, enabled bool) error {
	kb, err := s.GetKeyBindingByKey(ctx, key)
	if err != nil {
		return err
	}
	if kb == nil {
		return fmt.Errorf("key binding not found: %s", key)
	}
	return s.db.Client.KeyBinding.UpdateOneID(kb.ID).
		SetEnabled(enabled).
		Exec(ctx)
}

// GetDefaultKeyBindings 获取默认快捷键配置
func (s *KeyBindingService) GetDefaultKeyBindings() []models.KeyBinding {
	return models.NewDefaultKeyBindings()
}
