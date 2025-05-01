package systray

import (
	"embed"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
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
	menu.Add("显示主窗口").OnClick(func(data *application.Context) {
		mainWindow.Show()
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

	// 将窗口附加到系统托盘
	systray.AttachWindow(mainWindow)

	// 设置窗口防抖时间
	systray.WindowDebounce(200 * time.Millisecond)
}
