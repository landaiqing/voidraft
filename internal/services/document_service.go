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
	logger          *log.Service
	mu              sync.RWMutex
	ctx             context.Context
}

// NewDocumentService creates a new document service
func NewDocumentService(databaseService *DatabaseService, logger *log.Service) *DocumentService {
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
	// Check if any document exists
	rows, err := ds.databaseService.SQLite.Query(sqlCountDocuments)
	if err != nil {
		return err
	}

	if len(rows) == 0 {
		return fmt.Errorf("failed to query document count")
	}

	count, ok := rows[0]["COUNT(*)"].(int64)
	if !ok {
		return fmt.Errorf("failed to convert count to int64")
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

	rows, err := ds.databaseService.SQLite.Query(sqlGetDocumentByID, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get document by ID: %w", err)
	}

	if len(rows) == 0 {
		return nil, nil
	}

	row := rows[0]
	doc := &models.Document{}

	// 从Row中提取数据
	if idVal, ok := row["id"].(int64); ok {
		doc.ID = idVal
	}

	if title, ok := row["title"].(string); ok {
		doc.Title = title
	}

	if content, ok := row["content"].(string); ok {
		doc.Content = content
	}

	if createdAt, ok := row["created_at"].(string); ok {
		t, err := time.Parse("2006-01-02 15:04:05", createdAt)
		if err == nil {
			doc.CreatedAt = t
		}
	}

	if updatedAt, ok := row["updated_at"].(string); ok {
		t, err := time.Parse("2006-01-02 15:04:05", updatedAt)
		if err == nil {
			doc.UpdatedAt = t
		}
	}

	if isDeletedInt, ok := row["is_deleted"].(int64); ok {
		doc.IsDeleted = isDeletedInt == 1
	}

	if isLockedInt, ok := row["is_locked"].(int64); ok {
		doc.IsLocked = isLockedInt == 1
	}

	return doc, nil
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
		IsLocked:  false,
	}

	// 执行插入操作
	if err := ds.databaseService.SQLite.Execute(sqlInsertDocument,
		doc.Title, doc.Content, doc.CreatedAt, doc.UpdatedAt); err != nil {
		return nil, fmt.Errorf("failed to create document: %w", err)
	}

	// 获取自增ID
	lastIDRows, err := ds.databaseService.SQLite.Query("SELECT last_insert_rowid()")
	if err != nil {
		return nil, fmt.Errorf("failed to get last insert ID: %w", err)
	}

	if len(lastIDRows) == 0 {
		return nil, fmt.Errorf("no rows returned for last insert ID query")
	}

	// 从结果中提取ID
	lastID, ok := lastIDRows[0]["last_insert_rowid()"].(int64)
	if !ok {
		return nil, fmt.Errorf("failed to convert last insert ID to int64")
	}

	// 返回带ID的文档
	doc.ID = lastID
	return doc, nil
}

// LockDocument 锁定文档，防止删除
func (ds *DocumentService) LockDocument(id int64) error {
	ds.mu.Lock()
	defer ds.mu.Unlock()

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

	err = ds.databaseService.SQLite.Execute(sqlSetDocumentLocked, time.Now(), id)
	if err != nil {
		return fmt.Errorf("failed to lock document: %w", err)
	}
	return nil
}

// UnlockDocument 解锁文档
func (ds *DocumentService) UnlockDocument(id int64) error {
	ds.mu.Lock()
	defer ds.mu.Unlock()

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

	err = ds.databaseService.SQLite.Execute(sqlSetDocumentUnlocked, time.Now(), id)
	if err != nil {
		return fmt.Errorf("failed to unlock document: %w", err)
	}
	return nil
}

// UpdateDocumentContent updates the content of a document
func (ds *DocumentService) UpdateDocumentContent(id int64, content string) error {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	err := ds.databaseService.SQLite.Execute(sqlUpdateDocumentContent, content, time.Now(), id)
	if err != nil {
		return fmt.Errorf("failed to update document content: %w", err)
	}
	return nil
}

// UpdateDocumentTitle updates the title of a document
func (ds *DocumentService) UpdateDocumentTitle(id int64, title string) error {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	err := ds.databaseService.SQLite.Execute(sqlUpdateDocumentTitle, title, time.Now(), id)
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

	err = ds.databaseService.SQLite.Execute(sqlMarkDocumentAsDeleted, time.Now(), id)
	if err != nil {
		return fmt.Errorf("failed to mark document as deleted: %w", err)
	}
	return nil
}

// RestoreDocument restores a deleted document
func (ds *DocumentService) RestoreDocument(id int64) error {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	err := ds.databaseService.SQLite.Execute(sqlRestoreDocument, time.Now(), id)
	if err != nil {
		return fmt.Errorf("failed to restore document: %w", err)
	}
	return nil
}

// ListAllDocumentsMeta lists all active (non-deleted) document metadata
func (ds *DocumentService) ListAllDocumentsMeta() ([]*models.Document, error) {
	ds.mu.RLock()
	defer ds.mu.RUnlock()

	rows, err := ds.databaseService.SQLite.Query(sqlListAllDocumentsMeta)
	if err != nil {
		return nil, fmt.Errorf("failed to list document meta: %w", err)
	}

	var documents []*models.Document
	for _, row := range rows {
		doc := &models.Document{IsDeleted: false}

		if id, ok := row["id"].(int64); ok {
			doc.ID = id
		}

		if title, ok := row["title"].(string); ok {
			doc.Title = title
		}

		if createdAt, ok := row["created_at"].(string); ok {
			t, err := time.Parse("2006-01-02 15:04:05", createdAt)
			if err == nil {
				doc.CreatedAt = t
			}
		}

		if updatedAt, ok := row["updated_at"].(string); ok {
			t, err := time.Parse("2006-01-02 15:04:05", updatedAt)
			if err == nil {
				doc.UpdatedAt = t
			}
		}

		if isLockedInt, ok := row["is_locked"].(int64); ok {
			doc.IsLocked = isLockedInt == 1
		}

		documents = append(documents, doc)
	}

	return documents, nil
}

// ListDeletedDocumentsMeta lists all deleted document metadata
func (ds *DocumentService) ListDeletedDocumentsMeta() ([]*models.Document, error) {
	ds.mu.RLock()
	defer ds.mu.RUnlock()

	rows, err := ds.databaseService.SQLite.Query(sqlListDeletedDocumentsMeta)
	if err != nil {
		return nil, fmt.Errorf("failed to list deleted document meta: %w", err)
	}

	var documents []*models.Document
	for _, row := range rows {
		doc := &models.Document{IsDeleted: true}

		if id, ok := row["id"].(int64); ok {
			doc.ID = id
		}

		if title, ok := row["title"].(string); ok {
			doc.Title = title
		}

		if createdAt, ok := row["created_at"].(string); ok {
			t, err := time.Parse("2006-01-02 15:04:05", createdAt)
			if err == nil {
				doc.CreatedAt = t
			}
		}

		if updatedAt, ok := row["updated_at"].(string); ok {
			t, err := time.Parse("2006-01-02 15:04:05", updatedAt)
			if err == nil {
				doc.UpdatedAt = t
			}
		}

		if isLockedInt, ok := row["is_locked"].(int64); ok {
			doc.IsLocked = isLockedInt == 1
		}

		documents = append(documents, doc)
	}

	return documents, nil
}

// GetFirstDocumentID gets the first active document's ID for frontend initialization
func (ds *DocumentService) GetFirstDocumentID() (int64, error) {
	ds.mu.RLock()
	defer ds.mu.RUnlock()

	rows, err := ds.databaseService.SQLite.Query(sqlGetFirstDocumentID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, nil // No documents exist
		}
		return 0, fmt.Errorf("failed to get first document ID: %w", err)
	}

	if len(rows) == 0 {
		return 0, nil
	}

	id, ok := rows[0]["id"].(int64)
	if !ok {
		return 0, fmt.Errorf("failed to convert ID to int64")
	}

	return id, nil
}
