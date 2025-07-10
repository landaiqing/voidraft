//go:build darwin

package services

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Cocoa -framework Carbon
#include <ApplicationServices/ApplicationServices.h>
#include <Carbon/Carbon.h>

// 全局变量用于存储热键ID和回调
static EventHotKeyRef g_hotKeyRef = NULL;
static int g_hotkeyRegistered = 0;

// 热键事件处理函数
OSStatus hotKeyHandler(EventHandlerCallRef nextHandler, EventRef theEvent, void *userData) {
    // 通知Go代码热键被触发
    extern void hotkeyTriggered();
    hotkeyTriggered();
    return noErr;
}

// 注册全局热键
int registerGlobalHotkey(int keyCode, int modifiers) {
    if (g_hotkeyRegistered) {
        // 先取消注册现有热键
        UnregisterEventHotKey(g_hotKeyRef);
        g_hotkeyRegistered = 0;
    }

    EventHotKeyID hotKeyID;
    hotKeyID.signature = 'htk1';
    hotKeyID.id = 1;

    EventTypeSpec eventType;
    eventType.eventClass = kEventClassKeyboard;
    eventType.eventKind = kEventHotKeyPressed;

    InstallApplicationEventHandler(&hotKeyHandler, 1, &eventType, NULL, NULL);

    OSStatus status = RegisterEventHotKey(keyCode, modifiers, hotKeyID, GetApplicationEventTarget(), 0, &g_hotKeyRef);

    if (status == noErr) {
        g_hotkeyRegistered = 1;
        return 1;
    }
    return 0;
}

// 取消注册全局热键
int unregisterGlobalHotkey() {
    if (g_hotkeyRegistered && g_hotKeyRef != NULL) {
        OSStatus status = UnregisterEventHotKey(g_hotKeyRef);
        g_hotkeyRegistered = 0;
        g_hotKeyRef = NULL;
        return (status == noErr) ? 1 : 0;
    }
    return 1;
}

// 检查是否已注册热键
int isHotkeyRegistered() {
    return g_hotkeyRegistered;
}
*/
import "C"

import (
	"fmt"
	"sync"
	"sync/atomic"
	"voidraft/internal/models"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// 全局服务实例，用于C回调
var globalHotkeyService *HotkeyService

// HotkeyService macOS全局热键服务
type HotkeyService struct {
	logger        *log.Service
	configService *ConfigService
	app           *application.App
	mu            sync.RWMutex
	isRegistered  atomic.Bool
	currentHotkey *models.HotkeyCombo
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

// NewHotkeyService 创建新的热键服务实例
func NewHotkeyService(configService *ConfigService, logger *log.Service) *HotkeyService {
	if logger == nil {
		logger = log.New()
	}

	service := &HotkeyService{
		logger:        logger,
		configService: configService,
	}

	// 设置全局实例
	globalHotkeyService = service

	return service
}

// Initialize 初始化热键服务
func (hs *HotkeyService) Initialize(app *application.App) error {
	hs.app = app

	// 加载并应用当前配置
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

	// 转换键码和修饰符
	keyCode := hs.keyToMacKeyCode(hotkey.Key)
	if keyCode == 0 {
		return &HotkeyError{"convert_key", fmt.Errorf("unsupported key: %s", hotkey.Key)}
	}

	modifiers := hs.buildMacModifiers(hotkey)

	// 调用C函数注册热键
	result := int(C.registerGlobalHotkey(C.int(keyCode), C.int(modifiers)))
	if result == 0 {
		return &HotkeyError{"register", fmt.Errorf("failed to register hotkey")}
	}

	hs.currentHotkey = hotkey
	hs.isRegistered.Store(true)

	return nil
}

// UnregisterHotkey 取消注册全局热键
func (hs *HotkeyService) UnregisterHotkey() error {
	hs.mu.Lock()
	defer hs.mu.Unlock()

	if !hs.isRegistered.Load() {
		return nil
	}

	// 调用C函数取消注册热键
	result := int(C.unregisterGlobalHotkey())
	if result == 0 {
		return &HotkeyError{"unregister", fmt.Errorf("failed to unregister hotkey")}
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

// keyToMacKeyCode 将键名转换为macOS虚拟键码
func (hs *HotkeyService) keyToMacKeyCode(key string) int {
	keyMap := map[string]int{
		// 字母键
		"A": 0, "S": 1, "D": 2, "F": 3, "H": 4, "G": 5, "Z": 6, "X": 7,
		"C": 8, "V": 9, "B": 11, "Q": 12, "W": 13, "E": 14, "R": 15,
		"Y": 16, "T": 17, "1": 18, "2": 19, "3": 20, "4": 21, "6": 22,
		"5": 23, "9": 25, "7": 26, "8": 28, "0": 29, "O": 31, "U": 32,
		"I": 34, "P": 35, "L": 37, "J": 38, "K": 40, "N": 45, "M": 46,

		// 功能键
		"F1": 122, "F2": 120, "F3": 99, "F4": 118, "F5": 96, "F6": 97,
		"F7": 98, "F8": 100, "F9": 101, "F10": 109, "F11": 103, "F12": 111,
	}

	if keyCode, exists := keyMap[key]; exists {
		return keyCode
	}
	return 0
}

// buildMacModifiers 构建macOS修饰符
func (hs *HotkeyService) buildMacModifiers(hotkey *models.HotkeyCombo) int {
	var modifiers int = 0

	if hotkey.Ctrl {
		modifiers |= 0x1000 // controlKey
	}
	if hotkey.Shift {
		modifiers |= 0x200 // shiftKey
	}
	if hotkey.Alt {
		modifiers |= 0x800 // optionKey
	}
	if hotkey.Win {
		modifiers |= 0x100 // cmdKey
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
	return hs.keyToMacKeyCode(hotkey.Key) != 0
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
	return hs.isRegistered.Load()
}

// ToggleWindow 切换窗口显示状态
func (hs *HotkeyService) ToggleWindow() {
	if hs.app != nil {
		hs.app.EmitEvent("hotkey:toggle-window", nil)
	}
}

// ServiceShutdown 关闭热键服务
func (hs *HotkeyService) ServiceShutdown() error {
	return hs.UnregisterHotkey()
}

//export hotkeyTriggered
func hotkeyTriggered() {
	// 通过全局实例调用ToggleWindow
	if globalHotkeyService != nil && globalHotkeyService.app != nil {
		globalHotkeyService.ToggleWindow()
	}
}
