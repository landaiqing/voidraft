package services

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"sync"
	"voidraft/internal/models"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
	_ "modernc.org/sqlite"
)

const (
	dbName = "voidraft.db"

	// SQLite performance optimization settings
	sqlOptimizationSettings = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;
PRAGMA temp_store = MEMORY;
PRAGMA foreign_keys = ON;`

	// Documents table
	sqlCreateDocumentsTable = `
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT DEFAULT '∞∞∞text-a',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_deleted INTEGER DEFAULT 0,
    is_locked INTEGER DEFAULT 0
)`

	// Extensions table
	sqlCreateExtensionsTable = `
CREATE TABLE IF NOT EXISTS extensions (
    id TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1,
    is_default INTEGER NOT NULL DEFAULT 0,
    config TEXT DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
)`

	// Key bindings table
	sqlCreateKeyBindingsTable = `
CREATE TABLE IF NOT EXISTS key_bindings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    command TEXT NOT NULL,
    extension TEXT NOT NULL,
    key TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
)`

	// Themes table
	sqlCreateThemesTable = `
CREATE TABLE IF NOT EXISTS themes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    colors TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
)`
)

// ColumnInfo 存储列的信息
type ColumnInfo struct {
	SQLType      string
	DefaultValue string
}

// TableModel 表示表与模型之间的映射关系
type TableModel struct {
	TableName string
	Model     interface{}
}

// DatabaseService provides shared database functionality
type DatabaseService struct {
	configService *ConfigService
	logger        *log.LogService
	db            *sql.DB
	mu            sync.RWMutex
	ctx           context.Context
	tableModels   []TableModel // 注册的表模型

	// 配置观察者取消函数
	cancelObserver CancelFunc
}

// NewDatabaseService creates a new database service
func NewDatabaseService(configService *ConfigService, logger *log.LogService) *DatabaseService {
	if logger == nil {
		logger = log.New()
	}

	ds := &DatabaseService{
		configService: configService,
		logger:        logger,
	}

	// 注册所有模型
	ds.registerAllModels()

	return ds
}

// registerAllModels 注册所有数据模型，集中管理表-模型映射
func (ds *DatabaseService) registerAllModels() {
	// 文档表
	ds.RegisterModel("documents", &models.Document{})
	// 扩展表
	ds.RegisterModel("extensions", &models.Extension{})
	// 快捷键表
	ds.RegisterModel("key_bindings", &models.KeyBinding{})
	// 主题表
	ds.RegisterModel("themes", &models.Theme{})
}

// ServiceStartup initializes the service when the application starts
func (ds *DatabaseService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	ds.ctx = ctx

	ds.cancelObserver = ds.configService.Watch("general.dataPath", ds.onDataPathChange)

	return ds.initDatabase()
}

// onDataPathChange 数据路径配置变更回调
func (ds *DatabaseService) onDataPathChange(oldValue, newValue interface{}) {
	oldPath := ""
	newPath := ""

	if oldValue != nil {
		oldPath = fmt.Sprintf("%v", oldValue)
	}
	if newValue != nil {
		newPath = fmt.Sprintf("%v", newValue)
	}

	if oldPath != newPath {
		_ = ds.OnDataPathChanged()
	}
}

// initDatabase initializes the SQLite database
func (ds *DatabaseService) initDatabase() error {
	dbPath, err := ds.getDatabasePath()
	if err != nil {
		return fmt.Errorf("failed to get database path: %w", err)
	}

	// 确保数据库目录存在
	dbDir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		return fmt.Errorf("failed to create database directory: %w", err)
	}

	// 打开数据库连接
	ds.db, err = sql.Open("sqlite", dbPath)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	// 测试连接
	if err := ds.db.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	// 应用性能优化设置
	if _, err := ds.db.Exec(sqlOptimizationSettings); err != nil {
		return fmt.Errorf("failed to apply optimization settings: %w", err)
	}

	// 创建表和索引
	if err := ds.createTables(); err != nil {
		return fmt.Errorf("failed to create tables: %w", err)
	}

	if err := ds.createIndexes(); err != nil {
		return fmt.Errorf("failed to create indexes: %w", err)
	}

	// 执行模型与表结构同步
	if err := ds.syncAllModelTables(); err != nil {
		return fmt.Errorf("failed to sync model tables: %w", err)
	}

	return nil
}

// getDatabasePath gets the database file path
func (ds *DatabaseService) getDatabasePath() (string, error) {
	config, err := ds.configService.GetConfig()
	if err != nil {
		return "", err
	}
	return filepath.Join(config.General.DataPath, dbName), nil
}

// createTables creates all database tables
func (ds *DatabaseService) createTables() error {
	tables := []string{
		sqlCreateDocumentsTable,
		sqlCreateExtensionsTable,
		sqlCreateKeyBindingsTable,
		sqlCreateThemesTable,
	}

	for _, table := range tables {
		if _, err := ds.db.Exec(table); err != nil {
			return err
		}
	}
	return nil
}

// createIndexes creates database indexes
func (ds *DatabaseService) createIndexes() error {
	indexes := []string{
		// Documents indexes
		`CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title)`,
		`CREATE INDEX IF NOT EXISTS idx_documents_is_deleted ON documents(is_deleted)`,
		// Extensions indexes
		`CREATE INDEX IF NOT EXISTS idx_extensions_enabled ON extensions(enabled)`,
		// Key bindings indexes
		`CREATE INDEX IF NOT EXISTS idx_key_bindings_command ON key_bindings(command)`,
		`CREATE INDEX IF NOT EXISTS idx_key_bindings_extension ON key_bindings(extension)`,
		`CREATE INDEX IF NOT EXISTS idx_key_bindings_enabled ON key_bindings(enabled)`,
		// Themes indexes
		`CREATE INDEX IF NOT EXISTS idx_themes_type ON themes(type)`,
		`CREATE INDEX IF NOT EXISTS idx_themes_is_default ON themes(is_default)`,
	}

	for _, index := range indexes {
		if _, err := ds.db.Exec(index); err != nil {
			return err
		}
	}
	return nil
}

// RegisterModel 注册模型与表的映射关系
func (ds *DatabaseService) RegisterModel(tableName string, model interface{}) {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	ds.tableModels = append(ds.tableModels, TableModel{
		TableName: tableName,
		Model:     model,
	})
}

// syncAllModelTables 同步所有注册的模型与表结构
func (ds *DatabaseService) syncAllModelTables() error {
	for _, tm := range ds.tableModels {
		if err := ds.syncModelTable(tm.TableName, tm.Model); err != nil {
			return fmt.Errorf("failed to sync table %s: %w", tm.TableName, err)
		}
	}
	return nil
}

// syncModelTable 同步模型与表结构
func (ds *DatabaseService) syncModelTable(tableName string, model interface{}) error {
	// 获取表结构元数据
	columns, err := ds.getTableColumns(tableName)
	if err != nil {
		return fmt.Errorf("failed to get table columns: %w", err)
	}

	// 使用反射从模型中提取字段信息
	expectedColumns, err := ds.getModelColumns(model)
	if err != nil {
		return fmt.Errorf("failed to get model columns: %w", err)
	}

	// 检查缺失的列并添加
	for colName, colInfo := range expectedColumns {
		if _, exists := columns[colName]; !exists {
			// 执行添加列的SQL
			alterSQL := fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s DEFAULT %s",
				tableName, colName, colInfo.SQLType, colInfo.DefaultValue)
			if _, err := ds.db.Exec(alterSQL); err != nil {
				return fmt.Errorf("failed to add column %s: %w", colName, err)
			}
		}
	}

	return nil
}

// getTableColumns 获取表的列信息
func (ds *DatabaseService) getTableColumns(table string) (map[string]string, error) {
	query := fmt.Sprintf("PRAGMA table_info(%s)", table)
	rows, err := ds.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	columns := make(map[string]string)
	for rows.Next() {
		var cid int
		var name, typeName string
		var notNull, pk int
		var dflt_value interface{}

		if err := rows.Scan(&cid, &name, &typeName, &notNull, &dflt_value, &pk); err != nil {
			return nil, err
		}

		columns[name] = typeName
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return columns, nil
}

// getModelColumns 从模型结构体中提取数据库列信息
func (ds *DatabaseService) getModelColumns(model interface{}) (map[string]ColumnInfo, error) {
	columns := make(map[string]ColumnInfo)

	// 使用反射获取结构体的类型信息
	t := reflect.TypeOf(model)
	if t.Kind() == reflect.Ptr {
		t = t.Elem()
	}

	if t.Kind() != reflect.Struct {
		return nil, fmt.Errorf("model must be a struct or a pointer to struct")
	}

	// 遍历所有字段
	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)

		// 只处理有db标签的字段
		dbTag := field.Tag.Get("db")
		if dbTag == "" {
			// 如果没有db标签，跳过该字段
			continue
		}

		// 获取字段类型对应的SQL类型和默认值
		sqlType, defaultVal := getSQLTypeAndDefault(field.Type)

		columns[dbTag] = ColumnInfo{
			SQLType:      sqlType,
			DefaultValue: defaultVal,
		}
	}

	return columns, nil
}

// getSQLTypeAndDefault 根据Go类型获取对应的SQL类型和默认值
func getSQLTypeAndDefault(t reflect.Type) (string, string) {
	switch t.Kind() {
	case reflect.Bool:
		return "INTEGER", "0"
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return "INTEGER", "0"
	case reflect.Float32, reflect.Float64:
		return "REAL", "0.0"
	case reflect.String:
		return "TEXT", "''"
	default:
		return "TEXT", "NULL"
	}
}

// ServiceShutdown shuts down the service when the application closes
func (ds *DatabaseService) ServiceShutdown() error {
	// 取消配置观察者
	if ds.cancelObserver != nil {
		ds.cancelObserver()
	}

	if ds.db != nil {
		return ds.db.Close()
	}
	return nil
}

// OnDataPathChanged handles data path changes
func (ds *DatabaseService) OnDataPathChanged() error {
	// 关闭当前连接
	if ds.db != nil {
		if err := ds.db.Close(); err != nil {
			return err
		}
	}

	// 用新路径重新初始化
	return ds.initDatabase()
}
