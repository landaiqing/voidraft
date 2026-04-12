package systray

import (
	"embed"
	"runtime"
	"time"
	"voidraft/internal/services"
	"voidraft/internal/version"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	"github.com/wailsapp/wails/v3/pkg/icons"
)

func SetupSystemTrayOnAppStarted(app *application.App, mainWindow *application.WebviewWindow, assets embed.FS, trayService *services.TrayService) {
	app.Event.OnApplicationEvent(events.Common.ApplicationStarted, func(_ *application.ApplicationEvent) {
		SetupSystemTray(mainWindow, assets, trayService)
	})
}

func SetupSystemTray(mainWindow *application.WebviewWindow, assets embed.FS, trayService *services.TrayService) {
	app := application.Get()
	systray := app.SystemTray.New()
	systray.SetTooltip("voidraft\nversion: " + version.Version)
	systray.SetLabel("voidraft")

	iconBytes, err := assets.ReadFile("frontend/dist/appicon.png")
	if err != nil {
		panic(err)
	}

	systray.SetIcon(iconBytes)
	systray.SetDarkModeIcon(iconBytes)

	if runtime.GOOS == "darwin" {
		systray.SetTemplateIcon(icons.SystrayMacTemplate)
	}

	systray.WindowDebounce(300 * time.Millisecond)

	menu := app.NewMenu()
	trayService.BindMenu(menu)
	systray.SetMenu(menu)

	systray.OnClick(func() {
		trayService.AutoShowHide()
	})

	mainWindow.RegisterHook(events.Common.WindowClosing, func(event *application.WindowEvent) {
		event.Cancel()
		trayService.HandleWindowClose()
	})
}
