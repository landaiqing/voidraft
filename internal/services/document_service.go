package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"voidraft/internal/models/ent/document"
	"voidraft/internal/models/schema/mixin"

	"voidraft/internal/models/ent"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

const defaultDocumentTitle = "default"
const defaultDocumentContent = "\n∞∞∞text-a-w\n"

var ErrDocumentRevisionConflict = errors.New("document revision conflict")

// DocumentSaveResult describes the outcome of a document save request.
type DocumentSaveResult struct {
	DocumentID    int    `json:"document_id"`
	UpdatedAt     string `json:"updated_at"`
	ContentLength int    `json:"content_length"`
	ContentHash   string `json:"content_hash"`
	SavedAt       string `json:"saved_at"`
	Changed       bool   `json:"changed"`
}

// DocumentService 文档服务
type DocumentService struct {
	db     *DatabaseService
	logger *log.LogService
}

// NewDocumentService 创建文档服务
func NewDocumentService(db *DatabaseService, logger *log.LogService) *DocumentService {
	if logger == nil {
		logger = log.New()
	}
	return &DocumentService{db: db, logger: logger}
}

// ServiceStartup 服务启动
func (s *DocumentService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	exists, err := s.db.Client.Document.Query().Exist(ctx)
	if err != nil {
		return fmt.Errorf("check document exists error: %w", err)
	}
	if !exists {
		_, err = s.CreateDocument(ctx, defaultDocumentTitle)
	}
	return err
}

// GetDocumentByID 根据ID获取文档
func (s *DocumentService) GetDocumentByID(ctx context.Context, id int) (*ent.Document, error) {
	doc, err := s.db.Client.Document.Get(ctx, id)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("get document by id error: %w", err)
	}
	return doc, nil
}

// CreateDocument 创建文档
func (s *DocumentService) CreateDocument(ctx context.Context, title string) (*ent.Document, error) {
	doc, err := s.db.Client.Document.Create().
		SetTitle(title).
		SetContent(defaultDocumentContent).
		Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("create document error: %w", err)
	}
	return doc, nil
}

// UpdateDocumentContent 更新文档内容
func (s *DocumentService) UpdateDocumentContent(ctx context.Context, id int, content string, baseUpdatedAt string) (*DocumentSaveResult, error) {
	doc, err := s.GetDocumentByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if doc == nil {
		return nil, fmt.Errorf("document not found: %d", id)
	}
	if baseUpdatedAt != "" && doc.UpdatedAt != baseUpdatedAt {
		return nil, fmt.Errorf("%w: document %d has changed since %s", ErrDocumentRevisionConflict, id, baseUpdatedAt)
	}
	if doc.Content == content {
		return buildDocumentSaveResult(doc, mixin.NowString(), false), nil
	}

	updatedDoc, err := s.db.Client.Document.UpdateOneID(id).
		SetContent(content).
		Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("update document content error: %w", err)
	}

	return buildDocumentSaveResult(updatedDoc, mixin.NowString(), true), nil
}

// UpdateDocumentTitle 更新文档标题
func (s *DocumentService) UpdateDocumentTitle(ctx context.Context, id int, title string) error {
	return s.db.Client.Document.UpdateOneID(id).
		SetTitle(title).
		Exec(ctx)
}

// LockDocument 锁定文档
func (s *DocumentService) LockDocument(ctx context.Context, id int) error {
	doc, err := s.GetDocumentByID(ctx, id)
	if err != nil {
		return err
	}
	if doc == nil {
		return fmt.Errorf("document not found: %d", id)
	}
	if doc.Locked {
		return nil
	}
	return s.db.Client.Document.UpdateOneID(id).
		SetLocked(true).
		Exec(ctx)
}

// UnlockDocument 解锁文档
func (s *DocumentService) UnlockDocument(ctx context.Context, id int) error {
	doc, err := s.GetDocumentByID(ctx, id)
	if err != nil {
		return err
	}
	if doc == nil {
		return fmt.Errorf("document not found: %d", id)
	}
	if !doc.Locked {
		return nil
	}
	return s.db.Client.Document.UpdateOneID(id).
		SetLocked(false).
		Exec(ctx)
}

// DeleteDocument 删除文档
func (s *DocumentService) DeleteDocument(ctx context.Context, id int) error {
	doc, err := s.GetDocumentByID(ctx, id)
	if err != nil {
		return err
	}
	if doc == nil {
		return fmt.Errorf("document not found: %d", id)
	}
	if doc.Locked {
		return fmt.Errorf("cannot delete locked document: %d", id)
	}
	count, err := s.db.Client.Document.Query().Count(ctx)
	if err != nil {
		return err
	}
	if count <= 1 {
		return errors.New("cannot delete the last document")
	}
	return s.db.Client.Document.DeleteOneID(id).Exec(ctx)
}

// ListAllDocumentsMeta lists document metadata.
func (s *DocumentService) ListAllDocumentsMeta(ctx context.Context) ([]*ent.Document, error) {
	return s.db.Client.Document.Query().Select(document.FieldID, document.FieldTitle, document.FieldUpdatedAt, document.FieldLocked, document.FieldCreatedAt).
		Order(ent.Desc(document.FieldUpdatedAt)).
		All(ctx)
}

func buildDocumentSaveResult(doc *ent.Document, savedAt string, changed bool) *DocumentSaveResult {
	return &DocumentSaveResult{
		DocumentID:    doc.ID,
		UpdatedAt:     doc.UpdatedAt,
		ContentLength: len(doc.Content),
		ContentHash:   generateDocumentContentHash(doc.Content),
		SavedAt:       savedAt,
		Changed:       changed,
	}
}

func generateDocumentContentHash(content string) string {
	sum := sha256.Sum256([]byte(content))
	return hex.EncodeToString(sum[:])
}
