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
	// 使用 type + name 作为唯一键
	definedKeys := make(map[string]models.KeyBinding)
	for _, kb := range defaults {
		key := string(kb.Type) + ":" + string(kb.Name)
		definedKeys[key] = kb
	}

	// 获取数据库中已有的快捷键
	existing, err := s.db.Client.KeyBinding.Query().All(ctx)
	if err != nil {
		return fmt.Errorf("find key bindings error: %w", err)
	}

	existingKeys := make(map[string]bool)
	for _, kb := range existing {
		key := kb.Type + ":" + kb.Name
		existingKeys[key] = true
	}

	// 批量添加缺失的快捷键
	var builders []*ent.KeyBindingCreate
	for key, kb := range definedKeys {
		if !existingKeys[key] {
			create := s.db.Client.KeyBinding.Create().
				SetName(string(kb.Name)).
				SetType(string(kb.Type)).
				SetExtension(string(kb.Extension)).
				SetEnabled(kb.Enabled).
				SetPreventDefault(kb.PreventDefault)

			// 设置快捷键字段
			if kb.Key != "" {
				create.SetKey(kb.Key)
			}
			if kb.Macos != "" {
				create.SetMacos(kb.Macos)
			}
			if kb.Windows != "" {
				create.SetWindows(kb.Windows)
			}
			if kb.Linux != "" {
				create.SetLinux(kb.Linux)
			}
			if kb.Scope != "" {
				create.SetScope(kb.Scope)
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
		key := kb.Type + ":" + kb.Name
		if _, ok := definedKeys[key]; !ok {
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

// GetKeyBindings 根据类型获取快捷键
func (s *KeyBindingService) GetKeyBindings(ctx context.Context, kbType models.KeyBindingType) ([]*ent.KeyBinding, error) {
	if kbType == models.Standard {
		// Standard 模式：只返回 type=standard 且 enabled=true
		return s.db.Client.KeyBinding.Query().
			Where(
				keybinding.Type(string(kbType)),
				keybinding.Enabled(true),
			).
			All(ctx)
	}

	// Emacs 模式：获取所有 enabled=true 的快捷键
	allEnabled, err := s.db.Client.KeyBinding.Query().
		Where(keybinding.Enabled(true)).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("query enabled key bindings error: %w", err)
	}

	// 构建 emacs 快捷键的 name 集合
	emacsNames := make(map[string]bool)
	for _, kb := range allEnabled {
		if kb.Type == string(models.Emacs) {
			emacsNames[kb.Name] = true
		}
	}

	// 过滤：去掉与 emacs 冲突的 standard 快捷键
	var result []*ent.KeyBinding
	for _, kb := range allEnabled {
		// 如果是 standard 类型，且与 emacs 有 name 冲突，则跳过
		if kb.Type == string(models.Standard) && emacsNames[kb.Name] {
			continue
		}
		result = append(result, kb)
	}

	return result, nil
}

// GetKeyBindingByID 根据ID获取快捷键
func (s *KeyBindingService) GetKeyBindingByID(ctx context.Context, id int) (*ent.KeyBinding, error) {
	kb, err := s.db.Client.KeyBinding.Get(ctx, id)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("get key binding error: %w", err)
	}
	return kb, nil
}

// UpdateKeyBindingKeys 更新快捷键绑定（根据操作系统自动判断更新哪个字段）
func (s *KeyBindingService) UpdateKeyBindingKeys(ctx context.Context, id int, key string) error {
	kb, err := s.GetKeyBindingByID(ctx, id)
	if err != nil {
		return err
	}
	if kb == nil {
		return fmt.Errorf("key binding not found: id=%d", id)
	}

	update := s.db.Client.KeyBinding.UpdateOneID(kb.ID)

	os := application.Get().Env.Info().OS
	switch os {
	case "darwin":
		update.SetMacos(key)
	case "windows":
		update.SetWindows(key)
	case "linux":
		update.SetLinux(key)
	default:
		s.logger.Error("unknown os: %s", os)
	}

	return update.SetKey(key).Exec(ctx)
}

// UpdateKeyBindingEnabled 更新快捷键启用状态
func (s *KeyBindingService) UpdateKeyBindingEnabled(ctx context.Context, id int, enabled bool) error {
	kb, err := s.GetKeyBindingByID(ctx, id)
	if err != nil {
		return err
	}
	if kb == nil {
		return fmt.Errorf("key binding not found: id=%d", id)
	}
	return s.db.Client.KeyBinding.UpdateOneID(kb.ID).
		SetEnabled(enabled).
		Exec(ctx)
}

// GetDefaultKeyBindings 获取默认快捷键配置
func (s *KeyBindingService) GetDefaultKeyBindings() []models.KeyBinding {
	return models.NewDefaultKeyBindings()
}

// ResetKeyBindings 重置所有快捷键到默认值
func (s *KeyBindingService) ResetKeyBindings(ctx context.Context) error {
	// 获取默认快捷键
	defaults := models.NewDefaultKeyBindings()

	// 构建默认快捷键映射 (type:name -> KeyBinding)
	defaultsMap := make(map[string]models.KeyBinding)
	for _, kb := range defaults {
		key := string(kb.Type) + ":" + string(kb.Name)
		defaultsMap[key] = kb
	}

	// 获取数据库中所有快捷键
	existing, err := s.db.Client.KeyBinding.Query().All(ctx)
	if err != nil {
		return fmt.Errorf("query key bindings error: %w", err)
	}

	// 更新所有快捷键到默认值
	for _, existingKb := range existing {
		key := existingKb.Type + ":" + existingKb.Name
		defaultKb, ok := defaultsMap[key]
		if !ok {
			// 如果默认配置中没有这个快捷键，跳过
			continue
		}

		// 无条件更新所有字段到默认值
		update := s.db.Client.KeyBinding.UpdateOneID(existingKb.ID).
			SetKey(defaultKb.Key).
			SetMacos(defaultKb.Macos).
			SetWindows(defaultKb.Windows).
			SetLinux(defaultKb.Linux).
			SetScope(defaultKb.Scope).
			SetEnabled(defaultKb.Enabled).
			SetPreventDefault(defaultKb.PreventDefault)

		if err := update.Exec(ctx); err != nil {
			return fmt.Errorf("update key binding error: %w", err)
		}
	}

	return nil
}
