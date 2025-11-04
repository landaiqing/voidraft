package systray

import (
	"embed"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/icons"
	"runtime"
	"time"
	"voidraft/internal/events"
	"voidraft/internal/services"
	"voidraft/internal/version"
)

// SetupSystemTray 设置系统托盘及其功能
func SetupSystemTray(mainWindow *application.WebviewWindow, assets embed.FS, trayService *services.TrayService) {
	app := application.Get()
	// 创建系统托盘
	systray := app.SystemTray.New()
	// 设置提示
	systray.SetTooltip("voidraft\nversion: " + version.Version)
	// 设置标签
	systray.SetLabel("voidraft")
	// 设置图标
	iconBytes, err := assets.ReadFile("frontend/dist/appicon.png")
	if err != nil {
		panic(err)
	}
	systray.SetIcon(iconBytes)
	systray.SetDarkModeIcon(iconBytes)

	// Use the template icon on macOS so the clock respects light/dark modes.
	if runtime.GOOS == "darwin" {
		systray.SetTemplateIcon(icons.SystrayMacTemplate)
	}

	systray.WindowDebounce(300 * time.Millisecond)

	// 创建托盘菜单
	menu := app.NewMenu()

	// 注册托盘菜单事件
	events.RegisterTrayMenuEvents(app, menu, mainWindow)

	systray.SetMenu(menu)

	// 注册托盘相关事件
	events.RegisterTrayEvents(systray, mainWindow, trayService)
}
