package events

import (
	"time"
	"voidraft/internal/services"

	"github.com/wailsapp/wails/v3/pkg/application"
	wailsevents "github.com/wailsapp/wails/v3/pkg/events"
)

// RegisterTrayEvents 注册与系统托盘相关的所有事件
func RegisterTrayEvents(systray *application.SystemTray, mainWindow *application.WebviewWindow, trayService *services.TrayService) {
	// 不附加窗口到系统托盘，避免失去焦点自动缩小
	// systray.AttachWindow(mainWindow)

	// 设置窗口防抖时间
	systray.WindowDebounce(200 * time.Millisecond)

	// 设置点击托盘图标显示主窗口
	systray.OnClick(func() {
		trayService.AutoShowHide()
	})

	// 处理窗口关闭事件 - 根据配置决定是隐藏到托盘还是直接退出
	mainWindow.RegisterHook(wailsevents.Common.WindowClosing, func(event *application.WindowEvent) {
		// 取消默认关闭行为
		event.Cancel()
		// 使用托盘服务处理关闭事件
		trayService.HandleWindowClose()
	})

}

// RegisterTrayMenuEvents 注册系统托盘菜单事件
func RegisterTrayMenuEvents(app *application.App, menu *application.Menu, mainWindow *application.WebviewWindow) {
	menu.Add("Main window").OnClick(func(data *application.Context) {
		mainWindow.Show()
	})

	menu.AddSeparator()

	menu.Add("Quit").OnClick(func(data *application.Context) {
		app.Quit()
	})
}
