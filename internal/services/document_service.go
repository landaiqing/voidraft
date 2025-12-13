package services

import (
	"context"
	"errors"
	"fmt"
	"voidraft/internal/models/ent/document"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
	"voidraft/internal/models/ent"
)

const defaultDocumentTitle = "default"
const defaultDocumentContent = "\n∞∞∞text-a\n"

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
func (s *DocumentService) UpdateDocumentContent(ctx context.Context, id int, content string) error {
	return s.db.Client.Document.UpdateOneID(id).
		SetContent(content).
		Exec(ctx)
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

// ListAllDocumentsMeta 列出所有文档
func (s *DocumentService) ListAllDocumentsMeta(ctx context.Context) ([]*ent.Document, error) {
	return s.db.Client.Document.Query().Select(document.FieldID, document.FieldTitle, document.FieldUpdatedAt, document.FieldLocked, document.FieldCreatedAt).
		Order(ent.Desc(document.FieldUpdatedAt)).
		All(ctx)
}
