package systray

import (
	"embed"
	"github.com/wailsapp/wails/v3/pkg/application"
	"voidraft/internal/events"
)

// SetupSystemTray 设置系统托盘及其功能
func SetupSystemTray(app *application.App, mainWindow *application.WebviewWindow, assets embed.FS) {
	// 创建系统托盘
	systray := app.NewSystemTray()

	// 设置图标
	iconBytes, _ := assets.ReadFile("appicon.png")
	systray.SetIcon(iconBytes)

	// 设置标签
	systray.SetLabel("VoidRaft")

	// 创建托盘菜单
	menu := app.NewMenu()

	// 注册托盘菜单事件
	events.RegisterTrayMenuEvents(app, menu, mainWindow)

	systray.SetMenu(menu)

	// 注册托盘相关事件
	events.RegisterTrayEvents(app, systray, mainWindow)
}
