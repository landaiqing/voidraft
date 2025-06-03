package events

import (
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	wailsevents "github.com/wailsapp/wails/v3/pkg/events"
)

// RegisterTrayEvents 注册与系统托盘相关的所有事件
func RegisterTrayEvents(app *application.App, systray *application.SystemTray, mainWindow *application.WebviewWindow) {
	// 不附加窗口到系统托盘，避免失去焦点自动缩小
	// systray.AttachWindow(mainWindow)

	// 设置窗口防抖时间
	systray.WindowDebounce(200 * time.Millisecond)

	// 设置点击托盘图标显示主窗口
	systray.OnClick(func() {
		mainWindow.Show()
		mainWindow.Restore()
		mainWindow.Focus()
		// 通知前端窗口已显示
		app.EmitEvent("window:shown", nil)
	})

	// 处理窗口关闭事件 - 隐藏到托盘
	mainWindow.RegisterHook(wailsevents.Common.WindowClosing, func(event *application.WindowEvent) {
		// 取消默认关闭行为
		event.Cancel()
		// 隐藏窗口到托盘
		mainWindow.Hide()
		// 通知前端窗口已隐藏
		app.EmitEvent("window:hidden", nil)
	})

	// 处理窗口最小化事件 - 也隐藏到托盘
	mainWindow.RegisterHook(wailsevents.Common.WindowMinimise, func(event *application.WindowEvent) {
		// 取消默认最小化行为
		event.Cancel()
		// 隐藏窗口到托盘
		mainWindow.Hide()
		// 通知前端窗口已隐藏
		app.EmitEvent("window:hidden", nil)
	})
}

// RegisterTrayMenuEvents 注册系统托盘菜单事件
func RegisterTrayMenuEvents(app *application.App, menu *application.Menu, mainWindow *application.WebviewWindow) {
	menu.Add("主窗口").OnClick(func(data *application.Context) {
		mainWindow.Show()
	})

	menu.AddSeparator()

	menu.Add("退出").OnClick(func(data *application.Context) {
		app.Quit()
	})
}
