package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
	"voidraft/internal/models"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
	_ "modernc.org/sqlite" // SQLite driver
)

// SQL constants for database operations
const (
	dbName = "voidraft.db"
	// Database schema (simplified single table with auto-increment ID)
	sqlCreateDocumentsTable = `
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT DEFAULT '∞∞∞text-a',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_deleted INTEGER DEFAULT 0
)`

	// Performance optimization indexes
	sqlCreateIndexUpdatedAt = `CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at DESC)`
	sqlCreateIndexTitle     = `CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title)`
	sqlCreateIndexIsDeleted = `CREATE INDEX IF NOT EXISTS idx_documents_is_deleted ON documents(is_deleted)`

	// SQLite performance optimization settings
	sqlOptimizationSettings = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;
PRAGMA temp_store = MEMORY;
PRAGMA foreign_keys = ON;`

	// Document operations
	sqlGetDocumentByID = `
SELECT id, title, content, created_at, updated_at, is_deleted 
FROM documents 
WHERE id = ?`

	sqlInsertDocument = `
INSERT INTO documents (title, content, created_at, updated_at, is_deleted)
VALUES (?, ?, ?, ?, 0)`

	sqlUpdateDocumentContent = `
UPDATE documents 
SET content = ?, updated_at = ?
WHERE id = ?`

	sqlUpdateDocumentTitle = `
UPDATE documents 
SET title = ?, updated_at = ?
WHERE id = ?`

	sqlMarkDocumentAsDeleted = `
UPDATE documents 
SET is_deleted = 1, updated_at = ?
WHERE id = ?`

	sqlRestoreDocument = `
UPDATE documents 
SET is_deleted = 0, updated_at = ?
WHERE id = ?`

	sqlListAllDocumentsMeta = `
SELECT id, title, created_at, updated_at 
FROM documents 
WHERE is_deleted = 0
ORDER BY updated_at DESC`

	sqlListDeletedDocumentsMeta = `
SELECT id, title, created_at, updated_at 
FROM documents 
WHERE is_deleted = 1
ORDER BY updated_at DESC`

	sqlGetFirstDocumentID = `
SELECT id FROM documents WHERE is_deleted = 0 ORDER BY id LIMIT 1`

	sqlCountDocuments = `SELECT COUNT(*) FROM documents WHERE is_deleted = 0`

	sqlDefaultDocumentID = 1 // 默认文档的ID
)

// DocumentService provides document management functionality
type DocumentService struct {
	configService *ConfigService
	logger        *log.LoggerService
	db            *sql.DB
	mu            sync.RWMutex
	ctx           context.Context
}

// NewDocumentService creates a new document service
func NewDocumentService(configService *ConfigService, logger *log.LoggerService) *DocumentService {
	if logger == nil {
		logger = log.New()
	}

	return &DocumentService{
		configService: configService,
		logger:        logger,
	}
}

// OnStartup initializes the service when the application starts
func (ds *DocumentService) OnStartup(ctx context.Context, _ application.ServiceOptions) error {
	ds.ctx = ctx
	return ds.initDatabase()
}

// initDatabase initializes the SQLite database
func (ds *DocumentService) initDatabase() error {
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
		ds.logger.Info("Database file does not exist, creating empty file", "path", dbPath)
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

	// Create table
	if _, err := db.Exec(sqlCreateDocumentsTable); err != nil {
		return fmt.Errorf("failed to create table: %w", err)
	}

	// Create indexes
	if err := ds.createIndexes(); err != nil {
		return fmt.Errorf("failed to create indexes: %w", err)
	}

	// Ensure default document exists
	if err := ds.ensureDefaultDocument(); err != nil {
		return fmt.Errorf("failed to ensure default document: %w", err)
	}

	return nil
}

// getDatabasePath gets the database file path
func (ds *DocumentService) getDatabasePath() (string, error) {
	config, err := ds.configService.GetConfig()
	if err != nil {
		return "", err
	}
	return filepath.Join(config.General.DataPath, dbName), nil
}

// createIndexes creates database indexes
func (ds *DocumentService) createIndexes() error {
	indexes := []string{
		sqlCreateIndexUpdatedAt,
		sqlCreateIndexTitle,
		sqlCreateIndexIsDeleted,
	}

	for _, index := range indexes {
		if _, err := ds.db.Exec(index); err != nil {
			return err
		}
	}
	return nil
}

// ensureDefaultDocument ensures a default document exists
func (ds *DocumentService) ensureDefaultDocument() error {
	// Check if any document exists
	var count int
	err := ds.db.QueryRow(sqlCountDocuments).Scan(&count)
	if err != nil {
		return err
	}

	// If no documents exist, create default document
	if count == 0 {
		defaultDoc := models.NewDefaultDocument()
		_, err := ds.CreateDocument(defaultDoc.Title)
		return err
	}
	return nil
}

// GetDocumentByID gets a document by ID
func (ds *DocumentService) GetDocumentByID(id int64) (*models.Document, error) {
	ds.mu.RLock()
	defer ds.mu.RUnlock()

	var doc models.Document
	var isDeletedInt int
	row := ds.db.QueryRow(sqlGetDocumentByID, id)
	err := row.Scan(&doc.ID, &doc.Title, &doc.Content, &doc.CreatedAt, &doc.UpdatedAt, &isDeletedInt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get document by ID: %w", err)
	}
	doc.IsDeleted = isDeletedInt == 1

	return &doc, nil
}

// CreateDocument creates a new document and returns the created document with ID
func (ds *DocumentService) CreateDocument(title string) (*models.Document, error) {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	// Create document with default content
	now := time.Now()
	doc := &models.Document{
		Title:     title,
		Content:   "∞∞∞text-a\n",
		CreatedAt: now,
		UpdatedAt: now,
		IsDeleted: false,
	}

	result, err := ds.db.Exec(sqlInsertDocument, doc.Title, doc.Content, doc.CreatedAt, doc.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create document: %w", err)
	}

	// Get the auto-generated ID
	id, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get last insert ID: %w", err)
	}

	// Return the created document with ID
	doc.ID = id
	return doc, nil
}

// UpdateDocumentContent updates the content of a document
func (ds *DocumentService) UpdateDocumentContent(id int64, content string) error {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	_, err := ds.db.Exec(sqlUpdateDocumentContent, content, time.Now(), id)
	if err != nil {
		return fmt.Errorf("failed to update document content: %w", err)
	}
	return nil
}

// UpdateDocumentTitle updates the title of a document
func (ds *DocumentService) UpdateDocumentTitle(id int64, title string) error {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	_, err := ds.db.Exec(sqlUpdateDocumentTitle, title, time.Now(), id)
	if err != nil {
		return fmt.Errorf("failed to update document title: %w", err)
	}
	return nil
}

// DeleteDocument marks a document as deleted (default document with ID=1 cannot be deleted)
func (ds *DocumentService) DeleteDocument(id int64) error {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	// 不允许删除默认文档
	if id == sqlDefaultDocumentID {
		return fmt.Errorf("cannot delete the default document")
	}

	_, err := ds.db.Exec(sqlMarkDocumentAsDeleted, time.Now(), id)
	if err != nil {
		return fmt.Errorf("failed to mark document as deleted: %w", err)
	}
	return nil
}

// RestoreDocument restores a deleted document
func (ds *DocumentService) RestoreDocument(id int64) error {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	_, err := ds.db.Exec(sqlRestoreDocument, time.Now(), id)
	if err != nil {
		return fmt.Errorf("failed to restore document: %w", err)
	}
	return nil
}

// ListAllDocumentsMeta lists all active (non-deleted) document metadata
func (ds *DocumentService) ListAllDocumentsMeta() ([]*models.Document, error) {
	ds.mu.RLock()
	defer ds.mu.RUnlock()

	rows, err := ds.db.Query(sqlListAllDocumentsMeta)
	if err != nil {
		return nil, fmt.Errorf("failed to list document meta: %w", err)
	}
	defer rows.Close()

	var documents []*models.Document
	for rows.Next() {
		var doc models.Document
		err := rows.Scan(&doc.ID, &doc.Title, &doc.CreatedAt, &doc.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan document meta: %w", err)
		}
		doc.IsDeleted = false
		documents = append(documents, &doc)
	}

	return documents, nil
}

// ListDeletedDocumentsMeta lists all deleted document metadata
func (ds *DocumentService) ListDeletedDocumentsMeta() ([]*models.Document, error) {
	ds.mu.RLock()
	defer ds.mu.RUnlock()

	rows, err := ds.db.Query(sqlListDeletedDocumentsMeta)
	if err != nil {
		return nil, fmt.Errorf("failed to list deleted document meta: %w", err)
	}
	defer rows.Close()

	var documents []*models.Document
	for rows.Next() {
		var doc models.Document
		err := rows.Scan(&doc.ID, &doc.Title, &doc.CreatedAt, &doc.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan deleted document meta: %w", err)
		}
		doc.IsDeleted = true
		documents = append(documents, &doc)
	}

	return documents, nil
}

// GetFirstDocumentID gets the first active document's ID for frontend initialization
func (ds *DocumentService) GetFirstDocumentID() (int64, error) {
	ds.mu.RLock()
	defer ds.mu.RUnlock()

	var id int64
	err := ds.db.QueryRow(sqlGetFirstDocumentID).Scan(&id)
	if err != nil {
		if err == sql.ErrNoRows {
			return 0, nil // No documents exist
		}
		return 0, fmt.Errorf("failed to get first document ID: %w", err)
	}
	return id, nil
}

// OnShutdown shuts down the service when the application closes
func (ds *DocumentService) OnShutdown() error {
	if ds.db != nil {
		return ds.db.Close()
	}
	return nil
}

// OnDataPathChanged handles data path changes
func (ds *DocumentService) OnDataPathChanged() error {
	// Close existing database
	if ds.db != nil {
		ds.db.Close()
	}

	// Reinitialize with new path
	return ds.initDatabase()
}
