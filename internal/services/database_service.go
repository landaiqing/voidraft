package services

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
	_ "modernc.org/sqlite" // SQLite driver
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_deleted INTEGER DEFAULT 0
)`

	// Extensions table
	sqlCreateExtensionsTable = `
CREATE TABLE IF NOT EXISTS extensions (
    id TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1,
    is_default INTEGER NOT NULL DEFAULT 0,
    config TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(command, extension)
)`
)

// DatabaseService provides shared database functionality
type DatabaseService struct {
	configService *ConfigService
	logger        *log.LoggerService
	db            *sql.DB
	mu            sync.RWMutex
	ctx           context.Context
}

// NewDatabaseService creates a new database service
func NewDatabaseService(configService *ConfigService, logger *log.LoggerService) *DatabaseService {
	if logger == nil {
		logger = log.New()
	}

	return &DatabaseService{
		configService: configService,
		logger:        logger,
	}
}

// OnStartup initializes the service when the application starts
func (ds *DatabaseService) OnStartup(ctx context.Context, _ application.ServiceOptions) error {
	ds.ctx = ctx
	return ds.initDatabase()
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

	// 检查数据库文件是否存在，如果不存在则创建
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		// 创建空文件
		file, err := os.Create(dbPath)
		if err != nil {
			return fmt.Errorf("failed to create database file: %w", err)
		}
		file.Close()
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	ds.db = db

	// Apply optimization settings
	if _, err := db.Exec(sqlOptimizationSettings); err != nil {
		return fmt.Errorf("failed to apply optimization settings: %w", err)
	}

	// Create all tables
	if err := ds.createTables(); err != nil {
		return fmt.Errorf("failed to create tables: %w", err)
	}

	// Create indexes
	if err := ds.createIndexes(); err != nil {
		return fmt.Errorf("failed to create indexes: %w", err)
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
	}

	for _, index := range indexes {
		if _, err := ds.db.Exec(index); err != nil {
			return err
		}
	}
	return nil
}

// GetDB returns the database connection
func (ds *DatabaseService) GetDB() *sql.DB {
	ds.mu.RLock()
	defer ds.mu.RUnlock()
	return ds.db
}

// OnShutdown shuts down the service when the application closes
func (ds *DatabaseService) OnShutdown() error {
	if ds.db != nil {
		return ds.db.Close()
	}
	return nil
}

// OnDataPathChanged handles data path changes
func (ds *DatabaseService) OnDataPathChanged() error {
	// Close existing database
	if ds.db != nil {
		ds.db.Close()
	}

	// Reinitialize with new path
	return ds.initDatabase()
}
