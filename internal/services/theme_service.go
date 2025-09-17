package services

import (
	"context"
	"database/sql"
	"fmt"
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

// ServiceStartup 服务启动时初始化
func (ts *ThemeService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	ts.ctx = ctx

	// 初始化默认主题
	return ts.initializeDefaultThemes()
}

// getDB 获取数据库连接
func (ts *ThemeService) getDB() *sql.DB {
	return ts.databaseService.db
}

// initializeDefaultThemes 初始化默认主题
func (ts *ThemeService) initializeDefaultThemes() error {
	db := ts.getDB()
	if db == nil {
		return fmt.Errorf("database not available")
	}

	// 检查是否已存在默认主题
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM themes WHERE is_default = 1").Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to check existing themes: %w", err)
	}

	if count > 0 {
		return nil // 默认主题已存在
	}

	// 创建默认深色主题
	darkTheme := &models.Theme{
		Name:      "Default Dark",
		Type:      models.ThemeTypeDark,
		Colors:    *models.NewDefaultDarkTheme(),
		IsDefault: true,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// 创建默认浅色主题
	lightTheme := &models.Theme{
		Name:      "Default Light",
		Type:      models.ThemeTypeLight,
		Colors:    *models.NewDefaultLightTheme(),
		IsDefault: true,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// 插入默认主题
	if _, err := ts.CreateTheme(darkTheme); err != nil {
		return fmt.Errorf("failed to create default dark theme: %w", err)
	}

	if _, err := ts.CreateTheme(lightTheme); err != nil {
		return fmt.Errorf("failed to create default light theme: %w", err)
	}

	return nil
}

// GetDefaultThemes 获取默认主题
func (ts *ThemeService) GetDefaultThemes() (map[string]*models.Theme, error) {
	query := `
		SELECT id, name, type, colors, is_default, created_at, updated_at 
		FROM themes 
		WHERE is_default = 1
		ORDER BY type
	`

	db := ts.getDB()
	rows, err := db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query default themes: %w", err)
	}
	defer rows.Close()

	themes := make(map[string]*models.Theme)
	for rows.Next() {
		theme := &models.Theme{}
		err := rows.Scan(
			&theme.ID,
			&theme.Name,
			&theme.Type,
			&theme.Colors,
			&theme.IsDefault,
			&theme.CreatedAt,
			&theme.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan theme: %w", err)
		}
		themes[string(theme.Type)] = theme
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate themes: %w", err)
	}

	return themes, nil
}

// GetThemeByType 根据类型获取默认主题
func (ts *ThemeService) GetThemeByType(themeType models.ThemeType) (*models.Theme, error) {
	query := `
		SELECT id, name, type, colors, is_default, created_at, updated_at 
		FROM themes 
		WHERE type = ? AND is_default = 1
		LIMIT 1
	`

	theme := &models.Theme{}
	db := ts.getDB()
	err := db.QueryRow(query, themeType).Scan(
		&theme.ID,
		&theme.Name,
		&theme.Type,
		&theme.Colors,
		&theme.IsDefault,
		&theme.CreatedAt,
		&theme.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("no default theme found for type: %s", themeType)
		}
		return nil, fmt.Errorf("failed to get theme by type: %w", err)
	}

	return theme, nil
}

// UpdateThemeColors 更新主题颜色
func (ts *ThemeService) UpdateThemeColors(themeType models.ThemeType, colors models.ThemeColorConfig) error {
	query := `
		UPDATE themes 
		SET colors = ?, updated_at = ?
		WHERE type = ? AND is_default = 1
	`

	db := ts.getDB()
	_, err := db.Exec(query, colors, time.Now(), themeType)
	if err != nil {
		return fmt.Errorf("failed to update theme colors: %w", err)
	}

	return nil
}

// ResetThemeColors 重置主题颜色为默认值
func (ts *ThemeService) ResetThemeColors(themeType models.ThemeType) error {
	var defaultColors models.ThemeColorConfig

	switch themeType {
	case models.ThemeTypeDark:
		defaultColors = *models.NewDefaultDarkTheme()
	case models.ThemeTypeLight:
		defaultColors = *models.NewDefaultLightTheme()
	default:
		return fmt.Errorf("unknown theme type: %s", themeType)
	}

	return ts.UpdateThemeColors(themeType, defaultColors)
}

// CreateTheme 创建新主题
func (ts *ThemeService) CreateTheme(theme *models.Theme) (*models.Theme, error) {
	query := `
		INSERT INTO themes (name, type, colors, is_default, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`

	db := ts.getDB()
	result, err := db.Exec(
		query,
		theme.Name,
		theme.Type,
		theme.Colors,
		theme.IsDefault,
		theme.CreatedAt,
		theme.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create theme: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get theme ID: %w", err)
	}

	theme.ID = int(id)
	return theme, nil
}

// GetAllThemes 获取所有主题
func (ts *ThemeService) GetAllThemes() ([]*models.Theme, error) {
	query := `
		SELECT id, name, type, colors, is_default, created_at, updated_at 
		FROM themes 
		ORDER BY is_default DESC, created_at ASC
	`

	db := ts.getDB()
	rows, err := db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query themes: %w", err)
	}
	defer rows.Close()

	var themes []*models.Theme
	for rows.Next() {
		theme := &models.Theme{}
		err := rows.Scan(
			&theme.ID,
			&theme.Name,
			&theme.Type,
			&theme.Colors,
			&theme.IsDefault,
			&theme.CreatedAt,
			&theme.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan theme: %w", err)
		}
		themes = append(themes, theme)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate themes: %w", err)
	}

	return themes, nil
}

// ServiceShutdown 服务关闭
func (ts *ThemeService) ServiceShutdown() error {
	return nil
}
