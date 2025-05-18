package systray

import (
	"embed"
	"github.com/wailsapp/wails/v3/pkg/events"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// SetupSystemTray 设置系统托盘及其功能
func SetupSystemTray(app *application.App, mainWindow *application.WebviewWindow, settingsWindow *application.WebviewWindow, assets embed.FS) {
	// 创建系统托盘
	systray := app.NewSystemTray()

	// 设置图标
	iconBytes, _ := assets.ReadFile("appicon.png")
	systray.SetIcon(iconBytes)

	// 设置标签
	systray.SetLabel("VoidRaft")

	// 创建托盘菜单
	menu := app.NewMenu()
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

	systray.SetMenu(menu)

	// 设置点击托盘图标显示主窗口
	systray.OnClick(func() {
		mainWindow.Show()
	})

	// 不再附加窗口到系统托盘，避免失去焦点自动缩小
	// systray.AttachWindow(mainWindow)

	// 设置窗口防抖时间
	systray.WindowDebounce(200 * time.Millisecond)

	// 使用关闭前的事件处理
	mainWindow.RegisterHook(events.Common.WindowClosing, func(event *application.WindowEvent) {
		// 取消默认关闭行为
		event.Cancel()
		// 隐藏窗口
		mainWindow.Hide()
	})

	// 设置窗口关闭事件处理
	settingsWindow.RegisterHook(events.Common.WindowClosing, func(event *application.WindowEvent) {
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
