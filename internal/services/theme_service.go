package services

import (
	"context"
	"fmt"
	"strings"

	"voidraft/internal/models/ent"
	"voidraft/internal/models/ent/theme"
	"voidraft/internal/models/schema/mixin"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// ThemeService 主题服务
type ThemeService struct {
	db     *DatabaseService
	logger *log.LogService
}

// NewThemeService 创建主题服务
func NewThemeService(db *DatabaseService, logger *log.LogService) *ThemeService {
	if logger == nil {
		logger = log.New()
	}
	return &ThemeService{db: db, logger: logger}
}

// ServiceStartup 服务启动
func (s *ThemeService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	return nil
}

// GetThemeByKey 根据Key获取主题
func (s *ThemeService) GetThemeByKey(ctx context.Context, key string) (*ent.Theme, error) {
	trimmed := strings.TrimSpace(key)
	if trimmed == "" {
		return nil, fmt.Errorf("theme key cannot be empty")
	}

	t, err := s.db.Client.Theme.Query().
		Where(theme.Key(trimmed)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("get theme error: %w", err)
	}
	return t, nil
}

// UpdateTheme 保存或更新主题
func (s *ThemeService) UpdateTheme(ctx context.Context, key string, colors map[string]interface{}) error {
	trimmed := strings.TrimSpace(key)
	if trimmed == "" {
		return fmt.Errorf("theme key cannot be empty")
	}

	if colors == nil {
		colors = map[string]interface{}{}
	}

	// 判断主题类型
	themeType := theme.TypeDark
	if raw, ok := colors["dark"].(bool); ok && !raw {
		themeType = theme.TypeLight
	}

	existing, err := s.GetThemeByKey(ctx, trimmed)
	if err != nil {
		return err
	}

	if existing == nil {
		// 插入新主题
		_, err = s.db.Client.Theme.Create().
			SetKey(trimmed).
			SetType(themeType).
			SetColors(colors).
			Save(ctx)
		return err
	}

	// 更新现有主题
	return s.db.Client.Theme.UpdateOneID(existing.ID).
		SetType(themeType).
		SetColors(colors).
		Exec(ctx)
}

// ResetTheme 删除主题
func (s *ThemeService) ResetTheme(ctx context.Context, key string) error {
	trimmed := strings.TrimSpace(key)
	if trimmed == "" {
		return fmt.Errorf("theme key cannot be empty")
	}

	_, err := s.db.Client.Theme.Delete().
		Where(theme.Key(trimmed)).
		Exec(mixin.SkipSoftDelete(ctx))
	return err
}
