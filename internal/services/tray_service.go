package services

import (
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// TrayService 系统托盘服务
type TrayService struct {
	logger        *log.LogService
	configService *ConfigService
	windowHelper  *WindowHelper
}

// NewTrayService 创建新的系统托盘服务实例
func NewTrayService(logger *log.LogService, configService *ConfigService) *TrayService {
	return &TrayService{
		logger:        logger,
		configService: configService,
		windowHelper:  NewWindowHelper(),
	}
}

// ShouldMinimizeToTray 检查是否应该最小化到托盘
func (ts *TrayService) ShouldMinimizeToTray() bool {
	config, err := ts.configService.GetConfig()
	if err != nil {
		return true // 默认行为：隐藏到托盘
	}

	return config.General.EnableSystemTray
}

// HandleWindowClose 处理窗口关闭事件
func (ts *TrayService) HandleWindowClose() {
	if ts.ShouldMinimizeToTray() {
		// 隐藏到托盘
		ts.windowHelper.HideMainWindow()
	} else {
		// 直接退出应用
		application.Get().Quit()
	}
}

// HandleWindowMinimize 处理窗口最小化事件
func (ts *TrayService) HandleWindowMinimize() {
	if ts.ShouldMinimizeToTray() {
		// 隐藏到托盘
		ts.windowHelper.HideMainWindow()
	}
}

// ShowWindow 显示主窗口
func (ts *TrayService) ShowWindow() {
	ts.windowHelper.FocusMainWindow()
}

// MinimizeButtonClicked 处理标题栏最小化按钮点击
func (ts *TrayService) MinimizeButtonClicked() {
	ts.windowHelper.MinimiseMainWindow()
}
