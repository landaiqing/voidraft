package services

import (
	"os"
	"path/filepath"
	"sync"
	"time"
	"voidraft/internal/models"

	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// DocumentService 提供文档管理功能
type DocumentService struct {
	configService *ConfigService
	logger        *log.LoggerService
	document      *models.Document
	docStore      *Store[models.Document]
	mutex         sync.RWMutex

	// 自动保存优化
	saveTimer      *time.Timer
	isDirty        bool
	lastSaveTime   time.Time
	pendingContent string // 暂存待保存的内容
}

// NewDocumentService 创建文档服务
func NewDocumentService(configService *ConfigService, logger *log.LoggerService) *DocumentService {
	if logger == nil {
		logger = log.New()
	}

	return &DocumentService{
		configService: configService,
		logger:        logger,
	}
}

// Initialize 初始化服务
func (ds *DocumentService) Initialize() error {
	if err := ds.initStore(); err != nil {
		return err
	}

	ds.loadDocument()
	ds.startAutoSave()
	return nil
}

// initStore 初始化存储
func (ds *DocumentService) initStore() error {
	docPath, err := ds.getDocumentPath()
	if err != nil {
		return err
	}

	// 确保目录存在
	if err := os.MkdirAll(filepath.Dir(docPath), 0755); err != nil {
		return err
	}

	ds.docStore = NewStore[models.Document](StoreOption{
		FilePath: docPath,
		AutoSave: false,
		Logger:   ds.logger,
	})

	return nil
}

// getDocumentPath 获取文档路径
func (ds *DocumentService) getDocumentPath() (string, error) {
	config, err := ds.configService.GetConfig()
	if err != nil {
		return "", err
	}

	return filepath.Join(config.General.DataPath, "docs", "default.json"), nil
}

// loadDocument 加载文档
func (ds *DocumentService) loadDocument() {
	ds.mutex.Lock()
	defer ds.mutex.Unlock()

	doc := ds.docStore.Get()
	if doc.Meta.ID == "" {
		// 创建新文档
		ds.document = models.NewDefaultDocument()
		ds.docStore.Set(*ds.document)
		ds.logger.Info("Document: Created new document")
	} else {
		ds.document = &doc
		ds.logger.Info("Document: Loaded existing document")
	}
}

// GetActiveDocument 获取活动文档
func (ds *DocumentService) GetActiveDocument() (*models.Document, error) {
	ds.mutex.RLock()
	defer ds.mutex.RUnlock()

	if ds.document == nil {
		return nil, nil
	}

	// 返回副本
	docCopy := *ds.document
	return &docCopy, nil
}

// UpdateActiveDocumentContent 更新文档内容
func (ds *DocumentService) UpdateActiveDocumentContent(content string) error {
	ds.mutex.Lock()
	defer ds.mutex.Unlock()

	if ds.document != nil {
		// 只在内容真正改变时才标记为脏
		if ds.document.Content != content {
			ds.pendingContent = content
			ds.isDirty = true
		}
	}

	return nil
}

// ForceSave 强制保存
func (ds *DocumentService) ForceSave() error {
	ds.mutex.Lock()
	defer ds.mutex.Unlock()

	if ds.document == nil {
		return nil
	}

	// 应用待保存的内容
	if ds.pendingContent != "" {
		ds.document.Content = ds.pendingContent
		ds.pendingContent = ""
	}

	now := time.Now()
	ds.document.Meta.LastUpdated = now

	if err := ds.docStore.Set(*ds.document); err != nil {
		return err
	}

	if err := ds.docStore.Save(); err != nil {
		return err
	}

	ds.isDirty = false
	ds.lastSaveTime = now
	ds.logger.Info("Document: Force save completed")
	return nil
}

// startAutoSave 启动自动保存
func (ds *DocumentService) startAutoSave() {
	delay := 5 * time.Second // 默认延迟

	if config, err := ds.configService.GetConfig(); err == nil {
		delay = time.Duration(config.Editing.AutoSaveDelay) * time.Millisecond
	}

	ds.scheduleAutoSave(delay)
}

// scheduleAutoSave 安排自动保存
func (ds *DocumentService) scheduleAutoSave(delay time.Duration) {
	if ds.saveTimer != nil {
		ds.saveTimer.Stop()
	}

	ds.saveTimer = time.AfterFunc(delay, func() {
		ds.performAutoSave()
		ds.startAutoSave() // 重新安排
	})
}

// performAutoSave 执行自动保存
func (ds *DocumentService) performAutoSave() {
	ds.mutex.Lock()
	defer ds.mutex.Unlock()

	if !ds.isDirty || ds.document == nil {
		return
	}

	// 检查距离上次保存的时间间隔，避免过于频繁的保存
	now := time.Now()
	if now.Sub(ds.lastSaveTime) < time.Second {
		// 如果距离上次保存不到1秒，跳过此次保存
		// 下一个自动保存周期会重新尝试
		ds.logger.Debug("Document: Skipping auto save due to recent save")
		return
	}

	// 应用待保存的内容
	if ds.pendingContent != "" {
		ds.document.Content = ds.pendingContent
		ds.pendingContent = ""
	}

	ds.document.Meta.LastUpdated = now

	if err := ds.docStore.Set(*ds.document); err != nil {
		ds.logger.Error("Document: Auto save failed", "error", err)
		return
	}

	if err := ds.docStore.Save(); err != nil {
		ds.logger.Error("Document: Auto save failed", "error", err)
		return
	}

	ds.isDirty = false
	ds.lastSaveTime = now
	ds.logger.Debug("Document: Auto save completed")
}

// ReloadDocument 重新加载文档
func (ds *DocumentService) ReloadDocument() error {
	ds.mutex.Lock()
	defer ds.mutex.Unlock()

	// 强制保存当前文档
	if ds.document != nil && ds.isDirty {
		if err := ds.forceSaveInternal(); err != nil {
			ds.logger.Error("Document: Failed to save before reload", "error", err)
		}
	}

	// 重新初始化存储
	if err := ds.initStore(); err != nil {
		return err
	}

	// 重新加载文档
	doc := ds.docStore.Get()
	if doc.Meta.ID == "" {
		// 创建新文档
		ds.document = models.NewDefaultDocument()
		ds.docStore.Set(*ds.document)
		ds.logger.Info("Document: Created new document after reload")
	} else {
		ds.document = &doc
		ds.logger.Info("Document: Loaded existing document after reload")
	}

	// 重置状态
	ds.isDirty = false
	ds.pendingContent = ""
	ds.lastSaveTime = time.Now()

	return nil
}

// forceSaveInternal 内部强制保存（不加锁）
func (ds *DocumentService) forceSaveInternal() error {
	if ds.document == nil {
		return nil
	}

	// 应用待保存的内容
	if ds.pendingContent != "" {
		ds.document.Content = ds.pendingContent
		ds.pendingContent = ""
	}

	now := time.Now()
	ds.document.Meta.LastUpdated = now

	if err := ds.docStore.Set(*ds.document); err != nil {
		return err
	}

	if err := ds.docStore.Save(); err != nil {
		return err
	}

	ds.isDirty = false
	ds.lastSaveTime = now
	return nil
}

// ServiceShutdown 关闭服务
func (ds *DocumentService) ServiceShutdown() error {
	// 停止定时器
	if ds.saveTimer != nil {
		ds.saveTimer.Stop()
	}

	// 最后保存
	if err := ds.ForceSave(); err != nil {
		ds.logger.Error("Document: Failed to save on shutdown", "error", err)
	}

	ds.logger.Info("Document: Service shutdown completed")
	return nil
}

// OnDataPathChanged 处理数据路径变更
func (ds *DocumentService) OnDataPathChanged(oldPath, newPath string) error {
	ds.logger.Info("Document: Data path changed, reloading document",
		"oldPath", oldPath,
		"newPath", newPath)

	// 重新加载文档以使用新的路径
	return ds.ReloadDocument()
}
