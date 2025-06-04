package services

import (
	"errors"
	"fmt"
	"github.com/wailsapp/wails/v3/pkg/services/log"
	"os"
	"path/filepath"
	"sync"
	"time"
	"voidraft/internal/models"
)

// DocumentError 文档操作错误
type DocumentError struct {
	Operation string // 操作名称
	Err       error  // 原始错误
}

// Error 实现error接口
func (e *DocumentError) Error() string {
	return fmt.Sprintf("document error during %s: %v", e.Operation, e.Err)
}

// Unwrap 获取原始错误
func (e *DocumentError) Unwrap() error {
	return e.Err
}

// DocumentService 提供文档管理功能
type DocumentService struct {
	configService *ConfigService
	logger        *log.LoggerService
	document      *models.Document // 文档实例
	docStore      *Store[models.Document]
	mutex         sync.RWMutex // 保护document的读写

	// 定时保存
	saveTimer  *time.Timer
	timerMutex sync.Mutex // 保护定时器操作
	isDirty    bool       // 文档是否有未保存的变更

	// 服务控制
	shutdown     chan struct{}
	shutdownOnce sync.Once
}

// NewDocumentService 创建新的文档服务实例
func NewDocumentService(configService *ConfigService, logger *log.LoggerService) *DocumentService {
	if logger == nil {
		logger = log.New()
	}

	service := &DocumentService{
		configService: configService,
		logger:        logger,
		shutdown:      make(chan struct{}),
	}

	return service
}

// Initialize 初始化文档服务
func (ds *DocumentService) Initialize() error {
	// 确保文档目录存在
	if err := ds.ensureDocumentsDir(); err != nil {
		ds.logger.Error("Document: Failed to ensure documents directory", "error", err)
		return &DocumentError{Operation: "initialize", Err: err}
	}

	// 初始化文档存储
	if err := ds.initDocumentStore(); err != nil {
		ds.logger.Error("Document: Failed to initialize document store", "error", err)
		return &DocumentError{Operation: "init_store", Err: err}
	}

	// 加载默认文档
	if err := ds.loadDefaultDocument(); err != nil {
		ds.logger.Error("Document: Failed to load default document", "error", err)
		return &DocumentError{Operation: "load_default", Err: err}
	}

	// 启动定时保存
	ds.startAutoSave()

	return nil
}

// startAutoSave 启动定时保存
func (ds *DocumentService) startAutoSave() {
	config, err := ds.configService.GetConfig()
	if err != nil {
		ds.logger.Error("Document: Failed to get config for auto save", "error", err)
		ds.scheduleNextSave(5 * time.Second) // 默认5秒
		return
	}

	delay := time.Duration(config.Editing.AutoSaveDelay) * time.Millisecond
	ds.scheduleNextSave(delay)
}

// scheduleNextSave 安排下次保存
func (ds *DocumentService) scheduleNextSave(delay time.Duration) {
	ds.timerMutex.Lock()
	defer ds.timerMutex.Unlock()

	// 停止现有定时器
	if ds.saveTimer != nil {
		ds.saveTimer.Stop()
	}

	// 创建新的定时器
	ds.saveTimer = time.AfterFunc(delay, func() {
		ds.performAutoSave()
		// 安排下次保存
		ds.startAutoSave()
	})
}

// performAutoSave 执行自动保存
func (ds *DocumentService) performAutoSave() {
	ds.mutex.Lock()
	defer ds.mutex.Unlock()

	// 如果没有变更，跳过保存
	if !ds.isDirty || ds.document == nil {
		return
	}

	// 更新元数据并保存
	ds.document.Meta.LastUpdated = time.Now()

	ds.logger.Info("Document: Auto saving document",
		"id", ds.document.Meta.ID,
		"contentLength", len(ds.document.Content))

	if err := ds.docStore.Set(*ds.document); err != nil {
		ds.logger.Error("Document: Failed to auto save document", "error", err)
		return
	}

	if err := ds.docStore.Save(); err != nil {
		ds.logger.Error("Document: Failed to force save document", "error", err)
		return
	}

	// 重置脏标记
	ds.isDirty = false
	ds.logger.Info("Document: Auto save completed")
}

// stopTimer 停止定时器
func (ds *DocumentService) stopTimer() {
	ds.timerMutex.Lock()
	defer ds.timerMutex.Unlock()

	if ds.saveTimer != nil {
		ds.saveTimer.Stop()
		ds.saveTimer = nil
	}
}

// initDocumentStore 初始化文档存储
func (ds *DocumentService) initDocumentStore() error {
	docPath, err := ds.getDefaultDocumentPath()
	if err != nil {
		return err
	}

	ds.logger.Info("Document: Initializing document store", "path", docPath)

	ds.docStore = NewStore[models.Document](StoreOption{
		FilePath: docPath,
		AutoSave: true,
		Logger:   ds.logger,
	})

	return nil
}

// ensureDocumentsDir 确保文档目录存在
func (ds *DocumentService) ensureDocumentsDir() error {
	config, err := ds.configService.GetConfig()
	if err != nil {
		return err
	}

	var dataPath string
	if config.General.UseCustomDataPath && config.General.CustomDataPath != "" {
		dataPath = config.General.CustomDataPath
	} else {
		dataPath = config.General.DefaultDataPath
	}

	docsDir := filepath.Join(dataPath, "docs")
	return os.MkdirAll(docsDir, 0755)
}

// getDocumentsDir 获取文档目录路径
func (ds *DocumentService) getDocumentsDir() (string, error) {
	config, err := ds.configService.GetConfig()
	if err != nil {
		return "", err
	}

	var dataPath string
	if config.General.UseCustomDataPath && config.General.CustomDataPath != "" {
		dataPath = config.General.CustomDataPath
	} else {
		dataPath = config.General.DefaultDataPath
	}

	return filepath.Join(dataPath, "docs"), nil
}

// getDefaultDocumentPath 获取默认文档路径
func (ds *DocumentService) getDefaultDocumentPath() (string, error) {
	docsDir, err := ds.getDocumentsDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(docsDir, "default.json"), nil
}

// loadDefaultDocument 加载默认文档
func (ds *DocumentService) loadDefaultDocument() error {
	doc := ds.docStore.Get()

	ds.mutex.Lock()
	defer ds.mutex.Unlock()

	if doc.Meta.ID == "" {
		// 创建默认文档
		ds.document = models.NewDefaultDocument()

		// 保存默认文档
		if err := ds.docStore.Set(*ds.document); err != nil {
			return &DocumentError{Operation: "save_default", Err: err}
		}

		ds.logger.Info("Document: Created and saved default document")
	} else {
		ds.document = &doc
		ds.logger.Info("Document: Loaded default document", "id", doc.Meta.ID)
	}

	return nil
}

// GetActiveDocument 获取当前活动文档
func (ds *DocumentService) GetActiveDocument() (*models.Document, error) {
	ds.mutex.RLock()
	defer ds.mutex.RUnlock()

	if ds.document == nil {
		return nil, errors.New("no active document loaded")
	}

	// 返回副本以防止外部修改
	docCopy := *ds.document
	return &docCopy, nil
}

// GetActiveDocumentContent 获取当前活动文档内容
func (ds *DocumentService) GetActiveDocumentContent() (string, error) {
	ds.mutex.RLock()
	defer ds.mutex.RUnlock()

	if ds.document == nil {
		return "", errors.New("no active document loaded")
	}

	return ds.document.Content, nil
}

// UpdateActiveDocumentContent 更新当前活动文档内容
func (ds *DocumentService) UpdateActiveDocumentContent(content string) error {
	ds.mutex.Lock()
	defer ds.mutex.Unlock()

	if ds.document == nil {
		return errors.New("no active document loaded")
	}

	// 更新文档内容并标记为脏
	ds.document.Content = content
	ds.document.Meta.LastUpdated = time.Now()
	ds.isDirty = true

	return nil
}

// SaveDocumentSync 同步保存文档内容
func (ds *DocumentService) SaveDocumentSync(content string) error {
	ds.mutex.Lock()
	defer ds.mutex.Unlock()

	if ds.document == nil {
		return errors.New("no active document loaded")
	}

	// 更新内容
	ds.document.Content = content
	ds.document.Meta.LastUpdated = time.Now()

	// 立即保存
	if err := ds.docStore.Set(*ds.document); err != nil {
		return err
	}

	if err := ds.docStore.Save(); err != nil {
		return err
	}

	// 重置脏标记
	ds.isDirty = false
	ds.logger.Info("Document: Sync save completed")
	return nil
}

// ForceSave 强制保存当前文档
func (ds *DocumentService) ForceSave() error {
	ds.logger.Info("Document: Force save triggered")

	ds.mutex.RLock()
	if ds.document == nil {
		ds.mutex.RUnlock()
		return errors.New("no active document loaded")
	}
	content := ds.document.Content
	ds.mutex.RUnlock()

	return ds.SaveDocumentSync(content)
}

// ServiceShutdown 服务关闭
func (ds *DocumentService) ServiceShutdown() error {
	ds.logger.Info("Document: Service is shutting down...")

	// 确保只执行一次关闭
	var shutdownErr error
	ds.shutdownOnce.Do(func() {
		// 停止定时器
		ds.stopTimer()

		// 执行最后一次保存
		ds.mutex.RLock()
		if ds.document != nil && ds.isDirty {
			content := ds.document.Content
			ds.mutex.RUnlock()

			if err := ds.SaveDocumentSync(content); err != nil {
				ds.logger.Error("Document: Failed to save on shutdown", "error", err)
				shutdownErr = err
			} else {
				ds.logger.Info("Document: Document saved successfully on shutdown")
			}
		} else {
			ds.mutex.RUnlock()
		}

		// 关闭服务
		close(ds.shutdown)
		ds.logger.Info("Document: Service shutdown completed")
	})

	return shutdownErr
}
