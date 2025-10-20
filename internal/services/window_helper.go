package services

import (
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
