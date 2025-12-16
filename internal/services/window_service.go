package services

import (
	"context"
	"fmt"
	"strconv"
	"voidraft/internal/common/constant"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// WindowService 窗口管理服务
type WindowService struct {
	logger          *log.LogService
	documentService *DocumentService
	// 吸附服务引用
	windowSnapService *WindowSnapService
}

// NewWindowService 创建新的窗口服务实例
func NewWindowService(logger *log.LogService, documentService *DocumentService, windowSnapService *WindowSnapService) *WindowService {
	if logger == nil {
		logger = log.New()
	}

	return &WindowService{
		logger:            logger,
		documentService:   documentService,
		windowSnapService: windowSnapService,
	}
}

// ServiceStartup 服务启动时初始化
func (ws *WindowService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	ws.windowSnapService.UpdateMainWindowCache()
	return nil
}

// OpenDocumentWindow 为指定文档ID打开新窗口
func (ws *WindowService) OpenDocumentWindow(documentID int64) error {
	app := application.Get()
	windowName := strconv.FormatInt(documentID, 10)

	if existingWindow, exists := app.Window.GetByName(windowName); exists {
		// 窗口已存在，显示并聚焦
		existingWindow.Show()
		existingWindow.Restore()
		existingWindow.Focus()
		return nil
	}

	// 获取文档信息
	doc, err := ws.documentService.GetDocumentByID(context.Background(), int(documentID))
	if err != nil {
		return fmt.Errorf("failed to get document: %w", err)
	}
	if doc == nil {
		return fmt.Errorf("document not found: %d", documentID)
	}

	// 创建新窗口
	newWindow := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:                       windowName,
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

	// 注册窗口事件
	ws.registerWindowEvents(newWindow, documentID)

	// 向吸附服务注册新窗口
	if ws.windowSnapService != nil {
		ws.windowSnapService.RegisterWindow(documentID, newWindow)
	}

	// 最后才移动窗口到中心
	newWindow.Center()

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
	// 从吸附服务中取消注册
	if ws.windowSnapService != nil {
		ws.windowSnapService.UnregisterWindow(documentID)
	}
}

// GetOpenWindows 获取所有打开的文档窗口
func (ws *WindowService) getOpenWindows() []application.Window {
	app := application.Get()
	return app.Window.GetAll()
}

// IsDocumentWindowOpen 检查指定文档的窗口是否已打开
func (ws *WindowService) IsDocumentWindowOpen(documentID int64) bool {
	app := application.Get()
	windowName := strconv.FormatInt(documentID, 10)
	_, exists := app.Window.GetByName(windowName)
	return exists
}

// ServiceShutdown 实现服务关闭接口
func (ws *WindowService) ServiceShutdown() error {
	// 从吸附服务中取消注册所有窗口
	if ws.windowSnapService != nil {
		windows := ws.getOpenWindows()
		for _, window := range windows {
			if documentID, err := strconv.ParseInt(window.Name(), 10, 64); err == nil {
				ws.windowSnapService.UnregisterWindow(documentID)
			}
		}
	}
	return nil
}
