//go:build linux

package services

/*
#cgo pkg-config: x11
#include <X11/Xlib.h>
#include <X11/keysym.h>
#include <X11/extensions/XTest.h>
#include <stdlib.h>
#include <string.h>

static Display *display = NULL;
static Window root_window;
static int hotkey_registered = 0;
static int registered_keycode = 0;
static unsigned int registered_modifiers = 0;

// 初始化X11显示
int initX11Display() {
    display = XOpenDisplay(NULL);
    if (display == NULL) {
        return 0;
    }
    root_window = DefaultRootWindow(display);
    return 1;
}

// 关闭X11显示
void closeX11Display() {
    if (display != NULL) {
        XCloseDisplay(display);
        display = NULL;
    }
}

// 注册全局热键
int registerGlobalHotkey(int keycode, unsigned int modifiers) {
    if (display == NULL && !initX11Display()) {
        return 0;
    }

    // 如果已经注册了热键，先取消注册
    if (hotkey_registered) {
        XUngrabKey(display, registered_keycode, registered_modifiers, root_window);
        hotkey_registered = 0;
    }

    // 注册新热键
    XGrabKey(display, keycode, modifiers, root_window, False, GrabModeAsync, GrabModeAsync);
    XGrabKey(display, keycode, modifiers | LockMask, root_window, False, GrabModeAsync, GrabModeAsync);
    XGrabKey(display, keycode, modifiers | Mod2Mask, root_window, False, GrabModeAsync, GrabModeAsync);
    XGrabKey(display, keycode, modifiers | LockMask | Mod2Mask, root_window, False, GrabModeAsync, GrabModeAsync);

    XSync(display, False);

    registered_keycode = keycode;
    registered_modifiers = modifiers;
    hotkey_registered = 1;

    return 1;
}

// 取消注册全局热键
int unregisterGlobalHotkey() {
    if (display == NULL || !hotkey_registered) {
        return 1;
    }

    XUngrabKey(display, registered_keycode, registered_modifiers, root_window);
    XUngrabKey(display, registered_keycode, registered_modifiers | LockMask, root_window);
    XUngrabKey(display, registered_keycode, registered_modifiers | Mod2Mask, root_window);
    XUngrabKey(display, registered_keycode, registered_modifiers | LockMask | Mod2Mask, root_window);

    XSync(display, False);

    hotkey_registered = 0;
    registered_keycode = 0;
    registered_modifiers = 0;

    return 1;
}

// 检查热键事件
int checkHotkeyEvent() {
    if (display == NULL || !hotkey_registered) {
        return 0;
    }

    XEvent event;
    while (XPending(display)) {
        XNextEvent(display, &event);
        if (event.type == KeyPress) {
            XKeyEvent *key_event = (XKeyEvent*)&event;
            if (key_event->keycode == registered_keycode) {
                // 检查修饰符匹配（忽略Caps Lock和Num Lock）
                unsigned int clean_modifiers = key_event->state & ~(LockMask | Mod2Mask);
                if (clean_modifiers == registered_modifiers) {
                    return 1;
                }
            }
        }
    }

    return 0;
}

// 将键名转换为X11键码
int getX11Keycode(const char* keyname) {
    if (display == NULL) {
        return 0;
    }

    KeySym keysym = XStringToKeysym(keyname);
    if (keysym == NoSymbol) {
        return 0;
    }

    return XKeysymToKeycode(display, keysym);
}

// 检查是否已注册热键
int isHotkeyRegistered() {
    return hotkey_registered;
}
*/
import "C"

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
	"unsafe"
	"voidraft/internal/models"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// HotkeyService Linux全局热键服务
type HotkeyService struct {
	logger        *log.LogService
	configService *ConfigService
	windowService *WindowService
	app           *application.App
	mainWindow    *application.WebviewWindow

	mu            sync.RWMutex
	currentHotkey *models.HotkeyCombo
	isRegistered  atomic.Bool

	ctx        context.Context
	cancelFunc atomic.Value // 使用atomic.Value存储cancel函数，避免竞态条件
	wg         sync.WaitGroup
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

func (e *HotkeyError) Unwrap() error {
	return e.Err
}

// setCancelFunc 原子地设置cancel函数
func (hs *HotkeyService) setCancelFunc(cancel context.CancelFunc) {
	hs.cancelFunc.Store(cancel)
}

// getCancelFunc 原子地获取cancel函数
func (hs *HotkeyService) getCancelFunc() context.CancelFunc {
	if cancel := hs.cancelFunc.Load(); cancel != nil {
		return cancel.(context.CancelFunc)
	}
	return nil
}

// clearCancelFunc 原子地清除cancel函数
func (hs *HotkeyService) clearCancelFunc() {
	hs.cancelFunc.Store((*context.CancelFunc)(nil))
}

// NewHotkeyService 创建热键服务实例
func NewHotkeyService(configService *ConfigService, windowService *WindowService, logger *log.LogService) *HotkeyService {
	if logger == nil {
		logger = log.New()
	}

	ctx, cancel := context.WithCancel(context.Background())
	service := &HotkeyService{
		logger:        logger,
		configService: configService,
		windowService: windowService,
		ctx:           ctx,
	}
	// 初始化时设置cancel函数
	service.setCancelFunc(cancel)
	return service
}

// Initialize 初始化热键服务
func (hs *HotkeyService) Initialize(app *application.App, mainWindow *application.WebviewWindow) error {
	hs.app = app
	hs.mainWindow = mainWindow

	if int(C.initX11Display()) == 0 {
		return &HotkeyError{"init_x11", fmt.Errorf("failed to initialize X11 display")}
	}

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

	keyCode := hs.keyToX11KeyCode(hotkey.Key)
	if keyCode == 0 {
		return &HotkeyError{"convert_key", fmt.Errorf("unsupported key: %s", hotkey.Key)}
	}

	modifiers := hs.buildX11Modifiers(hotkey)

	result := int(C.registerGlobalHotkey(C.int(keyCode), C.uint(modifiers)))
	if result == 0 {
		return &HotkeyError{"register", fmt.Errorf("failed to register hotkey")}
	}

	// 启动监听器
	ctx, cancel := context.WithCancel(hs.ctx)
	hs.wg.Add(1)

	ready := make(chan error, 1)
	go hs.hotkeyListener(ctx, ready)

	// 等待启动完成
	select {
	case err := <-ready:
		if err != nil {
			cancel()
			return &HotkeyError{"start_listener", err}
		}
	case <-time.After(time.Second):
		cancel()
		return &HotkeyError{"start_listener", fmt.Errorf("timeout")}
	}

	hs.currentHotkey = hotkey
	hs.isRegistered.Store(true)
	hs.setCancelFunc(cancel)

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

	// 原子地获取并调用cancel函数
	if cancel := hs.getCancelFunc(); cancel != nil {
		cancel()
		hs.wg.Wait()
	}

	result := int(C.unregisterGlobalHotkey())
	if result == 0 {
		return &HotkeyError{"unregister", fmt.Errorf("failed to unregister hotkey")}
	}

	hs.currentHotkey = nil
	hs.isRegistered.Store(false)
	hs.clearCancelFunc()
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
func (hs *HotkeyService) hotkeyListener(ctx context.Context, ready chan<- error) {
	defer hs.wg.Done()

	// 优化轮询频率从100ms改为50ms，提高响应性
	ticker := time.NewTicker(50 * time.Millisecond)
	defer ticker.Stop()

	ready <- nil // 标记准备就绪

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if int(C.checkHotkeyEvent()) == 1 {
				hs.toggleWindow()
			}
		}
	}
}

// toggleWindow 切换窗口显示状态
func (hs *HotkeyService) toggleWindow() {
	if hs.mainWindow == nil {
		hs.logger.Error("main window not set")
		return
	}

	// 检查主窗口是否可见
	if hs.isWindowVisible(hs.mainWindow) {
		// 如果主窗口可见，隐藏所有窗口
		hs.hideAllWindows()
	} else {
		// 如果主窗口不可见，显示所有窗口
		hs.showAllWindows()
	}
}

// isWindowVisible 检查窗口是否可见
func (hs *HotkeyService) isWindowVisible(window *application.WebviewWindow) bool {
	return window.IsVisible()
}

// hideAllWindows 隐藏所有窗口
func (hs *HotkeyService) hideAllWindows() {
	// 隐藏主窗口
	hs.mainWindow.Hide()

	// 隐藏所有子窗口
	if hs.windowService != nil {
		openWindows := hs.windowService.GetOpenWindows()
		for _, windowInfo := range openWindows {
			windowInfo.Window.Hide()
		}
	}

	hs.logger.Debug("all windows hidden")
}

// showAllWindows 显示所有窗口
func (hs *HotkeyService) showAllWindows() {
	// 显示主窗口
	hs.mainWindow.Show()
	hs.mainWindow.Restore()
	hs.mainWindow.Focus()

	// 显示所有子窗口
	if hs.windowService != nil {
		openWindows := hs.windowService.GetOpenWindows()
		for _, windowInfo := range openWindows {
			windowInfo.Window.Show()
			windowInfo.Window.Restore()
		}
	}

	hs.logger.Debug("all windows shown")
}

// keyToX11KeyCode 键名转X11键码
func (hs *HotkeyService) keyToX11KeyCode(key string) int {
	cKey := C.CString(key)
	defer C.free(unsafe.Pointer(cKey))
	return int(C.getX11Keycode(cKey))
}

// buildX11Modifiers 构建X11修饰符
func (hs *HotkeyService) buildX11Modifiers(hotkey *models.HotkeyCombo) uint {
	var modifiers uint = 0

	if hotkey.Ctrl {
		modifiers |= 0x04 // ControlMask
	}
	if hotkey.Shift {
		modifiers |= 0x01 // ShiftMask
	}
	if hotkey.Alt {
		modifiers |= 0x08 // Mod1Mask (Alt)
	}
	if hotkey.Win {
		modifiers |= 0x40 // Mod4Mask (Super/Win)
	}

	return modifiers
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
	return hs.keyToX11KeyCode(hotkey.Key) != 0
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
	// 原子地获取并调用cancel函数
	if cancel := hs.getCancelFunc(); cancel != nil {
		cancel()
	}
	hs.wg.Wait()
	C.closeX11Display()
	return nil
}
