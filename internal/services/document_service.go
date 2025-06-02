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

// SaveTrigger 保存触发器类型
type SaveTrigger int

const (
	// SaveTriggerAuto 自动保存
	SaveTriggerAuto SaveTrigger = iota
	// SaveTriggerManual 手动触发保存
	SaveTriggerManual
	// SaveTriggerThreshold 超过阈值触发保存
	SaveTriggerThreshold
	// SaveTriggerShutdown 程序关闭触发保存
	SaveTriggerShutdown
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
	configService  *ConfigService
	logger         *log.LoggerService
	activeDoc      *models.Document
	docStore       *Store[models.Document]
	memoryCache    *models.Document // 内存缓存，小改动只更新此缓存
	lock           sync.RWMutex
	lastSaveTime   time.Time
	changeCounter  int                       // 变更计数器，记录自上次保存后的变更数量
	saveTimer      *time.Timer               // 自动保存定时器
	pendingSave    bool                      // 是否有等待保存的更改
	saveChannel    chan SaveTrigger          // 保存通道，用于接收保存触发信号
	shutdownChan   chan struct{}             // 关闭通道，用于程序退出时通知保存协程
	shutdownWg     sync.WaitGroup            // 等待组，用于确保保存协程正常退出
	onSaveCallback func(trigger SaveTrigger) // 保存回调函数
}

// NewDocumentService 创建新的文档服务实例
func NewDocumentService(configService *ConfigService, logger *log.LoggerService) *DocumentService {
	if logger == nil {
		logger = log.New()
	}

	service := &DocumentService{
		configService: configService,
		logger:        logger,
		saveChannel:   make(chan SaveTrigger, 10),
		shutdownChan:  make(chan struct{}),
		lastSaveTime:  time.Now(),
	}

	return service
}

// Initialize 初始化文档服务
func (ds *DocumentService) Initialize() error {
	// 确保文档目录存在
	err := ds.ensureDocumentsDir()
	if err != nil {
		ds.logger.Error("Document: Failed to ensure documents directory", "error", err)
		return &DocumentError{Operation: "initialize", Err: err}
	}

	// 初始化文档存储
	err = ds.initDocumentStore()
	if err != nil {
		ds.logger.Error("Document: Failed to initialize document store", "error", err)
		return &DocumentError{Operation: "init_store", Err: err}
	}

	// 加载默认文档
	err = ds.LoadDefaultDocument()
	if err != nil {
		ds.logger.Error("Document: Failed to load default document", "error", err)
		return &DocumentError{Operation: "load_default", Err: err}
	}

	// 启动保存处理协程
	ds.startSaveProcessor()

	return nil
}

// startSaveProcessor 启动保存处理协程
func (ds *DocumentService) startSaveProcessor() {
	ds.shutdownWg.Add(1)
	go func() {
		defer ds.shutdownWg.Done()

		for {
			select {
			case trigger := <-ds.saveChannel:
				// 接收到保存信号，执行保存
				ds.saveToStore(trigger)
			case <-ds.shutdownChan:
				// 接收到关闭信号，保存并退出
				if ds.pendingSave {
					ds.saveToStore(SaveTriggerShutdown)
				}
				return
			}
		}
	}()
}

// scheduleAutoSave 安排自动保存
func (ds *DocumentService) scheduleAutoSave() {
	// 获取配置
	config, err := ds.configService.GetConfig()
	if err != nil {
		ds.logger.Error("Document: Failed to get config for auto save", "error", err)
		// 使用默认值2秒
		ds.scheduleTimerWithDelay(2000)
		return
	}

	// 检查配置有效性
	if config == nil {
		ds.logger.Error("Document: Config is nil, using default delay")
		ds.scheduleTimerWithDelay(2000)
		return
	}

	// 打印保存设置，便于调试
	ds.logger.Debug("Document: Auto save settings",
		"autoSaveDelay", config.Editing.AutoSaveDelay,
		"changeThreshold", config.Editing.ChangeThreshold,
		"minSaveInterval", config.Editing.MinSaveInterval)

	ds.lock.Lock()
	defer ds.lock.Unlock()

	// 重置自动保存定时器
	if ds.saveTimer != nil {
		ds.saveTimer.Stop()
	}

	// 创建新的自动保存定时器
	autoSaveDelay := config.Editing.AutoSaveDelay
	ds.logger.Debug("Document: Scheduling auto save", "delay", autoSaveDelay)
	ds.scheduleTimerWithDelay(autoSaveDelay)
}

// scheduleTimerWithDelay 使用指定延迟创建定时器
func (ds *DocumentService) scheduleTimerWithDelay(delayMs int) {
	ds.saveTimer = time.AfterFunc(time.Duration(delayMs)*time.Millisecond, func() {
		// 只有在有待保存的更改时才触发保存
		if ds.pendingSave {
			ds.saveChannel <- SaveTriggerAuto
		}
	})
}

// saveToStore 保存文档到存储
func (ds *DocumentService) saveToStore(trigger SaveTrigger) {
	ds.lock.Lock()
	defer ds.lock.Unlock()

	// 如果没有内存缓存或活动文档，直接返回
	if ds.memoryCache == nil || ds.activeDoc == nil {
		return
	}

	// 获取配置
	config, err := ds.configService.GetConfig()
	if err != nil {
		ds.logger.Error("Document: Failed to get config for save", "error", err)
		// 继续使用默认值
	}

	// 设置默认值
	minInterval := 500 // 默认500毫秒

	// 如果成功获取了配置，使用配置值
	if err == nil && config != nil {
		minInterval = config.Editing.MinSaveInterval
	}

	// 如果是自动保存，检查最小保存间隔
	if trigger == SaveTriggerAuto {
		now := time.Now()
		elapsed := now.Sub(ds.lastSaveTime).Milliseconds()

		// 如果距离上次保存时间太短，重新安排保存
		if elapsed < int64(minInterval) {
			// 重新安排保存，延迟 = 最小间隔 - 已经过的时间
			delayMs := minInterval - int(elapsed)
			ds.logger.Debug("Document: Rescheduling save due to min interval",
				"minInterval", minInterval,
				"elapsed", elapsed,
				"delayMs", delayMs)

			ds.lock.Unlock() // 解锁后再启动定时器，避免死锁
			ds.scheduleTimerWithDelay(delayMs)
			ds.lock.Lock() // 恢复锁
			return
		}
	}

	// 更新活动文档
	ds.activeDoc = ds.memoryCache
	ds.activeDoc.Meta.LastUpdated = time.Now()

	// 保存到存储
	ds.logger.Info("Document: Saving document to disk",
		"trigger", trigger,
		"id", ds.activeDoc.Meta.ID,
		"contentLength", len(ds.activeDoc.Content))

	err = ds.docStore.Set(*ds.activeDoc)
	if err != nil {
		ds.logger.Error("Document: Failed to save document", "trigger", trigger, "error", err)
		return
	}

	// 强制确保保存到磁盘
	err = ds.docStore.Save()
	if err != nil {
		ds.logger.Error("Document: Failed to force save document", "trigger", trigger, "error", err)
		return
	}

	// 重置计数器和状态
	ds.changeCounter = 0
	ds.pendingSave = false
	ds.lastSaveTime = time.Now()

	// 触发回调
	if ds.onSaveCallback != nil {
		ds.onSaveCallback(trigger)
	}

	ds.logger.Info("Document: Saved document", "trigger", trigger, "id", ds.activeDoc.Meta.ID)
}

// Shutdown 关闭文档服务，确保所有数据保存
func (ds *DocumentService) Shutdown() {
	// 发送关闭信号
	close(ds.shutdownChan)

	// 等待保存协程退出
	ds.shutdownWg.Wait()

	// 停止定时器
	if ds.saveTimer != nil {
		ds.saveTimer.Stop()
	}

	ds.logger.Info("Document: Service shutdown completed")
}

// SetSaveCallback 设置保存回调函数
func (ds *DocumentService) SetSaveCallback(callback func(trigger SaveTrigger)) {
	ds.onSaveCallback = callback
}

// initDocumentStore 初始化文档存储
func (ds *DocumentService) initDocumentStore() error {
	docPath, err := ds.getDefaultDocumentPath()
	if err != nil {
		return err
	}

	ds.logger.Info("Document: Initializing document store", "path", docPath)

	// 创建文档存储，强制保存和Service触发的保存都使用同步保存到磁盘
	ds.docStore = NewStore[models.Document](StoreOption{
		FilePath: docPath,
		AutoSave: true, // 启用自动保存，确保Set操作直接写入磁盘
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

	// 创建文档目录
	docsDir := filepath.Join(config.General.DataPath, "docs")
	err = os.MkdirAll(docsDir, 0755)
	if err != nil {
		return err
	}

	return nil
}

// getDocumentsDir 获取文档目录路径
func (ds *DocumentService) getDocumentsDir() (string, error) {
	config, err := ds.configService.GetConfig()
	if err != nil {
		return "", err
	}
	return filepath.Join(config.General.DataPath, "docs"), nil
}

// getDefaultDocumentPath 获取默认文档路径
func (ds *DocumentService) getDefaultDocumentPath() (string, error) {
	docsDir, err := ds.getDocumentsDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(docsDir, "default.json"), nil
}

// LoadDefaultDocument 加载默认文档
func (ds *DocumentService) LoadDefaultDocument() error {
	// 从Store加载文档
	doc := ds.docStore.Get()

	// 检查文档是否有效
	if doc.Meta.ID == "" {
		// 创建默认文档
		defaultDoc := models.NewDefaultDocument()
		ds.lock.Lock()
		ds.activeDoc = defaultDoc
		ds.memoryCache = defaultDoc // 同时更新内存缓存
		ds.lock.Unlock()

		// 保存默认文档
		err := ds.docStore.Set(*defaultDoc)
		if err != nil {
			return &DocumentError{Operation: "save_default", Err: err}
		}

		ds.logger.Info("Document: Created and saved default document")
		return nil
	}

	// 设置为活动文档
	ds.lock.Lock()
	ds.activeDoc = &doc
	ds.memoryCache = &doc // 同时更新内存缓存
	ds.lock.Unlock()

	ds.logger.Info("Document: Loaded default document", "id", doc.Meta.ID)
	return nil
}

// GetActiveDocument 获取当前活动文档
func (ds *DocumentService) GetActiveDocument() (*models.Document, error) {
	ds.lock.RLock()
	defer ds.lock.RUnlock()

	if ds.memoryCache == nil {
		return nil, errors.New("no active document loaded")
	}

	// 返回内存缓存中的文档，确保获得最新版本
	return ds.memoryCache, nil
}

// GetActiveDocumentContent 获取当前活动文档内容
func (ds *DocumentService) GetActiveDocumentContent() (string, error) {
	ds.lock.RLock()
	defer ds.lock.RUnlock()

	if ds.memoryCache == nil {
		return "", errors.New("no active document loaded")
	}

	return ds.memoryCache.Content, nil
}

// UpdateActiveDocumentContent 更新当前活动文档内容
func (ds *DocumentService) UpdateActiveDocumentContent(content string) error {
	// 获取配置
	config, err := ds.configService.GetConfig()
	if err != nil {
		ds.logger.Error("Document: Failed to get config for content update", "error", err)
		// 出错时仍继续，使用默认行为
	}

	// 设置默认配置值
	threshold := 100 // 默认值

	// 如果成功获取了配置，使用配置值
	if err == nil && config != nil {
		threshold = config.Editing.ChangeThreshold
	}

	ds.lock.Lock()

	if ds.memoryCache == nil {
		ds.lock.Unlock()
		return errors.New("no active document loaded")
	}

	// 计算变更数量
	oldContent := ds.memoryCache.Content
	changedChars := calculateChanges(oldContent, content)
	ds.changeCounter += changedChars

	// 调试信息
	ds.logger.Debug("Document: Content updated",
		"changedChars", changedChars,
		"totalChanges", ds.changeCounter,
		"threshold", threshold)

	// 更新内存缓存
	ds.memoryCache.Content = content
	ds.memoryCache.Meta.LastUpdated = time.Now()
	ds.pendingSave = true

	// 如果变更超过阈值，触发保存
	if ds.changeCounter >= threshold {
		ds.logger.Info("Document: Change threshold reached, triggering save",
			"threshold", threshold,
			"changes", ds.changeCounter)

		// 提前解锁，避免死锁
		ds.lock.Unlock()
		ds.saveChannel <- SaveTriggerThreshold
	} else {
		// 否则安排自动保存
		ds.lock.Unlock()
		ds.scheduleAutoSave()
	}

	return nil
}

// SaveDocumentSync 同步保存文档内容 (用于页面关闭前同步保存)
func (ds *DocumentService) SaveDocumentSync(content string) error {
	ds.lock.Lock()

	if ds.memoryCache == nil {
		ds.lock.Unlock()
		return errors.New("no active document loaded")
	}

	// 更新内存缓存
	ds.memoryCache.Content = content
	ds.memoryCache.Meta.LastUpdated = time.Now()

	// 直接保存到存储
	doc := *ds.memoryCache
	ds.lock.Unlock()

	err := ds.docStore.Set(doc)
	if err != nil {
		return err
	}

	// 重置状态
	ds.lock.Lock()
	ds.pendingSave = false
	ds.changeCounter = 0
	ds.lastSaveTime = time.Now()
	ds.lock.Unlock()

	ds.logger.Info("Document: Synced document save completed")
	return nil
}

// ForceSave 强制保存当前文档
func (ds *DocumentService) ForceSave() error {
	ds.logger.Info("Document: Force save triggered")

	// 获取当前文档内容
	ds.lock.RLock()
	if ds.memoryCache == nil {
		ds.lock.RUnlock()
		return errors.New("no active document loaded")
	}
	content := ds.memoryCache.Content
	ds.lock.RUnlock()

	// 使用同步方法直接保存到磁盘
	if err := ds.SaveDocumentSync(content); err != nil {
		ds.logger.Error("Document: Force save failed", "error", err)
		return err
	}

	ds.logger.Info("Document: Force save completed successfully")
	return nil
}

// calculateChanges 计算两个字符串之间的变更数量
func calculateChanges(old, new string) int {
	// 使用详细的差分算法计算变更
	result := calculateChangesDetailed(old, new)

	// 返回总变更字符数
	return result.TotalChanges
}

// GetDiffInfo 获取两个文本之间的详细差异信息
func (ds *DocumentService) GetDiffInfo(oldText, newText string) DiffResult {
	return calculateChangesDetailed(oldText, newText)
}

// GetSaveSettings 获取文档保存设置
func (ds *DocumentService) GetSaveSettings() (*models.EditingConfig, error) {
	config, err := ds.configService.GetConfig()
	if err != nil {
		return nil, &DocumentError{Operation: "get_save_settings", Err: err}
	}
	return &config.Editing, nil
}

// UpdateSaveSettings 更新文档保存设置
func (ds *DocumentService) UpdateSaveSettings(docConfig models.EditingConfig) error {
	// 使用配置服务的 Set 方法更新文档配置
	if err := ds.configService.Set("editing.auto_save_delay", docConfig.AutoSaveDelay); err != nil {
		return &DocumentError{Operation: "update_save_settings_auto_save_delay", Err: err}
	}

	if err := ds.configService.Set("editing.change_threshold", docConfig.ChangeThreshold); err != nil {
		return &DocumentError{Operation: "update_save_settings_change_threshold", Err: err}
	}

	if err := ds.configService.Set("editing.min_save_interval", docConfig.MinSaveInterval); err != nil {
		return &DocumentError{Operation: "update_save_settings_min_save_interval", Err: err}
	}

	// 安排自动保存
	ds.scheduleAutoSave()

	ds.logger.Info("Document: Updated save settings")
	return nil
}

// ServiceShutdown 实现应用程序关闭时的服务关闭逻辑
func (ds *DocumentService) ServiceShutdown() error {
	ds.logger.Info("Document: Service is shutting down, saving document...")

	// 获取当前活动文档
	ds.lock.RLock()
	if ds.memoryCache == nil {
		ds.lock.RUnlock()
		ds.logger.Info("Document: No active document to save on shutdown")
		return nil
	}

	// 获取要保存的内容
	content := ds.memoryCache.Content
	ds.lock.RUnlock()

	// 同步保存文档内容
	err := ds.SaveDocumentSync(content)
	if err != nil {
		ds.logger.Error("Document: Failed to save document on shutdown", "error", err)
		return err
	}

	ds.logger.Info("Document: Document saved successfully on shutdown")

	// 关闭通道以通知保存协程退出
	close(ds.shutdownChan)

	// 等待保存协程退出
	ds.shutdownWg.Wait()

	// 停止所有计时器
	if ds.saveTimer != nil {
		ds.saveTimer.Stop()
	}

	return nil
}
