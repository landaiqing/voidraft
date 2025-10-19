package services

import (
	"context"
	"database/sql"
	"errors"
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

// initializeDefaultThemes 初始化所有预设主题
func (ts *ThemeService) initializeDefaultThemes() error {
	db := ts.getDB()
	if db == nil {
		return fmt.Errorf("database not available")
	}

	// 获取所有已存在的主题名称
	existingThemes := make(map[string]bool)
	rows, err := db.Query("SELECT name FROM themes")
	if err != nil {
		return fmt.Errorf("failed to query existing themes: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return fmt.Errorf("failed to scan theme name: %w", err)
		}
		existingThemes[name] = true
	}

	// 定义所有预设主题配置
	now := time.Now().Format("2006-01-02 15:04:05")
	presetThemes := []struct {
		config    *models.ThemeColorConfig
		themeType models.ThemeType
		isDefault bool
	}{
		// 默认主题
		{models.NewDefaultDarkTheme(), models.ThemeTypeDark, true},
		{models.NewDefaultLightTheme(), models.ThemeTypeLight, true},

		// 深色主题预设
		{models.NewDraculaTheme(), models.ThemeTypeDark, false},
		{models.NewAuraTheme(), models.ThemeTypeDark, false},
		{models.NewGitHubDarkTheme(), models.ThemeTypeDark, false},
		{models.NewMaterialDarkTheme(), models.ThemeTypeDark, false},
		{models.NewOneDarkTheme(), models.ThemeTypeDark, false},
		{models.NewSolarizedDarkTheme(), models.ThemeTypeDark, false},
		{models.NewTokyoNightTheme(), models.ThemeTypeDark, false},
		{models.NewTokyoNightStormTheme(), models.ThemeTypeDark, false},

		// 浅色主题预设
		{models.NewGitHubLightTheme(), models.ThemeTypeLight, false},
		{models.NewMaterialLightTheme(), models.ThemeTypeLight, false},
		{models.NewSolarizedLightTheme(), models.ThemeTypeLight, false},
		{models.NewTokyoNightDayTheme(), models.ThemeTypeLight, false},
	}

	// 筛选出需要创建的主题
	var themesToCreate []*models.Theme
	for _, preset := range presetThemes {
		if !existingThemes[preset.config.Name] {
			themesToCreate = append(themesToCreate, &models.Theme{
				Name:      preset.config.Name,
				Type:      preset.themeType,
				Colors:    *preset.config,
				IsDefault: preset.isDefault,
				CreatedAt: now,
				UpdatedAt: now,
			})
		}
	}

	if len(themesToCreate) == 0 {
		return nil
	}

	// 批量插入主题
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`
		INSERT INTO themes (name, type, colors, is_default, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return fmt.Errorf("failed to prepare statement: %w", err)
	}
	defer stmt.Close()

	for _, theme := range themesToCreate {
		_, err := stmt.Exec(
			theme.Name,
			theme.Type,
			theme.Colors,
			theme.IsDefault,
			theme.CreatedAt,
			theme.UpdatedAt,
		)
		if err != nil {
			return fmt.Errorf("failed to insert theme %s: %w", theme.Name, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}
	return nil
}

// GetThemeByID 根据ID获取主题
func (ts *ThemeService) GetThemeByID(id int) (*models.Theme, error) {
	query := `
		SELECT id, name, type, colors, is_default, created_at, updated_at 
		FROM themes 
		WHERE id = ?
		LIMIT 1
	`

	theme := &models.Theme{}
	db := ts.getDB()
	err := db.QueryRow(query, id).Scan(
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
			return nil, fmt.Errorf("theme not found with id: %d", id)
		}
		return nil, fmt.Errorf("failed to get theme by id: %w", err)
	}

	return theme, nil
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

// GetThemesByType 根据类型获取所有主题
func (ts *ThemeService) GetThemesByType(themeType models.ThemeType) ([]*models.Theme, error) {
	query := `
		SELECT id, name, type, colors, is_default, created_at, updated_at 
		FROM themes 
		WHERE type = ?
		ORDER BY is_default DESC, name ASC
	`

	db := ts.getDB()
	rows, err := db.Query(query, themeType)
	if err != nil {
		return nil, fmt.Errorf("failed to query themes by type: %w", err)
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

// UpdateTheme 更新主题
func (ts *ThemeService) UpdateTheme(id int, colors models.ThemeColorConfig) error {
	query := `
		UPDATE themes 
		SET colors = ?, updated_at = ?
		WHERE id = ?
	`

	db := ts.getDB()
	result, err := db.Exec(query, colors, time.Now().Format("2006-01-02 15:04:05"), id)
	if err != nil {
		return fmt.Errorf("failed to update theme: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("theme not found with id: %d", id)
	}

	return nil
}

// ResetTheme 重置主题为预设配置
func (ts *ThemeService) ResetTheme(id int) error {
	// 先获取主题信息
	theme, err := ts.GetThemeByID(id)
	if err != nil {
		return err
	}

	// 根据主题名称获取预设配置
	var presetConfig *models.ThemeColorConfig
	switch theme.Name {
	// 默认主题
	case "default-dark":
		presetConfig = models.NewDefaultDarkTheme()
	case "default-light":
		presetConfig = models.NewDefaultLightTheme()

	// 深色主题预设
	case "dracula":
		presetConfig = models.NewDraculaTheme()
	case "aura":
		presetConfig = models.NewAuraTheme()
	case "github-dark":
		presetConfig = models.NewGitHubDarkTheme()
	case "material-dark":
		presetConfig = models.NewMaterialDarkTheme()
	case "one-dark":
		presetConfig = models.NewOneDarkTheme()
	case "solarized-dark":
		presetConfig = models.NewSolarizedDarkTheme()
	case "tokyo-night":
		presetConfig = models.NewTokyoNightTheme()
	case "tokyo-night-storm":
		presetConfig = models.NewTokyoNightStormTheme()

	// 浅色主题预设
	case "github-light":
		presetConfig = models.NewGitHubLightTheme()
	case "material-light":
		presetConfig = models.NewMaterialLightTheme()
	case "solarized-light":
		presetConfig = models.NewSolarizedLightTheme()
	case "tokyo-night-day":
		presetConfig = models.NewTokyoNightDayTheme()

	default:
		return fmt.Errorf("no preset configuration found for theme: %s", theme.Name)
	}

	return ts.UpdateTheme(id, *presetConfig)
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
		ORDER BY is_default DESC, type DESC, name ASC
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
