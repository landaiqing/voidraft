package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
	"voidraft/internal/models"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// ThemeService 主题服务
type ThemeService struct {
	databaseService *DatabaseService
	logger          *log.LogService
	ctx             context.Context
}

// NewThemeService 创建新的主题服务
func NewThemeService(databaseService *DatabaseService, logger *log.LogService) *ThemeService {
	if logger == nil {
		logger = log.New()
	}

	return &ThemeService{
		databaseService: databaseService,
		logger:          logger,
	}
}

// ServiceStartup 服务启动
func (ts *ThemeService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	ts.ctx = ctx
	return nil
}

// getDB 获取数据库连接
func (ts *ThemeService) getDB() *sql.DB {
	return ts.databaseService.db
}

// GetThemeByName 通过名称获取主题覆盖，若不存在则返回 nil
func (ts *ThemeService) GetThemeByName(name string) (*models.Theme, error) {
	db := ts.getDB()
	if db == nil {
		return nil, fmt.Errorf("database not available")
	}

	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return nil, fmt.Errorf("theme name cannot be empty")
	}

	query := `
		SELECT id, name, type, colors, is_default, created_at, updated_at 
		FROM themes 
		WHERE name = ?
		LIMIT 1
	`

	theme := &models.Theme{}
	err := db.QueryRow(query, trimmed).Scan(
		&theme.ID,
		&theme.Name,
		&theme.Type,
		&theme.Colors,
		&theme.IsDefault,
		&theme.CreatedAt,
		&theme.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to query theme: %w", err)
	}

	return theme, nil
}

// UpdateTheme 保存或更新主题覆盖
func (ts *ThemeService) UpdateTheme(name string, colors models.ThemeColorConfig) error {
	db := ts.getDB()
	if db == nil {
		return fmt.Errorf("database not available")
	}

	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return fmt.Errorf("theme name cannot be empty")
	}

	if colors == nil {
		colors = models.ThemeColorConfig{}
	}
	colors["themeName"] = trimmed

	themeType := models.ThemeTypeDark
	if raw, ok := colors["dark"].(bool); ok && !raw {
		themeType = models.ThemeTypeLight
	}

	now := time.Now().Format("2006-01-02 15:04:05")

	existing, err := ts.GetThemeByName(trimmed)
	if err != nil {
		return err
	}

	if existing == nil {
		_, err = db.Exec(
			`INSERT INTO themes (name, type, colors, is_default, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)`,
			trimmed,
			themeType,
			colors,
			now,
			now,
		)
		if err != nil {
			return fmt.Errorf("failed to insert theme: %w", err)
		}
		return nil
	}

	_, err = db.Exec(
		`UPDATE themes SET type = ?, colors = ?, updated_at = ? WHERE name = ?`,
		themeType,
		colors,
		now,
		trimmed,
	)
	if err != nil {
		return fmt.Errorf("failed to update theme: %w", err)
	}

	return nil
}

// ResetTheme 删除指定主题的覆盖配置
func (ts *ThemeService) ResetTheme(name string) error {
	db := ts.getDB()
	if db == nil {
		return fmt.Errorf("database not available")
	}

	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return fmt.Errorf("theme name cannot be empty")
	}

	if _, err := db.Exec(`DELETE FROM themes WHERE name = ?`, trimmed); err != nil {
		return fmt.Errorf("failed to reset theme: %w", err)
	}

	return nil
}

// ServiceShutdown 服务关闭
func (ts *ThemeService) ServiceShutdown() error {
	return nil
}
