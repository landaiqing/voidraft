package services

import (
	"context"
	"fmt"
	"voidraft/internal/models"

	"voidraft/internal/models/ent"
	"voidraft/internal/models/ent/extension"
	"voidraft/internal/models/ent/keybinding"
	"voidraft/internal/models/schema/mixin"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// ExtensionService 扩展服务
type ExtensionService struct {
	db     *DatabaseService
	logger *log.LogService
}

// NewExtensionService 创建扩展服务
func NewExtensionService(db *DatabaseService, logger *log.LogService) *ExtensionService {
	if logger == nil {
		logger = log.New()
	}
	return &ExtensionService{db: db, logger: logger}
}

// ServiceStartup 服务启动
func (s *ExtensionService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	return s.SyncExtensions(ctx)
}

// SyncExtensions 同步扩展配置
func (s *ExtensionService) SyncExtensions(ctx context.Context) error {
	defaults := models.NewDefaultExtensions()
	definedKeys := make(map[models.ExtensionKey]models.Extension)
	for _, ext := range defaults {
		definedKeys[ext.Key] = ext
	}

	// 获取数据库中已有的扩展
	existing, err := s.db.Client.Extension.Query().All(ctx)
	if err != nil {
		return fmt.Errorf("find extensions error: %w", err)
	}

	existingKeys := make(map[string]bool)
	for _, ext := range existing {
		existingKeys[ext.Key] = true
	}

	// 批量添加缺失的扩展
	var builders []*ent.ExtensionCreate
	for key, ext := range definedKeys {
		if !existingKeys[string(key)] {
			builders = append(builders, s.db.Client.Extension.Create().
				SetKey(string(ext.Key)).
				SetEnabled(ext.Enabled).
				SetConfig(ext.Config))
		}
	}
	if len(builders) > 0 {
		if _, err := s.db.Client.Extension.CreateBulk(builders...).Save(ctx); err != nil {
			return fmt.Errorf("bulk insert extensions error: %w", err)
		}
	}

	// 批量删除废弃的扩展
	var deleteIDs []int
	for _, ext := range existing {
		if _, ok := definedKeys[models.ExtensionKey(ext.Key)]; !ok {
			deleteIDs = append(deleteIDs, ext.ID)
		}
	}
	if len(deleteIDs) > 0 {
		if _, err := s.db.Client.Extension.Delete().
			Where(extension.IDIn(deleteIDs...)).
			Exec(mixin.SkipSoftDelete(ctx)); err != nil {
			return fmt.Errorf("bulk delete extensions error: %w", err)
		}
	}

	return nil
}

// GetAllExtensions 获取所有扩展
func (s *ExtensionService) GetAllExtensions(ctx context.Context) ([]*ent.Extension, error) {
	return s.db.Client.Extension.Query().All(ctx)
}

// GetExtensionByKey 根据Key获取扩展
func (s *ExtensionService) GetExtensionByKey(ctx context.Context, key string) (*ent.Extension, error) {
	ext, err := s.db.Client.Extension.Query().
		Where(extension.Key(key)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("get extension error: %w", err)
	}
	return ext, nil
}

// UpdateExtensionEnabled 更新扩展启用状态
func (s *ExtensionService) UpdateExtensionEnabled(ctx context.Context, key string, enabled bool) error {
	ext, err := s.GetExtensionByKey(ctx, key)
	if err != nil {
		return err
	}
	if ext == nil {
		return fmt.Errorf("extension not found: %s", key)
	}

	// 更新扩展状态
	if err := s.db.Client.Extension.UpdateOneID(ext.ID).
		SetEnabled(enabled).
		Exec(ctx); err != nil {
		return err
	}

	// 同步更新该扩展关联的快捷键启用状态
	if _, err := s.db.Client.KeyBinding.Update().
		Where(keybinding.Extension(key)).
		SetEnabled(enabled).
		Save(ctx); err != nil {
		return fmt.Errorf("update keybindings for extension %s error: %w", key, err)
	}

	return nil
}

// UpdateExtensionConfig 更新扩展配置
func (s *ExtensionService) UpdateExtensionConfig(ctx context.Context, key string, config map[string]interface{}) error {
	ext, err := s.GetExtensionByKey(ctx, key)
	if err != nil {
		return err
	}
	if ext == nil {
		return fmt.Errorf("extension not found: %s", key)
	}
	return s.db.Client.Extension.UpdateOneID(ext.ID).
		SetConfig(config).
		Exec(ctx)
}

// ResetExtensionConfig 重置单个扩展到默认状态
func (s *ExtensionService) ResetExtensionConfig(ctx context.Context, key string) error {
	defaults := models.NewDefaultExtensions()
	var defaultExt *models.Extension
	for _, ext := range defaults {
		if string(ext.Key) == key {
			defaultExt = &ext
			break
		}
	}
	if defaultExt == nil {
		return fmt.Errorf("default extension not found: %s", key)
	}

	ext, err := s.GetExtensionByKey(ctx, key)
	if err != nil {
		return err
	}
	if ext == nil {
		return fmt.Errorf("extension not found: %s", key)
	}

	return s.db.Client.Extension.UpdateOneID(ext.ID).
		SetEnabled(defaultExt.Enabled).
		SetConfig(defaultExt.Config).
		Exec(ctx)
}

// GetDefaultExtensions 获取默认扩展配置（用于前端绑定生成）
func (s *ExtensionService) GetDefaultExtensions() []models.Extension {
	return models.NewDefaultExtensions()
}
