package services

import (
	"fmt"
	"strconv"
	"sync"
	"voidraft/internal/common/constant"

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

// WindowService 窗口管理服务（专注于窗口生命周期管理）
type WindowService struct {
	logger          *log.LogService
	documentService *DocumentService
	windows         map[int64]*WindowInfo // documentID -> WindowInfo
	mu              sync.RWMutex

	// 吸附服务引用
	windowSnapService *WindowSnapService
}

// NewWindowService 创建新的窗口服务实例
func NewWindowService(logger *log.LogService, documentService *DocumentService) *WindowService {
	if logger == nil {
		logger = log.New()
	}

	return &WindowService{
		logger:          logger,
		documentService: documentService,
		windows:         make(map[int64]*WindowInfo),
	}
}

// SetWindowSnapService 设置窗口吸附服务引用
func (ws *WindowService) SetWindowSnapService(snapService *WindowSnapService) {
	ws.windowSnapService = snapService
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

	app := application.Get()
	// 创建新窗口
	newWindow := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:                       strconv.FormatInt(doc.ID, 10),
		Title:                      fmt.Sprintf("voidraft - %s", doc.Title),
		Width:                      constant.VOIDRAFT_WINDOW_WIDTH,
		Height:                     constant.VOIDRAFT_WINDOW_HEIGHT,
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

	app.Window.Add(newWindow)

	// 保存窗口信息
	windowInfo := &WindowInfo{
		Window:     newWindow,
		DocumentID: documentID,
		Title:      doc.Title,
	}
	ws.windows[documentID] = windowInfo

	// 注册窗口事件
	ws.registerWindowEvents(newWindow, documentID)

	// 向吸附服务注册新窗口
	if ws.windowSnapService != nil {
		ws.windowSnapService.RegisterWindow(documentID, newWindow, doc.Title)
	}

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

		// 从吸附服务中取消注册
		if ws.windowSnapService != nil {
			ws.windowSnapService.UnregisterWindow(documentID)
		}
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

// ServiceShutdown 实现服务关闭接口
func (ws *WindowService) ServiceShutdown() error {
	// 关闭所有窗口
	ws.mu.Lock()
	defer ws.mu.Unlock()

	for documentID := range ws.windows {
		if ws.windowSnapService != nil {
			ws.windowSnapService.UnregisterWindow(documentID)
		}
	}

	return nil
}
