package services

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"voidraft/internal/common/hotkey"
	"voidraft/internal/common/hotkey/mainthread"
	"voidraft/internal/models"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// HotkeyService 全局热键服务
type HotkeyService struct {
	logger        *log.LogService
	configService *ConfigService
	windowHelper  *WindowHelper

	mu            sync.RWMutex
	currentHotkey *models.HotkeyCombo
	app           *application.App
	registered    atomic.Bool

	hk       *hotkey.Hotkey
	stopChan chan struct{}
	wg       sync.WaitGroup
}

// NewHotkeyService 创建热键服务实例
func NewHotkeyService(configService *ConfigService, logger *log.LogService) *HotkeyService {
	if logger == nil {
		logger = log.New()
	}

	return &HotkeyService{
		logger:        logger,
		configService: configService,
		windowHelper:  NewWindowHelper(),
		stopChan:      make(chan struct{}),
	}
}

// ServiceStartup 服务启动时初始化
func (hs *HotkeyService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	hs.app = application.Get()
	return hs.Initialize()
}

// Initialize 初始化热键服务
func (hs *HotkeyService) Initialize() error {
	config, err := hs.configService.GetConfig()
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	if config.General.EnableGlobalHotkey {
		if err := hs.RegisterHotkey(&config.General.GlobalHotkey); err != nil {
			return err
		}
	}

	return nil
}

// RegisterHotkey 注册全局热键
func (hs *HotkeyService) RegisterHotkey(combo *models.HotkeyCombo) error {
	if !hs.isValidHotkey(combo) {
		return errors.New("invalid hotkey combination")
	}

	hs.mu.Lock()
	defer hs.mu.Unlock()

	// 如果已注册，先取消
	if hs.registered.Load() {
		hs.unregisterInternal()
	}

	// 转换为 hotkey 库的格式
	key, mods, err := hs.convertHotkey(combo)
	if err != nil {
		return fmt.Errorf("convert hotkey: %w", err)
	}

	// 在主线程中创建热键
	var regErr error
	mainthread.Init(func() {
		hs.hk = hotkey.New(mods, key)
		regErr = hs.hk.Register()
	})

	if regErr != nil {
		return fmt.Errorf("register hotkey: %w", regErr)
	}

	hs.registered.Store(true)
	hs.currentHotkey = combo

	// 启动监听 goroutine
	hs.wg.Add(1)
	go hs.listenHotkey()

	return nil
}

// UnregisterHotkey 取消注册全局热键
func (hs *HotkeyService) UnregisterHotkey() error {
	hs.mu.Lock()
	defer hs.mu.Unlock()
	return hs.unregisterInternal()
}

// unregisterInternal 内部取消注册
func (hs *HotkeyService) unregisterInternal() error {
	if !hs.registered.Load() {
		return nil
	}

	// 停止监听
	close(hs.stopChan)

	// 取消注册热键
	if hs.hk != nil {
		if err := hs.hk.Unregister(); err != nil {
			hs.logger.Error("failed to unregister hotkey", "error", err)
		}
		hs.hk = nil
	}

	// 等待 goroutine 结束
	hs.wg.Wait()

	hs.currentHotkey = nil
	hs.registered.Store(false)

	// 重新创建 stopChan
	hs.stopChan = make(chan struct{})

	return nil
}

// UpdateHotkey 更新热键配置
func (hs *HotkeyService) UpdateHotkey(enable bool, combo *models.HotkeyCombo) error {
	if enable {
		return hs.RegisterHotkey(combo)
	}
	return hs.UnregisterHotkey()
}

// listenHotkey 监听热键事件
func (hs *HotkeyService) listenHotkey() {
	defer hs.wg.Done()

	for {
		select {
		case <-hs.stopChan:
			return
		case <-hs.hk.Keydown():
			hs.toggleWindow()
		}
	}
}

// convertHotkey 转换热键格式
func (hs *HotkeyService) convertHotkey(combo *models.HotkeyCombo) (hotkey.Key, []hotkey.Modifier, error) {
	// 转换主键
	key, err := hs.convertKey(combo.Key)
	if err != nil {
		return 0, nil, err
	}

	// 转换修饰键
	var mods []hotkey.Modifier
	if combo.Ctrl {
		mods = append(mods, hotkey.ModCtrl)
	}
	if combo.Shift {
		mods = append(mods, hotkey.ModShift)
	}
	if combo.Alt {
		mods = append(mods, hotkey.ModAlt)
	}
	if combo.Win {
		mods = append(mods, hotkey.ModWin) // Win/Cmd 键
	}

	return key, mods, nil
}

// convertKey 转换键码
func (hs *HotkeyService) convertKey(keyStr string) (hotkey.Key, error) {
	// 字母键
	keyMap := map[string]hotkey.Key{
		"A": hotkey.KeyA, "B": hotkey.KeyB, "C": hotkey.KeyC, "D": hotkey.KeyD,
		"E": hotkey.KeyE, "F": hotkey.KeyF, "G": hotkey.KeyG, "H": hotkey.KeyH,
		"I": hotkey.KeyI, "J": hotkey.KeyJ, "K": hotkey.KeyK, "L": hotkey.KeyL,
		"M": hotkey.KeyM, "N": hotkey.KeyN, "O": hotkey.KeyO, "P": hotkey.KeyP,
		"Q": hotkey.KeyQ, "R": hotkey.KeyR, "S": hotkey.KeyS, "T": hotkey.KeyT,
		"U": hotkey.KeyU, "V": hotkey.KeyV, "W": hotkey.KeyW, "X": hotkey.KeyX,
		"Y": hotkey.KeyY, "Z": hotkey.KeyZ,

		// 数字键
		"0": hotkey.Key0, "1": hotkey.Key1, "2": hotkey.Key2, "3": hotkey.Key3,
		"4": hotkey.Key4, "5": hotkey.Key5, "6": hotkey.Key6, "7": hotkey.Key7,
		"8": hotkey.Key8, "9": hotkey.Key9,

		// 功能键
		"F1": hotkey.KeyF1, "F2": hotkey.KeyF2, "F3": hotkey.KeyF3, "F4": hotkey.KeyF4,
		"F5": hotkey.KeyF5, "F6": hotkey.KeyF6, "F7": hotkey.KeyF7, "F8": hotkey.KeyF8,
		"F9": hotkey.KeyF9, "F10": hotkey.KeyF10, "F11": hotkey.KeyF11, "F12": hotkey.KeyF12,

		// 特殊键
		"Space":      hotkey.KeySpace,
		"Tab":        hotkey.KeyTab,
		"Enter":      hotkey.KeyReturn,
		"Escape":     hotkey.KeyEscape,
		"Delete":     hotkey.KeyDelete,
		"ArrowUp":    hotkey.KeyUp,
		"ArrowDown":  hotkey.KeyDown,
		"ArrowLeft":  hotkey.KeyLeft,
		"ArrowRight": hotkey.KeyRight,
	}

	if key, ok := keyMap[keyStr]; ok {
		return key, nil
	}

	return 0, fmt.Errorf("unsupported key: %s", keyStr)
}

// toggleWindow 切换窗口显示状态
func (hs *HotkeyService) toggleWindow() {
	mainWindow := hs.windowHelper.MustGetMainWindow()
	if mainWindow == nil {
		return
	}

	// 检查主窗口是否可见
	if mainWindow.IsVisible() {
		// 隐藏所有窗口
		hs.hideAllWindows()
	} else {
		// 显示所有窗口
		hs.showAllWindows()
	}
}

// hideAllWindows 隐藏所有窗口
func (hs *HotkeyService) hideAllWindows() {
	if hs.app == nil {
		return
	}

	openWindows := hs.app.Window.GetAll()
	for _, window := range openWindows {
		window.Hide()
	}
}

// showAllWindows 显示所有窗口
func (hs *HotkeyService) showAllWindows() {
	if hs.app == nil {
		return
	}

	openWindows := hs.app.Window.GetAll()
	for _, window := range openWindows {
		window.Show()
		window.Restore()
		window.Focus()
	}
}

// isValidHotkey 验证热键组合
func (hs *HotkeyService) isValidHotkey(combo *models.HotkeyCombo) bool {
	if combo == nil || combo.Key == "" {
		return false
	}
	// 至少需要一个修饰键
	if !combo.Ctrl && !combo.Shift && !combo.Alt && !combo.Win {
		return false
	}
	return true
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
	return hs.registered.Load()
}

// ServiceShutdown 关闭服务
func (hs *HotkeyService) ServiceShutdown() error {
	return hs.UnregisterHotkey()
}
