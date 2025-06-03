//go:build windows

package services

/*
#cgo CFLAGS: -I../lib
#cgo LDFLAGS: -luser32
#include "../lib/hotkey_windows.c"
#include "hotkey_windows.h"
*/
import "C"

import (
	"fmt"
	"sync"
	"time"
	"voidraft/internal/models"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// HotkeyService 全局热键服务
type HotkeyService struct {
	logger        *log.LoggerService
	configService *ConfigService
	app           *application.App
	mu            sync.RWMutex
	isRegistered  bool
	currentHotkey *models.HotkeyCombo
	stopChan      chan struct{}
	wg            sync.WaitGroup
	running       bool
}

// HotkeyError 热键错误
type HotkeyError struct {
	Operation string
	Err       error
}

// Error 实现error接口
func (e *HotkeyError) Error() string {
	return fmt.Sprintf("hotkey error during %s: %v", e.Operation, e.Err)
}

// Unwrap 获取原始错误
func (e *HotkeyError) Unwrap() error {
	return e.Err
}

// NewHotkeyService 创建新的热键服务实例
func NewHotkeyService(configService *ConfigService, logger *log.LoggerService) *HotkeyService {
	if logger == nil {
		logger = log.New()
	}

	return &HotkeyService{
		logger:        logger,
		configService: configService,
		isRegistered:  false,
		running:       false,
	}
}

// Initialize 初始化热键服务
func (hs *HotkeyService) Initialize(app *application.App) error {
	hs.app = app

	// 加载并应用当前配置
	config, err := hs.configService.GetConfig()
	if err != nil {
		return &HotkeyError{Operation: "load_config", Err: err}
	}

	if config.General.EnableGlobalHotkey {
		err = hs.RegisterHotkey(&config.General.GlobalHotkey)
		if err != nil {
			hs.logger.Error("Hotkey: Failed to register hotkey on startup", "error", err)
		}
	}

	hs.logger.Info("Hotkey: Service initialized")
	return nil
}

// RegisterHotkey 注册全局热键
func (hs *HotkeyService) RegisterHotkey(hotkey *models.HotkeyCombo) error {
	hs.mu.Lock()
	defer hs.mu.Unlock()

	// 先取消注册现有热键
	if hs.isRegistered {
		hs.logger.Info("Hotkey: Unregistering existing hotkey before registering new one")
		err := hs.unregisterHotkeyInternal()
		if err != nil {
			return err
		}
	}

	// 验证热键组合
	if !hs.isValidHotkey(hotkey) {
		return &HotkeyError{Operation: "validate_hotkey", Err: fmt.Errorf("invalid hotkey combination")}
	}

	hs.logger.Info("Hotkey: Registering global hotkey using Windows API",
		"ctrl", hotkey.Ctrl,
		"shift", hotkey.Shift,
		"alt", hotkey.Alt,
		"win", hotkey.Win,
		"key", hotkey.Key)

	// 创建ready channel等待goroutine启动完成
	readyChan := make(chan struct{})

	// 确保 stopChan 是新的
	hs.stopChan = make(chan struct{})
	hs.wg.Add(1)
	go hs.hotkeyListener(hotkey, readyChan)

	// 等待监听器启动完成，设置超时避免无限等待
	select {
	case <-readyChan:
		// 监听器启动完成
	case <-time.After(1 * time.Second):
		// 超时处理
		hs.logger.Warning("Hotkey: Timeout waiting for listener to start")
		return &HotkeyError{Operation: "start_listener", Err: fmt.Errorf("timeout waiting for hotkey listener to start")}
	}

	hs.currentHotkey = hotkey
	hs.isRegistered = true
	hs.running = true

	hs.logger.Info("Hotkey: Successfully registered global hotkey")
	return nil
}

// UnregisterHotkey 取消注册全局热键
func (hs *HotkeyService) UnregisterHotkey() error {
	hs.mu.Lock()
	defer hs.mu.Unlock()

	return hs.unregisterHotkeyInternal()
}

// unregisterHotkeyInternal 内部取消注册方法（无锁）
func (hs *HotkeyService) unregisterHotkeyInternal() error {
	if !hs.isRegistered {
		hs.logger.Debug("Hotkey: No hotkey registered, skipping unregister")
		return nil
	}

	hs.logger.Info("Hotkey: Unregistering global hotkey")

	// 停止监听
	if hs.stopChan != nil {
		close(hs.stopChan)
		hs.logger.Debug("Hotkey: Waiting for listener goroutine to stop")
		hs.wg.Wait()
		hs.logger.Debug("Hotkey: Listener goroutine stopped")
	}

	// 重置状态
	hs.currentHotkey = nil
	hs.isRegistered = false
	hs.running = false
	hs.stopChan = nil

	hs.logger.Info("Hotkey: Successfully unregistered global hotkey")
	return nil
}

// UpdateHotkey 更新热键配置
func (hs *HotkeyService) UpdateHotkey(enable bool, hotkey *models.HotkeyCombo) error {
	hs.logger.Info("Hotkey: === UpdateHotkey called ===",
		"enable", enable,
		"ctrl", hotkey.Ctrl,
		"shift", hotkey.Shift,
		"alt", hotkey.Alt,
		"win", hotkey.Win,
		"key", hotkey.Key)

	// 先获取当前状态
	hs.mu.RLock()
	currentRegistered := hs.isRegistered
	var currentHotkey *models.HotkeyCombo
	if hs.currentHotkey != nil {
		currentHotkey = &models.HotkeyCombo{
			Ctrl:  hs.currentHotkey.Ctrl,
			Shift: hs.currentHotkey.Shift,
			Alt:   hs.currentHotkey.Alt,
			Win:   hs.currentHotkey.Win,
			Key:   hs.currentHotkey.Key,
		}
	}
	hs.mu.RUnlock()

	hs.logger.Info("Hotkey: Current state",
		"currentRegistered", currentRegistered,
		"currentHotkey", currentHotkey)

	// 检查是否需要更新
	needsUpdate := false
	if enable != currentRegistered {
		needsUpdate = true
		hs.logger.Info("Hotkey: Enable state changed", "old", currentRegistered, "new", enable)
	} else if enable && currentHotkey != nil {
		// 如果启用状态，检查热键组合是否变化
		if hotkey.Ctrl != currentHotkey.Ctrl ||
			hotkey.Shift != currentHotkey.Shift ||
			hotkey.Alt != currentHotkey.Alt ||
			hotkey.Win != currentHotkey.Win ||
			hotkey.Key != currentHotkey.Key {
			needsUpdate = true
			hs.logger.Info("Hotkey: Hotkey combination changed",
				"old", fmt.Sprintf("Ctrl:%v Shift:%v Alt:%v Win:%v Key:%s",
					currentHotkey.Ctrl, currentHotkey.Shift, currentHotkey.Alt, currentHotkey.Win, currentHotkey.Key),
				"new", fmt.Sprintf("Ctrl:%v Shift:%v Alt:%v Win:%v Key:%s",
					hotkey.Ctrl, hotkey.Shift, hotkey.Alt, hotkey.Win, hotkey.Key))
		}
	}

	if !needsUpdate {
		hs.logger.Info("Hotkey: No changes detected, skipping update")
		return nil
	}

	hs.logger.Info("Hotkey: Proceeding with hotkey update", "needsUpdate", needsUpdate)

	if enable {
		// 启用热键：直接注册新热键（RegisterHotkey 会处理取消旧热键）
		err := hs.RegisterHotkey(hotkey)
		if err != nil {
			hs.logger.Error("Hotkey: Failed to register new hotkey", "error", err)
			return err
		}
		hs.logger.Info("Hotkey: Successfully updated and registered new hotkey")
		return nil
	} else {
		// 禁用热键：取消注册
		err := hs.UnregisterHotkey()
		if err != nil {
			hs.logger.Error("Hotkey: Failed to unregister hotkey", "error", err)
			return err
		}
		hs.logger.Info("Hotkey: Successfully disabled hotkey")
		return nil
	}
}

// ToggleWindow 切换窗口显示/隐藏 - 通过事件通知前端处理
func (hs *HotkeyService) ToggleWindow() {
	if hs.app == nil {
		hs.logger.Warning("Hotkey: App is nil, cannot toggle")
		return
	}

	// 发送事件到前端，让前端处理窗口切换
	hs.app.EmitEvent("hotkey:toggle-window", nil)
	hs.logger.Debug("Hotkey: Emitted toggle window event")
}

// hotkeyListener 热键监听器goroutine
func (hs *HotkeyService) hotkeyListener(hotkey *models.HotkeyCombo, readyChan chan struct{}) {
	defer hs.wg.Done()

	hs.logger.Debug("Hotkey: Starting Windows API hotkey listener")

	// 将热键转换为虚拟键码
	mainKeyVK := hs.keyToVirtualKeyCode(hotkey.Key)
	if mainKeyVK == 0 {
		hs.logger.Error("Hotkey: Invalid key", "key", hotkey.Key)
		close(readyChan)
		return
	}

	// 检查间隔（100ms，减少CPU使用率）
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	// 添加状态跟踪
	var wasPressed bool = false

	// 标记是否已经发送ready信号，确保只发送一次
	readySent := false

	for {
		select {
		case <-hs.stopChan:
			hs.logger.Debug("Hotkey: Stopping Windows API hotkey listener")
			if !readySent {
				close(readyChan)
			}
			return
		case <-ticker.C:
			// 第一次循环时发送ready信号，表示监听器已经准备就绪
			if !readySent {
				close(readyChan)
				readySent = true
				hs.logger.Debug("Hotkey: Listener ready signal sent")
			}

			// 调用 C 函数检查热键组合
			ctrl := 0
			if hotkey.Ctrl {
				ctrl = 1
			}

			shift := 0
			if hotkey.Shift {
				shift = 1
			}

			alt := 0
			if hotkey.Alt {
				alt = 1
			}

			win := 0
			if hotkey.Win {
				win = 1
			}

			// 检查热键是否被按下
			isPressed := int(C.isHotkeyPressed(C.int(ctrl), C.int(shift), C.int(alt), C.int(win), C.int(mainKeyVK))) == 1

			// 只在按键从未按下变为按下时触发（边缘触发）
			if isPressed && !wasPressed {
				hs.logger.Debug("Hotkey: Global hotkey triggered via Windows API")
				hs.ToggleWindow()
			}

			// 更新状态
			wasPressed = isPressed
		}
	}
}

// keyToVirtualKeyCode 将键名转换为 Windows 虚拟键码
func (hs *HotkeyService) keyToVirtualKeyCode(key string) int {
	keyMap := map[string]int{
		// 字母键
		"A": 0x41, "B": 0x42, "C": 0x43, "D": 0x44, "E": 0x45, "F": 0x46, "G": 0x47, "H": 0x48,
		"I": 0x49, "J": 0x4A, "K": 0x4B, "L": 0x4C, "M": 0x4D, "N": 0x4E, "O": 0x4F, "P": 0x50,
		"Q": 0x51, "R": 0x52, "S": 0x53, "T": 0x54, "U": 0x55, "V": 0x56, "W": 0x57, "X": 0x58,
		"Y": 0x59, "Z": 0x5A,

		// 数字键
		"0": 0x30, "1": 0x31, "2": 0x32, "3": 0x33, "4": 0x34,
		"5": 0x35, "6": 0x36, "7": 0x37, "8": 0x38, "9": 0x39,

		// 功能键
		"F1": 0x70, "F2": 0x71, "F3": 0x72, "F4": 0x73, "F5": 0x74, "F6": 0x75,
		"F7": 0x76, "F8": 0x77, "F9": 0x78, "F10": 0x79, "F11": 0x7A, "F12": 0x7B,
	}

	if vk, exists := keyMap[key]; exists {
		return vk
	}
	return 0
}

// isValidHotkey 验证热键组合是否有效
func (hs *HotkeyService) isValidHotkey(hotkey *models.HotkeyCombo) bool {
	if hotkey == nil {
		return false
	}

	// 必须有主键
	if hotkey.Key == "" {
		return false
	}

	// 必须至少有一个修饰键
	if !hotkey.Ctrl && !hotkey.Shift && !hotkey.Alt && !hotkey.Win {
		return false
	}

	// 验证主键是否在有效范围内
	return hs.keyToVirtualKeyCode(hotkey.Key) != 0
}

// GetCurrentHotkey 获取当前注册的热键
func (hs *HotkeyService) GetCurrentHotkey() *models.HotkeyCombo {
	hs.mu.RLock()
	defer hs.mu.RUnlock()

	if hs.currentHotkey == nil {
		return nil
	}

	// 返回副本避免并发问题
	return &models.HotkeyCombo{
		Ctrl:  hs.currentHotkey.Ctrl,
		Shift: hs.currentHotkey.Shift,
		Alt:   hs.currentHotkey.Alt,
		Win:   hs.currentHotkey.Win,
		Key:   hs.currentHotkey.Key,
	}
}

// IsRegistered 检查是否已注册热键
func (hs *HotkeyService) IsRegistered() bool {
	hs.mu.RLock()
	defer hs.mu.RUnlock()
	return hs.isRegistered
}

// ServiceShutdown  关闭热键服务
func (hs *HotkeyService) ServiceShutdown() error {
	hs.mu.Lock()
	defer hs.mu.Unlock()

	if hs.isRegistered {
		err := hs.unregisterHotkeyInternal()
		if err != nil {
			hs.logger.Error("Hotkey: Failed to unregister hotkey on shutdown", "error", err)
		}
	}

	hs.logger.Info("Hotkey: Service shutdown completed")
	return nil
}
