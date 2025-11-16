package models

import (
	"time"
)

// Document represents a document in the system
type Document struct {
	ID        int64  `json:"id" db:"id"`
	Title     string `json:"title" db:"title"`
	Content   string `json:"content" db:"content"`
	CreatedAt string `json:"createdAt" db:"created_at"`
	UpdatedAt string `json:"updatedAt" db:"updated_at"`
	IsDeleted bool   `json:"is_deleted" db:"is_deleted"`
	IsLocked  bool   `json:"is_locked" db:"is_locked"` // 锁定标志，锁定的文档无法被删除
}

// NewDocument 创建新文档
func NewDocument(title, content string) *Document {
	now := time.Now()
	return &Document{
		Title:     title,
		Content:   content,
		CreatedAt: now.String(),
		UpdatedAt: now.String(),
		IsDeleted: false,
		IsLocked:  false, // 默认不锁定
	}
}

// NewDefaultDocument 创建默认文档
func NewDefaultDocument() *Document {
	return NewDocument("default", "\n∞∞∞text-a\n")
}
