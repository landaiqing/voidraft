package services

import (
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// TrayService 系统托盘服务
type TrayService struct {
	logger        *log.LoggerService
	configService *ConfigService
	app           *application.App
	mainWindow    *application.WebviewWindow
}

// NewTrayService 创建新的系统托盘服务实例
func NewTrayService(logger *log.LoggerService, configService *ConfigService) *TrayService {
	return &TrayService{
		logger:        logger,
		configService: configService,
	}
}

// SetAppReferences 设置应用引用
func (ts *TrayService) SetAppReferences(app *application.App, mainWindow *application.WebviewWindow) {
	ts.app = app
	ts.mainWindow = mainWindow
}

// ShouldMinimizeToTray 检查是否应该最小化到托盘
func (ts *TrayService) ShouldMinimizeToTray() bool {
	config, err := ts.configService.GetConfig()
	if err != nil {
		ts.logger.Error("TrayService: Failed to get config", "error", err)
		return true // 默认行为：隐藏到托盘
	}

	return config.General.EnableSystemTray
}

// HandleWindowClose 处理窗口关闭事件
func (ts *TrayService) HandleWindowClose() {
	if ts.ShouldMinimizeToTray() {
		// 隐藏到托盘
		ts.mainWindow.Hide()
		ts.app.EmitEvent("window:hidden", nil)
		ts.logger.Info("TrayService: Window hidden to system tray")
	} else {
		// 直接退出应用
		ts.app.Quit()
		ts.logger.Info("TrayService: Application quit")
	}
}

// HandleWindowMinimize 处理窗口最小化事件
func (ts *TrayService) HandleWindowMinimize() {
	if ts.ShouldMinimizeToTray() {
		// 隐藏到托盘
		ts.mainWindow.Hide()
		ts.app.EmitEvent("window:hidden", nil)
		ts.logger.Info("TrayService: Window minimized to system tray")
	} else {
		// 允许正常最小化（不处理，让系统处理）
		ts.logger.Info("TrayService: Window minimized normally")
	}
}

// ShowWindow 显示主窗口
func (ts *TrayService) ShowWindow() {
	if ts.mainWindow != nil {
		ts.mainWindow.Show()
		ts.mainWindow.Restore()
		ts.mainWindow.Focus()
		if ts.app != nil {
			ts.app.EmitEvent("window:shown", nil)
		}
		ts.logger.Info("TrayService: Window shown from system tray")
	}
}

// MinimizeButtonClicked 处理标题栏最小化按钮点击
func (ts *TrayService) MinimizeButtonClicked() {
	// 最小化按钮总是执行正常最小化到任务栏，不隐藏到托盘
	ts.mainWindow.Minimise()
	ts.logger.Info("TrayService: Window minimized to taskbar via titlebar button")
}
