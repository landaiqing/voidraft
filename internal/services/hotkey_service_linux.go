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
	"fmt"
	"sync"
	"time"
	"unsafe"
	"voidraft/internal/models"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// HotkeyService Linux全局热键服务
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

	// 初始化X11显示
	if int(C.initX11Display()) == 0 {
		return &HotkeyError{Operation: "init_x11", Err: fmt.Errorf("failed to initialize X11 display")}
	}

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

	hs.logger.Info("Hotkey: Linux service initialized")
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

	hs.logger.Info("Hotkey: Registering global hotkey on Linux",
		"ctrl", hotkey.Ctrl,
		"shift", hotkey.Shift,
		"alt", hotkey.Alt,
		"win", hotkey.Win,
		"key", hotkey.Key)

	// 转换键码和修饰符
	keyCode := hs.keyToX11KeyCode(hotkey.Key)
	if keyCode == 0 {
		return &HotkeyError{Operation: "convert_key", Err: fmt.Errorf("unsupported key: %s", hotkey.Key)}
	}

	modifiers := hs.buildX11Modifiers(hotkey)

	// 调用C函数注册热键
	result := int(C.registerGlobalHotkey(C.int(keyCode), C.uint(modifiers)))
	if result == 0 {
		return &HotkeyError{Operation: "register_hotkey", Err: fmt.Errorf("failed to register hotkey")}
	}

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

	hs.logger.Info("Hotkey: Successfully registered global hotkey on Linux")
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

	hs.logger.Info("Hotkey: Unregistering global hotkey on Linux")

	// 停止监听
	if hs.stopChan != nil {
		close(hs.stopChan)
		hs.logger.Debug("Hotkey: Waiting for listener goroutine to stop")
		hs.wg.Wait()
		hs.logger.Debug("Hotkey: Listener goroutine stopped")
	}

	// 调用C函数取消注册热键
	result := int(C.unregisterGlobalHotkey())
	if result == 0 {
		return &HotkeyError{Operation: "unregister_hotkey", Err: fmt.Errorf("failed to unregister hotkey")}
	}

	// 重置状态
	hs.currentHotkey = nil
	hs.isRegistered = false
	hs.running = false
	hs.stopChan = nil

	hs.logger.Info("Hotkey: Successfully unregistered global hotkey on Linux")
	return nil
}

// UpdateHotkey 更新热键配置
func (hs *HotkeyService) UpdateHotkey(enable bool, hotkey *models.HotkeyCombo) error {
	hs.logger.Info("Hotkey: === UpdateHotkey called (Linux) ===",
		"enable", enable,
		"ctrl", hotkey.Ctrl,
		"shift", hotkey.Shift,
		"alt", hotkey.Alt,
		"win", hotkey.Win,
		"key", hotkey.Key)

	if enable {
		// 启用热键：直接注册新热键（RegisterHotkey 会处理取消旧热键）
		err := hs.RegisterHotkey(hotkey)
		if err != nil {
			hs.logger.Error("Hotkey: Failed to register new hotkey", "error", err)
			return err
		}
		hs.logger.Info("Hotkey: Successfully updated and registered new hotkey on Linux")
		return nil
	} else {
		// 禁用热键：取消注册
		err := hs.UnregisterHotkey()
		if err != nil {
			hs.logger.Error("Hotkey: Failed to unregister hotkey", "error", err)
			return err
		}
		hs.logger.Info("Hotkey: Successfully disabled hotkey on Linux")
		return nil
	}
}

// ToggleWindow 切换窗口显示/隐藏
func (hs *HotkeyService) ToggleWindow() {
	if hs.app == nil {
		hs.logger.Warning("Hotkey: App is nil, cannot toggle")
		return
	}

	// 发送事件到前端，让前端处理窗口切换
	hs.app.EmitEvent("hotkey:toggle-window", nil)
	hs.logger.Debug("Hotkey: Emitted toggle window event (Linux)")
}

// hotkeyListener 热键监听器goroutine
func (hs *HotkeyService) hotkeyListener(hotkey *models.HotkeyCombo, readyChan chan struct{}) {
	defer hs.wg.Done()

	hs.logger.Debug("Hotkey: Starting Linux X11 hotkey listener")

	// 检查间隔（100ms）
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	// 标记是否已经发送ready信号，确保只发送一次
	readySent := false

	for {
		select {
		case <-hs.stopChan:
			hs.logger.Debug("Hotkey: Stopping Linux X11 hotkey listener")
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

			// 检查热键事件
			if int(C.checkHotkeyEvent()) == 1 {
				hs.logger.Debug("Hotkey: Global hotkey triggered via Linux X11")
				hs.ToggleWindow()
			}
		}
	}
}

// keyToX11KeyCode 将键名转换为X11键码
func (hs *HotkeyService) keyToX11KeyCode(key string) int {
	// 将Go字符串转换为C字符串
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
	return hs.keyToX11KeyCode(hotkey.Key) != 0
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

// ServiceShutdown 关闭热键服务
func (hs *HotkeyService) ServiceShutdown() error {
	hs.mu.Lock()
	defer hs.mu.Unlock()

	if hs.isRegistered {
		err := hs.unregisterHotkeyInternal()
		if err != nil {
			hs.logger.Error("Hotkey: Failed to unregister hotkey on shutdown", "error", err)
		}
	}

	// 关闭X11显示
	C.closeX11Display()

	hs.logger.Info("Hotkey: Linux service shutdown completed")
	return nil
}
