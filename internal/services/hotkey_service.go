package services

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
	"voidraft/internal/common/helper"
	"voidraft/internal/common/hotkey"
	"voidraft/internal/models"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// HotkeyService 全局热键服务
type HotkeyService struct {
	logger        *log.LogService
	configService *ConfigService
	windowHelper  *helper.WindowHelper

	mu            sync.RWMutex
	currentHotkey *models.HotkeyCombo
	app           *application.App
	registered    atomic.Bool

	hk         *hotkey.Hotkey
	ctx        context.Context
	cancel     context.CancelFunc
	wg         sync.WaitGroup
	isShutdown atomic.Bool

	// 配置观察者取消函数
	cancelObservers []CancelFunc
}

// NewHotkeyService 创建热键服务实例
func NewHotkeyService(configService *ConfigService, logger *log.LogService) *HotkeyService {
	if logger == nil {
		logger = log.New()
	}

	ctx, cancel := context.WithCancel(context.Background())
	return &HotkeyService{
		logger:        logger,
		configService: configService,
		windowHelper:  helper.NewWindowHelper(),
		ctx:           ctx,
		cancel:        cancel,
	}
}

// ServiceStartup 服务启动时初始化
func (hs *HotkeyService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	hs.app = application.Get()
	return hs.Initialize()
}

// Initialize 初始化热键服务
func (hs *HotkeyService) Initialize() error {
	// 注册配置监听
	hs.cancelObservers = []CancelFunc{
		hs.configService.Watch("general.enableGlobalHotkey", hs.onHotkeyConfigChange),
		hs.configService.Watch("general.globalHotkey", hs.onHotkeyConfigChange),
	}

	// 加载初始配置
	config, err := hs.configService.GetConfig()
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	if config.General.EnableGlobalHotkey {
		_ = hs.RegisterHotkey(&config.General.GlobalHotkey)
	}

	return nil
}

// onHotkeyConfigChange 热键配置变更回调
func (hs *HotkeyService) onHotkeyConfigChange(oldValue, newValue interface{}) {
	// 重新加载配置
	config, err := hs.configService.GetConfig()
	if err != nil {
		return
	}

	// 更新热键
	_ = hs.UpdateHotkey(config.General.EnableGlobalHotkey, &config.General.GlobalHotkey)
}

// RegisterHotkey 注册全局热键
func (hs *HotkeyService) RegisterHotkey(combo *models.HotkeyCombo) error {
	if hs.isShutdown.Load() {
		return errors.New("service is shutdown")
	}

	if !hs.isValidHotkey(combo) {
		return errors.New("invalid hotkey combination")
	}

	// 如果已注册，先取消
	if hs.registered.Load() {
		_ = hs.UnregisterHotkey()
	}

	// 转换为 hotkey 库的格式
	key, mods, err := hs.convertHotkey(combo)
	if err != nil {
		return fmt.Errorf("convert hotkey: %w", err)
	}

	hs.mu.Lock()
	// 创建新的热键实例
	hs.hk = hotkey.New(mods, key)
	if err := hs.hk.Register(); err != nil {
		hs.mu.Unlock()
		return fmt.Errorf("register hotkey: %w", err)
	}

	hs.registered.Store(true)
	hs.currentHotkey = combo
	hs.mu.Unlock()

	// 启动监听 goroutine
	hs.wg.Add(1)
	go hs.listenHotkey()

	return nil
}

// UnregisterHotkey 取消注册全局热键
func (hs *HotkeyService) UnregisterHotkey() error {
	if !hs.registered.Load() {
		return nil
	}

	// 先标记为未注册
	hs.registered.Store(false)

	// 获取热键实例的引用
	hs.mu.RLock()
	hk := hs.hk
	hs.mu.RUnlock()

	if hk == nil {
		return nil
	}

	// 调用 Close() 确保完全清理
	_ = hk.Close()

	// 等待监听 goroutine 退出
	done := make(chan struct{})
	go func() {
		hs.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
	}

	// 清理状态
	hs.mu.Lock()
	hs.hk = nil
	hs.currentHotkey = nil
	hs.mu.Unlock()

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

	// 获取热键实例和通道
	hs.mu.RLock()
	hk := hs.hk
	hs.mu.RUnlock()

	if hk == nil {
		return
	}

	keydownChan := hk.Keydown()

	for {
		select {
		case <-hs.ctx.Done():
			return
		case _, ok := <-keydownChan:
			if !ok {
				return
			}
			if hs.registered.Load() {
				hs.toggleWindow()
			}
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
	hs.isShutdown.Store(true)

	// 取消配置观察者
	for _, cancel := range hs.cancelObservers {
		if cancel != nil {
			cancel()
		}
	}

	// 取消 context
	hs.cancel()

	// 取消注册热键
	return hs.UnregisterHotkey()
}
