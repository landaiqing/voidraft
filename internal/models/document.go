package models

import (
	"time"
)

// DocumentMeta 文档元数据
type DocumentMeta struct {
	ID          string    `json:"id"`          // 文档唯一标识
	Title       string    `json:"title"`       // 文档标题
	LastUpdated time.Time `json:"lastUpdated"` // 最后更新时间
	CreatedAt   time.Time `json:"createdAt"`   // 创建时间
}

// Document 表示一个文档
type Document struct {
	Meta    DocumentMeta `json:"meta"`    // 元数据
	Content string       `json:"content"` // 文档内容
}

// DocumentInfo 文档信息（不包含内容，用于列表展示）
type DocumentInfo struct {
	ID          string    `json:"id"`          // 文档ID
	Title       string    `json:"title"`       // 文档标题
	LastUpdated time.Time `json:"lastUpdated"` // 最后更新时间
	Path        string    `json:"path"`        // 文档路径
}

// NewDefaultDocument 创建默认文档
func NewDefaultDocument() *Document {
	now := time.Now()
	return &Document{
		Meta: DocumentMeta{
			ID:          "default",
			Title:       "默认文档",
			LastUpdated: now,
			CreatedAt:   now,
		},
		Content: "// 在此处编写文本...",
	}
}
