package services

import (
	"strconv"

	"github.com/wailsapp/wails/v3/pkg/application"
	"voidraft/internal/common/constant"
)

// WindowHelper 窗口辅助工具
type WindowHelper struct{}

// NewWindowHelper 创建窗口辅助工具实例
func NewWindowHelper() *WindowHelper {
	return &WindowHelper{}
}

// GetMainWindow 获取主窗口实例
// 返回窗口对象和是否找到的标志
func (wh *WindowHelper) GetMainWindow() (application.Window, bool) {
	app := application.Get()
	return app.Window.GetByName(constant.VOIDRAFT_MAIN_WINDOW_NAME)
}

// MustGetMainWindow 获取主窗口实例
// 如果窗口不存在则返回 nil
func (wh *WindowHelper) MustGetMainWindow() application.Window {
	window, ok := wh.GetMainWindow()
	if !ok {
		return nil
	}
	return window
}

// ShowMainWindow 显示主窗口
func (wh *WindowHelper) ShowMainWindow() bool {
	if window := wh.MustGetMainWindow(); window != nil {
		window.Show()
		return true
	}
	return false
}

// HideMainWindow 隐藏主窗口
func (wh *WindowHelper) HideMainWindow() bool {
	if window := wh.MustGetMainWindow(); window != nil {
		window.Hide()
		return true
	}
	return false
}

// MinimiseMainWindow 最小化主窗口
func (wh *WindowHelper) MinimiseMainWindow() bool {
	if window := wh.MustGetMainWindow(); window != nil {
		window.Minimise()
		return true
	}
	return false
}

// FocusMainWindow 聚焦主窗口
func (wh *WindowHelper) FocusMainWindow() bool {
	if window := wh.MustGetMainWindow(); window != nil {
		window.Show()
		window.Restore()
		window.Focus()
		return true
	}
	return false
}

// AutoShowMainWindow 自动显示主窗口
func (wh *WindowHelper) AutoShowMainWindow() {
	window := wh.MustGetMainWindow()
	if window.IsVisible() {
		window.Hide()
	} else {
		window.Show()
	}
}

// GetDocumentWindow 根据文档ID获取窗口
func (wh *WindowHelper) GetDocumentWindow(documentID int64) (application.Window, bool) {
	app := application.Get()
	windowName := strconv.FormatInt(documentID, 10)
	return app.Window.GetByName(windowName)
}

// GetAllDocumentWindows 获取所有文档窗口
func (wh *WindowHelper) GetAllDocumentWindows() []application.Window {
	app := application.Get()
	allWindows := app.Window.GetAll()

	var docWindows []application.Window
	for _, window := range allWindows {
		// 跳过主窗口
		if window.Name() != constant.VOIDRAFT_MAIN_WINDOW_NAME {
			docWindows = append(docWindows, window)
		}
	}
	return docWindows
}

// FocusDocumentWindow 聚焦指定文档的窗口
func (wh *WindowHelper) FocusDocumentWindow(documentID int64) bool {
	if window, exists := wh.GetDocumentWindow(documentID); exists {
		window.Show()
		window.Restore()
		window.Focus()
		return true
	}
	return false
}

// CloseDocumentWindow 关闭指定文档的窗口
func (wh *WindowHelper) CloseDocumentWindow(documentID int64) bool {
	if window, exists := wh.GetDocumentWindow(documentID); exists {
		window.Close()
		return true
	}
	return false
}
