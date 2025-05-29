package main

import (
	"embed"
	_ "embed"
	"log"
	"time"
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

	var encryptionKey = [32]byte{
		0x1e, 0x1f, 0x1c, 0x1d, 0x1a, 0x1b, 0x18, 0x19,
		0x16, 0x17, 0x14, 0x15, 0x12, 0x13, 0x10, 0x11,
		0x0e, 0x0f, 0x0c, 0x0d, 0x0a, 0x0b, 0x08, 0x09,
		0x06, 0x07, 0x04, 0x05, 0x02, 0x03, 0x00, 0x01,
	}
	var window *application.WebviewWindow
	// Create a new Wails application by providing the necessary options.
	// Variables 'Name' and 'Description' are for application metadata.
	// 'Assets' configures the asset server with the 'FS' variable pointing to the frontend files.
	// 'Bind' is a list of Go struct instances. The frontend has access to the methods of these instances.
	// 'Mac' options tailor the application when running an macOS.
	app := application.New(application.Options{
		Name:        "voidraft",
		Description: "voidraft",
		Services:    serviceManager.GetServices(),
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID:      "com.voidraft",
			EncryptionKey: encryptionKey,
			OnSecondInstanceLaunch: func(data application.SecondInstanceData) {
				if window != nil {
					window.EmitEvent("secondInstanceLaunched", data)
					window.Restore()
					window.Focus()
				}
				log.Printf("Second instance launched with args: %v\n", data.Args)
				log.Printf("Working directory: %s\n", data.WorkingDir)
				if data.AdditionalData != nil {
					log.Printf("Additional data: %v\n", data.AdditionalData)
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
	log.Println("Creating main window...")
	mainWindow := app.NewWebviewWindowWithOptions(application.WebviewWindowOptions{
		Title:  "voidraft",
		Width:  700,
		Height: 800,
		Hidden: false,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		BackgroundColour: application.NewRGB(27, 38, 54),
		URL:              "/#/",
	})
	mainWindow.Center()
	settingsWindow := app.NewWebviewWindowWithOptions(application.WebviewWindowOptions{
		Title:               "voidraft设置",
		Width:               700,
		Height:              800,
		Hidden:              true,
		AlwaysOnTop:         true,
		DisableResize:       true,
		MinimiseButtonState: application.ButtonHidden,
		MaximiseButtonState: application.ButtonHidden,
		Mac: application.MacWindow{
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
			InvisibleTitleBarHeight: 50,
		},
		Windows:          application.WindowsWindow{},
		BackgroundColour: application.NewRGB(27, 38, 54),
		URL:              "/#/settings",
	})
	settingsWindow.Center()

	// 设置系统托盘
	systray.SetupSystemTray(app, mainWindow, settingsWindow, assets)

	// Create a goroutine that emits an event containing the current time every second.
	// The frontend can listen to this event and update the UI accordingly.
	go func() {
		for {
			now := time.Now().Format(time.RFC1123)
			app.EmitEvent("time", now)
			time.Sleep(time.Second)
		}
	}()

	// Run the application. This blocks until the application has been exited.
	err := app.Run()

	// If an error occurred while running the application, log it and exit.
	if err != nil {
		log.Fatal(err)
	}
}
