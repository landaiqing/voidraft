package events

import (
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	wailsevents "github.com/wailsapp/wails/v3/pkg/events"
)

// RegisterTrayEvents 注册与系统托盘相关的所有事件
func RegisterTrayEvents(app *application.App, systray *application.SystemTray, mainWindow *application.WebviewWindow, settingsWindow *application.WebviewWindow) {
	// 不附加窗口到系统托盘，避免失去焦点自动缩小
	// systray.AttachWindow(mainWindow)

	// 设置窗口防抖时间
	systray.WindowDebounce(200 * time.Millisecond)

	// 设置点击托盘图标显示主窗口
	systray.OnClick(func() {
		mainWindow.Show()
	})

	// 使用关闭前的事件处理
	mainWindow.RegisterHook(wailsevents.Common.WindowClosing, func(event *application.WindowEvent) {
		// 取消默认关闭行为
		event.Cancel()
		// 隐藏窗口
		mainWindow.Hide()
	})

	// 设置窗口关闭事件处理
	settingsWindow.RegisterHook(wailsevents.Common.WindowClosing, func(event *application.WindowEvent) {
		// 取消默认关闭行为
		event.Cancel()
		// 隐藏窗口
		settingsWindow.Hide()
	})

	// 注册事件监听器，用于处理前端发送的显示设置窗口事件
	app.OnEvent("show_settings_window", func(event *application.CustomEvent) {
		settingsWindow.Show()
	})
}

// RegisterTrayMenuEvents 注册系统托盘菜单事件
func RegisterTrayMenuEvents(app *application.App, menu *application.Menu, mainWindow *application.WebviewWindow, settingsWindow *application.WebviewWindow) {
	menu.Add("主窗口").OnClick(func(data *application.Context) {
		mainWindow.Show()
	})

	menu.Add("设置").OnClick(func(data *application.Context) {
		settingsWindow.Show()
	})

	menu.AddSeparator()

	menu.Add("退出").OnClick(func(data *application.Context) {
		app.Quit()
	})
}
