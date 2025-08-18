package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sync"
	"time"
	"voidraft/internal/models"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// SQL constants for document operations
const (

	// Document operations
	sqlGetDocumentByID = `
SELECT id, title, content, created_at, updated_at, is_deleted, is_locked 
FROM documents 
WHERE id = ?`

	sqlInsertDocument = `
INSERT INTO documents (title, content, created_at, updated_at, is_deleted, is_locked)
VALUES (?, ?, ?, ?, 0, 0)`

	sqlUpdateDocumentContent = `
UPDATE documents 
SET content = ?, updated_at = ?
WHERE id = ? AND is_deleted = 0`

	sqlUpdateDocumentTitle = `
UPDATE documents 
SET title = ?, updated_at = ?
WHERE id = ? AND is_deleted = 0`

	sqlMarkDocumentAsDeleted = `
UPDATE documents 
SET is_deleted = 1, updated_at = ?
WHERE id = ? AND is_locked = 0`

	sqlRestoreDocument = `
UPDATE documents 
SET is_deleted = 0, updated_at = ?
WHERE id = ?`

	sqlListAllDocumentsMeta = `
SELECT id, title, created_at, updated_at, is_locked 
FROM documents 
WHERE is_deleted = 0
ORDER BY updated_at DESC`

	sqlListDeletedDocumentsMeta = `
SELECT id, title, created_at, updated_at, is_locked 
FROM documents 
WHERE is_deleted = 1
ORDER BY updated_at DESC`

	sqlGetFirstDocumentID = `
SELECT id FROM documents WHERE is_deleted = 0 ORDER BY id LIMIT 1`

	sqlCountDocuments = `SELECT COUNT(*) FROM documents WHERE is_deleted = 0`

	sqlSetDocumentLocked = `
UPDATE documents
SET is_locked = 1, updated_at = ?
WHERE id = ?`

	sqlSetDocumentUnlocked = `
UPDATE documents
SET is_locked = 0, updated_at = ?
WHERE id = ?`

	sqlDefaultDocumentID = 1 // 默认文档的ID
)

// DocumentService provides document management functionality
type DocumentService struct {
	databaseService *DatabaseService
	logger          *log.LogService
	mu              sync.RWMutex
	ctx             context.Context
}

// NewDocumentService creates a new document service
func NewDocumentService(databaseService *DatabaseService, logger *log.LogService) *DocumentService {
	if logger == nil {
		logger = log.New()
	}

	ds := &DocumentService{
		databaseService: databaseService,
		logger:          logger,
	}

	return ds
}

// ServiceStartup initializes the service when the application starts
func (ds *DocumentService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	ds.ctx = ctx

	// 确保默认文档存在
	if err := ds.ensureDefaultDocument(); err != nil {
		return fmt.Errorf("failed to ensure default document: %w", err)
	}
	return nil
}

// ensureDefaultDocument ensures a default document exists
func (ds *DocumentService) ensureDefaultDocument() error {
	if ds.databaseService == nil || ds.databaseService.db == nil {
		return errors.New("database service not available")
	}

	// Check if any document exists
	var count int64
	err := ds.databaseService.db.QueryRow(sqlCountDocuments).Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to query document count: %w", err)
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

	if ds.databaseService == nil || ds.databaseService.db == nil {
		return nil, errors.New("database service not available")
	}

	doc := &models.Document{}
	var createdAt, updatedAt string
	var isDeleted, isLocked int

	err := ds.databaseService.db.QueryRow(sqlGetDocumentByID, id).Scan(
		&doc.ID,
		&doc.Title,
		&doc.Content,
		&createdAt,
		&updatedAt,
		&isDeleted,
		&isLocked,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get document by ID: %w", err)
	}

	// 转换时间字段
	if t, err := time.Parse("2006-01-02 15:04:05", createdAt); err == nil {
		doc.CreatedAt = t
	}
	if t, err := time.Parse("2006-01-02 15:04:05", updatedAt); err == nil {
		doc.UpdatedAt = t
	}

	// 转换布尔字段
	doc.IsDeleted = isDeleted == 1
	doc.IsLocked = isLocked == 1

	return doc, nil
}

// CreateDocument creates a new document and returns the created document with ID
func (ds *DocumentService) CreateDocument(title string) (*models.Document, error) {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	if ds.databaseService == nil || ds.databaseService.db == nil {
		return nil, errors.New("database service not available")
	}

	// Create document with default content
	now := time.Now()
	doc := &models.Document{
		Title:     title,
		Content:   "∞∞∞text-a\n",
		CreatedAt: now,
		UpdatedAt: now,
		IsDeleted: false,
		IsLocked:  false,
	}

	// 执行插入操作
	result, err := ds.databaseService.db.Exec(sqlInsertDocument,
		doc.Title, doc.Content, doc.CreatedAt.Format("2006-01-02 15:04:05"), doc.UpdatedAt.Format("2006-01-02 15:04:05"))
	if err != nil {
		return nil, fmt.Errorf("failed to create document: %w", err)
	}

	// 获取自增ID
	lastID, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get last insert ID: %w", err)
	}

	// 返回带ID的文档
	doc.ID = lastID
	return doc, nil
}

// LockDocument 锁定文档，防止删除
func (ds *DocumentService) LockDocument(id int64) error {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	if ds.databaseService == nil || ds.databaseService.db == nil {
		return errors.New("database service not available")
	}

	// 检查文档是否存在且未删除
	doc, err := ds.GetDocumentByID(id)
	if err != nil {
		return fmt.Errorf("failed to get document: %w", err)
	}
	if doc == nil {
		return fmt.Errorf("document not found: %d", id)
	}
	if doc.IsDeleted {
		return fmt.Errorf("cannot lock deleted document: %d", id)
	}

	// 如果已经锁定，无需操作
	if doc.IsLocked {
		return nil
	}

	_, err = ds.databaseService.db.Exec(sqlSetDocumentLocked, time.Now().Format("2006-01-02 15:04:05"), id)
	if err != nil {
		return fmt.Errorf("failed to lock document: %w", err)
	}
	return nil
}

// UnlockDocument 解锁文档
func (ds *DocumentService) UnlockDocument(id int64) error {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	if ds.databaseService == nil || ds.databaseService.db == nil {
		return errors.New("database service not available")
	}

	// 检查文档是否存在
	doc, err := ds.GetDocumentByID(id)
	if err != nil {
		return fmt.Errorf("failed to get document: %w", err)
	}
	if doc == nil {
		return fmt.Errorf("document not found: %d", id)
	}

	// 如果未锁定，无需操作
	if !doc.IsLocked {
		return nil
	}

	_, err = ds.databaseService.db.Exec(sqlSetDocumentUnlocked, time.Now().Format("2006-01-02 15:04:05"), id)
	if err != nil {
		return fmt.Errorf("failed to unlock document: %w", err)
	}
	return nil
}

// UpdateDocumentContent updates the content of a document
func (ds *DocumentService) UpdateDocumentContent(id int64, content string) error {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	if ds.databaseService == nil || ds.databaseService.db == nil {
		return errors.New("database service not available")
	}

	_, err := ds.databaseService.db.Exec(sqlUpdateDocumentContent, content, time.Now().Format("2006-01-02 15:04:05"), id)
	if err != nil {
		return fmt.Errorf("failed to update document content: %w", err)
	}
	return nil
}

// UpdateDocumentTitle updates the title of a document
func (ds *DocumentService) UpdateDocumentTitle(id int64, title string) error {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	if ds.databaseService == nil || ds.databaseService.db == nil {
		return errors.New("database service not available")
	}

	_, err := ds.databaseService.db.Exec(sqlUpdateDocumentTitle, title, time.Now().Format("2006-01-02 15:04:05"), id)
	if err != nil {
		return fmt.Errorf("failed to update document title: %w", err)
	}
	return nil
}

// DeleteDocument marks a document as deleted (default document with ID=1 cannot be deleted)
func (ds *DocumentService) DeleteDocument(id int64) error {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	if ds.databaseService == nil || ds.databaseService.db == nil {
		ds.logger.Error("database service not available")
		return errors.New("database service not available")
	}

	// 不允许删除默认文档
	if id == sqlDefaultDocumentID {
		return fmt.Errorf("cannot delete the default document")
	}

	// 检查文档是否锁定
	doc, err := ds.GetDocumentByID(id)
	if err != nil {
		return fmt.Errorf("failed to get document: %w", err)
	}
	if doc == nil {
		return fmt.Errorf("document not found: %d", id)
	}
	if doc.IsLocked {
		return fmt.Errorf("cannot delete locked document: %d", id)
	}

	_, err = ds.databaseService.db.Exec(sqlMarkDocumentAsDeleted, time.Now().Format("2006-01-02 15:04:05"), id)
	if err != nil {
		return fmt.Errorf("failed to mark document as deleted: %w", err)
	}
	return nil
}

// RestoreDocument restores a deleted document
func (ds *DocumentService) RestoreDocument(id int64) error {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	if ds.databaseService == nil || ds.databaseService.db == nil {
		return errors.New("database service not available")
	}

	_, err := ds.databaseService.db.Exec(sqlRestoreDocument, time.Now().Format("2006-01-02 15:04:05"), id)
	if err != nil {
		return fmt.Errorf("failed to restore document: %w", err)
	}
	return nil
}

// ListAllDocumentsMeta lists all active (non-deleted) document metadata
func (ds *DocumentService) ListAllDocumentsMeta() ([]*models.Document, error) {
	ds.mu.RLock()
	defer ds.mu.RUnlock()

	if ds.databaseService == nil || ds.databaseService.db == nil {
		return nil, errors.New("database service not available")
	}

	rows, err := ds.databaseService.db.Query(sqlListAllDocumentsMeta)
	if err != nil {
		return nil, fmt.Errorf("failed to list document meta: %w", err)
	}
	defer rows.Close()

	var documents []*models.Document
	for rows.Next() {
		doc := &models.Document{IsDeleted: false}
		var createdAt, updatedAt string
		var isLocked int

		err := rows.Scan(
			&doc.ID,
			&doc.Title,
			&createdAt,
			&updatedAt,
			&isLocked,
		)

		if err != nil {
			return nil, fmt.Errorf("failed to scan document row: %w", err)
		}

		// 转换时间字段
		if t, err := time.Parse("2006-01-02 15:04:05", createdAt); err == nil {
			doc.CreatedAt = t
		}
		if t, err := time.Parse("2006-01-02 15:04:05", updatedAt); err == nil {
			doc.UpdatedAt = t
		}

		doc.IsLocked = isLocked == 1
		documents = append(documents, doc)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating document rows: %w", err)
	}

	return documents, nil
}

// ListDeletedDocumentsMeta lists all deleted document metadata
func (ds *DocumentService) ListDeletedDocumentsMeta() ([]*models.Document, error) {
	ds.mu.RLock()
	defer ds.mu.RUnlock()

	if ds.databaseService == nil || ds.databaseService.db == nil {
		return nil, errors.New("database service not available")
	}

	rows, err := ds.databaseService.db.Query(sqlListDeletedDocumentsMeta)
	if err != nil {
		return nil, fmt.Errorf("failed to list deleted document meta: %w", err)
	}
	defer rows.Close()

	var documents []*models.Document
	for rows.Next() {
		doc := &models.Document{IsDeleted: true}
		var createdAt, updatedAt string
		var isLocked int

		err := rows.Scan(
			&doc.ID,
			&doc.Title,
			&createdAt,
			&updatedAt,
			&isLocked,
		)

		if err != nil {
			return nil, fmt.Errorf("failed to scan document row: %w", err)
		}

		// 转换时间字段
		if t, err := time.Parse("2006-01-02 15:04:05", createdAt); err == nil {
			doc.CreatedAt = t
		}
		if t, err := time.Parse("2006-01-02 15:04:05", updatedAt); err == nil {
			doc.UpdatedAt = t
		}

		doc.IsLocked = isLocked == 1
		documents = append(documents, doc)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating deleted document rows: %w", err)
	}

	return documents, nil
}

// GetFirstDocumentID gets the first active document's ID for frontend initialization
func (ds *DocumentService) GetFirstDocumentID() (int64, error) {
	ds.mu.RLock()
	defer ds.mu.RUnlock()

	if ds.databaseService == nil || ds.databaseService.db == nil {
		return 0, errors.New("database service not available")
	}

	var id int64
	err := ds.databaseService.db.QueryRow(sqlGetFirstDocumentID).Scan(&id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, nil // No documents exist
		}
		return 0, fmt.Errorf("failed to get first document ID: %w", err)
	}

	return id, nil
}
