package main

import (
	"embed"
	_ "embed"
	"log/slog"
	"time"
	"voidraft/internal/common/constant"
	"voidraft/internal/services"
	"voidraft/internal/systray"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// Wails uses Go's `embed` package to embed the frontend files into the binary.
// Any files in the frontend/dist folder will be embedded into the binary and
// made available to the frontend.
// See https://pkg.go.dev/embed for more information.

//go:embed all:frontend/dist
var assets embed.FS

// main function serves as the application's entry point. It initializes the application, creates a window,
// and starts a goroutine that emits a time-based event every second. It subsequently runs the application and
// logs any error that might occur.
func main() {
	serviceManager := services.NewServiceManager()
	var window *application.WebviewWindow

	var encryptionKey = [32]byte{
		0x1e, 0x1f, 0x1c, 0x1d, 0x1a, 0x1b, 0x18, 0x19,
		0x16, 0x17, 0x14, 0x15, 0x12, 0x13, 0x10, 0x11,
		0x0e, 0x0f, 0x0c, 0x0d, 0x0a, 0x0b, 0x08, 0x09,
		0x06, 0x07, 0x04, 0x05, 0x02, 0x03, 0x00, 0x01,
	}
	// Create a new Wails application by providing the necessary options.
	// Variables 'Name' and 'Description' are for application metadata.
	// 'Assets' configures the asset server with the 'FS' variable pointing to the frontend files.
	// 'Bind' is a list of Go struct instances. The frontend has access to the methods of these instances.
	// 'Mac' options tailor the application when running an macOS.
	app := application.New(application.Options{
		Name:        constant.VOIDRAFT_APP_NAME,
		Description: constant.VOIDRAFT_APP_DESCRIPTION,
		Services:    serviceManager.GetServices(),
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		LogLevel: slog.LevelDebug,
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID:      constant.VOIDRAFT_APP_NAME,
			EncryptionKey: encryptionKey,
			OnSecondInstanceLaunch: func(data application.SecondInstanceData) {
				if window != nil {
					window.Show()
					window.Restore()
					window.Focus()
				}
			},
			AdditionalData: map[string]string{
				"launchtime": time.Now().Local().String(),
			},
		},
	})
	// Create a new window with the necessary options.
	// 'Title' is the title of the window.
	// 'Mac' options tailor the window when running on macOS.
	// 'BackgroundColour' is the background colour of the window.
	// 'URL' is the URL that will be loaded into the webview.
	mainWindow := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:                       constant.VOIDRAFT_MAIN_WINDOW_NAME,
		Title:                      constant.VOIDRAFT_APP_NAME,
		Width:                      constant.VOIDRAFT_WINDOW_WIDTH,
		Height:                     constant.VOIDRAFT_WINDOW_HEIGHT,
		Hidden:                     false,
		Frameless:                  true,
		DevToolsEnabled:            false,
		DefaultContextMenuDisabled: false,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		Windows: application.WindowsWindow{
			Theme: application.SystemDefault,
		},
		BackgroundColour: application.NewRGB(27, 38, 54),
		URL:              "/",
	})
	mainWindow.Center()
	window = mainWindow
	trayService := serviceManager.GetTrayService()
	// 设置系统托盘
	systray.SetupSystemTray(mainWindow, assets, trayService)

	// Run the application. This blocks until the application has been exited.
	err := app.Run()

	// If an error occurred while running the application, log it and exit.
	if err != nil {
		panic(err)
	}
}
