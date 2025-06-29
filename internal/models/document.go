package models

import (
	"time"
)

// Document 表示一个文档（使用自增主键）
type Document struct {
	ID        int64     `json:"id" db:"id"`
	Title     string    `json:"title" db:"title"`
	Content   string    `json:"content" db:"content"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

// NewDocument 创建新文档（不需要传ID，由数据库自增）
func NewDocument(title, content string) *Document {
	now := time.Now()
	return &Document{
		Title:     title,
		Content:   content,
		CreatedAt: now,
		UpdatedAt: now,
	}
}

// NewDefaultDocument 创建默认文档
func NewDefaultDocument() *Document {
	return NewDocument("default", "∞∞∞text-a\n")
}
