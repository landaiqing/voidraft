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
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
	"voidraft/internal/models"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// HotkeyService Windows全局热键服务
type HotkeyService struct {
	logger        *log.Service
	configService *ConfigService
	app           *application.App

	mu            sync.RWMutex
	currentHotkey *models.HotkeyCombo
	isRegistered  atomic.Bool

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// HotkeyError 热键错误
type HotkeyError struct {
	Operation string
	Err       error
}

func (e *HotkeyError) Error() string {
	return fmt.Sprintf("hotkey %s: %v", e.Operation, e.Err)
}

func (e *HotkeyError) Unwrap() error {
	return e.Err
}

// NewHotkeyService 创建热键服务实例
func NewHotkeyService(configService *ConfigService, logger *log.Service) *HotkeyService {
	if logger == nil {
		logger = log.New()
	}

	ctx, cancel := context.WithCancel(context.Background())
	return &HotkeyService{
		logger:        logger,
		configService: configService,
		ctx:           ctx,
		cancel:        cancel,
	}
}

// Initialize 初始化热键服务
func (hs *HotkeyService) Initialize(app *application.App) error {
	hs.app = app

	config, err := hs.configService.GetConfig()
	if err != nil {
		return &HotkeyError{"load_config", err}
	}

	if config.General.EnableGlobalHotkey {
		if err := hs.RegisterHotkey(&config.General.GlobalHotkey); err != nil {
			hs.logger.Error("failed to register startup hotkey", "error", err)
		}
	}

	return nil
}

// RegisterHotkey 注册全局热键
func (hs *HotkeyService) RegisterHotkey(hotkey *models.HotkeyCombo) error {
	if !hs.isValidHotkey(hotkey) {
		return &HotkeyError{"validate", fmt.Errorf("invalid hotkey combination")}
	}

	hs.mu.Lock()
	defer hs.mu.Unlock()

	// 取消现有热键
	if hs.isRegistered.Load() {
		hs.unregisterInternal()
	}

	// 启动监听器
	ctx, cancel := context.WithCancel(hs.ctx)
	hs.wg.Add(1)

	ready := make(chan error, 1)
	go hs.hotkeyListener(ctx, hotkey, ready)

	// 等待启动完成
	select {
	case err := <-ready:
		if err != nil {
			cancel()
			return &HotkeyError{"register", err}
		}
	case <-time.After(time.Second):
		cancel()
		return &HotkeyError{"register", fmt.Errorf("timeout")}
	}

	hs.currentHotkey = hotkey
	hs.isRegistered.Store(true)
	hs.cancel = cancel

	return nil
}

// UnregisterHotkey 取消注册全局热键
func (hs *HotkeyService) UnregisterHotkey() error {
	hs.mu.Lock()
	defer hs.mu.Unlock()
	return hs.unregisterInternal()
}

// unregisterInternal 内部取消注册（无锁）
func (hs *HotkeyService) unregisterInternal() error {
	if !hs.isRegistered.Load() {
		return nil
	}

	if hs.cancel != nil {
		hs.cancel()
		hs.wg.Wait()
	}

	hs.currentHotkey = nil
	hs.isRegistered.Store(false)
	return nil
}

// UpdateHotkey 更新热键配置
func (hs *HotkeyService) UpdateHotkey(enable bool, hotkey *models.HotkeyCombo) error {
	if enable {
		return hs.RegisterHotkey(hotkey)
	}
	return hs.UnregisterHotkey()
}

// hotkeyListener 热键监听器
func (hs *HotkeyService) hotkeyListener(ctx context.Context, hotkey *models.HotkeyCombo, ready chan<- error) {
	defer hs.wg.Done()

	mainKeyVK := hs.keyToVirtualKeyCode(hotkey.Key)
	if mainKeyVK == 0 {
		ready <- fmt.Errorf("invalid key: %s", hotkey.Key)
		return
	}

	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	var wasPressed bool
	ready <- nil // 标记准备就绪

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			ctrl := cBool(hotkey.Ctrl)
			shift := cBool(hotkey.Shift)
			alt := cBool(hotkey.Alt)
			win := cBool(hotkey.Win)

			isPressed := C.isHotkeyPressed(ctrl, shift, alt, win, C.int(mainKeyVK)) == 1

			if isPressed && !wasPressed {
				hs.toggleWindow()
			}
			wasPressed = isPressed
		}
	}
}

// cBool 转换Go bool为C int
func cBool(b bool) C.int {
	if b {
		return 1
	}
	return 0
}

// toggleWindow 切换窗口
func (hs *HotkeyService) toggleWindow() {
	if hs.app != nil {
		hs.app.Event.Emit("hotkey:toggle-window", nil)
	}
}

// keyToVirtualKeyCode 键名转虚拟键码
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
	return keyMap[key]
}

// isValidHotkey 验证热键组合
func (hs *HotkeyService) isValidHotkey(hotkey *models.HotkeyCombo) bool {
	if hotkey == nil || hotkey.Key == "" {
		return false
	}
	// 至少需要一个修饰键
	if !hotkey.Ctrl && !hotkey.Shift && !hotkey.Alt && !hotkey.Win {
		return false
	}
	return hs.keyToVirtualKeyCode(hotkey.Key) != 0
}

// GetCurrentHotkey 获取当前热键
func (hs *HotkeyService) GetCurrentHotkey() *models.HotkeyCombo {
	hs.mu.RLock()
	defer hs.mu.RUnlock()

	if hs.currentHotkey == nil {
		return nil
	}

	return &models.HotkeyCombo{
		Ctrl:  hs.currentHotkey.Ctrl,
		Shift: hs.currentHotkey.Shift,
		Alt:   hs.currentHotkey.Alt,
		Win:   hs.currentHotkey.Win,
		Key:   hs.currentHotkey.Key,
	}
}

// IsRegistered 检查是否已注册
func (hs *HotkeyService) IsRegistered() bool {
	return hs.isRegistered.Load()
}

// ServiceShutdown 关闭服务
func (hs *HotkeyService) ServiceShutdown() error {
	hs.cancel()
	hs.wg.Wait()
	return nil
}
