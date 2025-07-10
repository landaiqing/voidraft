package services

import (
	"fmt"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// WindowInfo 窗口信息
type WindowInfo struct {
	Window     *application.WebviewWindow
	DocumentID int64
	Title      string
}

// WindowService 窗口管理服务
type WindowService struct {
	logger          *log.Service
	documentService *DocumentService
	app             *application.App
	mainWindow      *application.WebviewWindow
	windows         map[int64]*WindowInfo // documentID -> WindowInfo
	mu              sync.RWMutex
}

// NewWindowService 创建新的窗口服务实例
func NewWindowService(logger *log.Service, documentService *DocumentService) *WindowService {
	if logger == nil {
		logger = log.New()
	}

	return &WindowService{
		logger:          logger,
		documentService: documentService,
		windows:         make(map[int64]*WindowInfo),
	}
}

// SetAppReferences 设置应用和主窗口引用
func (ws *WindowService) SetAppReferences(app *application.App, mainWindow *application.WebviewWindow) {
	ws.app = app
	ws.mainWindow = mainWindow
}

// OpenDocumentWindow 为指定文档ID打开新窗口
func (ws *WindowService) OpenDocumentWindow(documentID int64) error {
	ws.mu.Lock()
	defer ws.mu.Unlock()

	// 检查窗口是否已经存在
	if windowInfo, exists := ws.windows[documentID]; exists {
		// 窗口已存在，显示并聚焦
		windowInfo.Window.Show()
		windowInfo.Window.Restore()
		windowInfo.Window.Focus()
		return nil
	}

	// 获取文档信息
	doc, err := ws.documentService.GetDocumentByID(documentID)
	if err != nil {
		return fmt.Errorf("failed to get document: %w", err)
	}
	if doc == nil {
		return fmt.Errorf("document not found: %d", documentID)
	}

	// 创建新窗口
	newWindow := ws.app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:                      fmt.Sprintf("voidraft - %s", doc.Title),
		Width:                      700,
		Height:                     800,
		Hidden:                     false,
		Frameless:                  true,
		DevToolsEnabled:            false,
		DefaultContextMenuDisabled: false,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		Windows: application.WindowsWindow{
			Theme: application.SystemDefault,
		},
		BackgroundColour: application.NewRGB(27, 38, 54),
		URL:              fmt.Sprintf("/?documentId=%d", documentID),
	})

	newWindow.Center()

	ws.app.Window.Add(newWindow)

	// 保存窗口信息
	windowInfo := &WindowInfo{
		Window:     newWindow,
		DocumentID: documentID,
		Title:      doc.Title,
	}
	ws.windows[documentID] = windowInfo

	// 注册窗口关闭事件
	ws.registerWindowEvents(newWindow, documentID)

	return nil
}

// registerWindowEvents 注册窗口事件
func (ws *WindowService) registerWindowEvents(window *application.WebviewWindow, documentID int64) {
	// 注册窗口关闭事件
	window.RegisterHook(events.Common.WindowClosing, func(event *application.WindowEvent) {
		ws.onWindowClosing(documentID)
	})
}

// onWindowClosing 处理窗口关闭事件
func (ws *WindowService) onWindowClosing(documentID int64) {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	windowInfo, exists := ws.windows[documentID]
	if exists {
		windowInfo.Window.Close()
		delete(ws.windows, documentID)
	}

}

// GetOpenWindows 获取所有打开的窗口信息
func (ws *WindowService) GetOpenWindows() []WindowInfo {
	ws.mu.RLock()
	defer ws.mu.RUnlock()

	var windows []WindowInfo
	for _, windowInfo := range ws.windows {
		windows = append(windows, *windowInfo)
	}
	return windows
}

// IsDocumentWindowOpen 检查指定文档的窗口是否已打开
func (ws *WindowService) IsDocumentWindowOpen(documentID int64) bool {
	ws.mu.RLock()
	defer ws.mu.RUnlock()

	_, exists := ws.windows[documentID]
	return exists
}
