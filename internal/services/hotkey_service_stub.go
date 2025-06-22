//go:build !windows && !darwin && !linux

package services

import (
	"fmt"
	"voidraft/internal/models"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// HotkeyService 存根热键服务
type HotkeyService struct {
	logger        *log.LoggerService
	configService *ConfigService
}

// HotkeyError 热键错误
type HotkeyError struct {
	Operation string
	Err       error
}

// Error 实现error接口
func (e *HotkeyError) Error() string {
	return fmt.Sprintf("hotkey %s: %v", e.Operation, e.Err)
}

// Unwrap 获取原始错误
func (e *HotkeyError) Unwrap() error {
	return e.Err
}

// NewHotkeyService 创建热键服务实例
func NewHotkeyService(configService *ConfigService, logger *log.LoggerService) *HotkeyService {
	if logger == nil {
		logger = log.New()
	}

	return &HotkeyService{
		logger:        logger,
		configService: configService,
	}
}

// Initialize 初始化热键服务
func (hs *HotkeyService) Initialize(app *application.App) error {
	hs.logger.Warning("Global hotkey is not supported on this platform")
	return nil
}

// RegisterHotkey 注册全局热键
func (hs *HotkeyService) RegisterHotkey(hotkey *models.HotkeyCombo) error {
	return &HotkeyError{"register", fmt.Errorf("not supported on this platform")}
}

// UnregisterHotkey 取消注册全局热键
func (hs *HotkeyService) UnregisterHotkey() error {
	return &HotkeyError{"unregister", fmt.Errorf("not supported on this platform")}
}

// UpdateHotkey 更新热键配置
func (hs *HotkeyService) UpdateHotkey(enable bool, hotkey *models.HotkeyCombo) error {
	if enable {
		return hs.RegisterHotkey(hotkey)
	}
	return hs.UnregisterHotkey()
}

// GetCurrentHotkey 获取当前热键
func (hs *HotkeyService) GetCurrentHotkey() *models.HotkeyCombo {
	return nil
}

// IsRegistered 检查是否已注册
func (hs *HotkeyService) IsRegistered() bool {
	return false
}

// ServiceShutdown 关闭服务
func (hs *HotkeyService) ServiceShutdown() error {
	return nil
}
