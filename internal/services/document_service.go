package services

import (
	"context"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"
	"voidraft/internal/models"

	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// DocumentService 提供文档管理功能
type DocumentService struct {
	configService *ConfigService
	logger        *log.LoggerService
	docStore      *Store[models.Document]

	// 文档状态管理
	mu       sync.RWMutex
	document *models.Document

	// 自动保存管理
	ctx           context.Context
	cancel        context.CancelFunc
	isDirty       atomic.Bool
	lastSaveTime  atomic.Int64 // unix timestamp
	saveScheduler chan struct{}

	// 初始化控制
	initOnce sync.Once
}

// NewDocumentService 创建文档服务
func NewDocumentService(configService *ConfigService, logger *log.LoggerService) *DocumentService {
	if logger == nil {
		logger = log.New()
	}

	ctx, cancel := context.WithCancel(context.Background())
	return &DocumentService{
		configService: configService,
		logger:        logger,
		ctx:           ctx,
		cancel:        cancel,
		saveScheduler: make(chan struct{}, 1),
	}
}

// Initialize 初始化服务
func (ds *DocumentService) Initialize() error {
	var initErr error
	ds.initOnce.Do(func() {
		initErr = ds.doInitialize()
	})
	return initErr
}

// doInitialize 执行初始化
func (ds *DocumentService) doInitialize() error {
	if err := ds.initStore(); err != nil {
		return err
	}

	ds.loadDocument()
	go ds.autoSaveWorker()
	return nil
}

// initStore 初始化存储
func (ds *DocumentService) initStore() error {
	docPath, err := ds.getDocumentPath()
	if err != nil {
		return err
	}

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
	ds.mu.Lock()
	defer ds.mu.Unlock()

	doc := ds.docStore.Get()
	if doc.Meta.ID == "" {
		ds.document = models.NewDefaultDocument()
		ds.docStore.Set(*ds.document)
	} else {
		ds.document = &doc
	}

	ds.lastSaveTime.Store(time.Now().Unix())
}

// GetActiveDocument 获取活动文档
func (ds *DocumentService) GetActiveDocument() (*models.Document, error) {
	ds.mu.RLock()
	defer ds.mu.RUnlock()

	if ds.document == nil {
		return nil, nil
	}

	docCopy := *ds.document
	return &docCopy, nil
}

// UpdateActiveDocumentContent 更新文档内容
func (ds *DocumentService) UpdateActiveDocumentContent(content string) error {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	if ds.document != nil && ds.document.Content != content {
		ds.document.Content = content
		ds.markDirty()
	}

	return nil
}

// markDirty 标记为脏数据并触发自动保存
func (ds *DocumentService) markDirty() {
	if ds.isDirty.CompareAndSwap(false, true) {
		select {
		case ds.saveScheduler <- struct{}{}:
		default: // 已有保存任务在队列中
		}
	}
}

// ForceSave 强制保存
func (ds *DocumentService) ForceSave() error {
	return ds.saveDocument()
}

// saveDocument 保存文档
func (ds *DocumentService) saveDocument() error {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	if ds.document == nil {
		return nil
	}

	now := time.Now()
	ds.document.Meta.LastUpdated = now

	if err := ds.docStore.Set(*ds.document); err != nil {
		return err
	}

	if err := ds.docStore.Save(); err != nil {
		return err
	}

	ds.isDirty.Store(false)
	ds.lastSaveTime.Store(now.Unix())
	return nil
}

// autoSaveWorker 自动保存工作协程
func (ds *DocumentService) autoSaveWorker() {
	ticker := time.NewTicker(ds.getAutoSaveInterval())
	defer ticker.Stop()

	for {
		select {
		case <-ds.ctx.Done():
			return
		case <-ds.saveScheduler:
			ds.performAutoSave()
		case <-ticker.C:
			if ds.isDirty.Load() {
				ds.performAutoSave()
			}
			// 动态调整保存间隔
			ticker.Reset(ds.getAutoSaveInterval())
		}
	}
}

// getAutoSaveInterval 获取自动保存间隔
func (ds *DocumentService) getAutoSaveInterval() time.Duration {
	config, err := ds.configService.GetConfig()
	if err != nil {
		return 5 * time.Second
	}
	return time.Duration(config.Editing.AutoSaveDelay) * time.Millisecond
}

// performAutoSave 执行自动保存
func (ds *DocumentService) performAutoSave() {
	if !ds.isDirty.Load() {
		return
	}

	// 防抖：避免过于频繁的保存
	lastSave := time.Unix(ds.lastSaveTime.Load(), 0)
	if time.Since(lastSave) < time.Second {
		// 延迟重试
		time.AfterFunc(time.Second, func() {
			select {
			case ds.saveScheduler <- struct{}{}:
			default:
			}
		})
		return
	}

	if err := ds.saveDocument(); err != nil {
		ds.logger.Error("auto save failed", "error", err)
	}
}

// ReloadDocument 重新加载文档
func (ds *DocumentService) ReloadDocument() error {
	// 先保存当前文档
	if ds.isDirty.Load() {
		if err := ds.saveDocument(); err != nil {
			return err
		}
	}

	// 重新初始化存储
	if err := ds.initStore(); err != nil {
		return err
	}

	// 重新加载
	ds.loadDocument()
	return nil
}

// ServiceShutdown 关闭服务
func (ds *DocumentService) ServiceShutdown() error {
	ds.cancel() // 停止自动保存工作协程

	// 最后保存
	if ds.isDirty.Load() {
		return ds.saveDocument()
	}

	return nil
}

// OnDataPathChanged 处理数据路径变更
func (ds *DocumentService) OnDataPathChanged(oldPath, newPath string) error {
	return ds.ReloadDocument()
}
