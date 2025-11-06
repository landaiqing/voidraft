//go:build windows

package windows

import (
	"errors"
	"fmt"
	"runtime"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
	"unsafe"
)

// Standard errors
var (
	ErrAlreadyRegistered = errors.New("hotkey: already registered")
	ErrNotRegistered     = errors.New("hotkey: not registered")
	ErrFailedToRegister  = errors.New("hotkey: failed to register")
)

type PlatformHotkey struct {
	mu         sync.Mutex
	hotkeyId   uint64
	registered bool
	funcs      chan func()
	canceled   chan struct{}
}

var hotkeyId uint64 // atomic

// Register registers a system hotkey. It returns an error if
// the registration is failed. This could be that the hotkey is
// conflict with other hotkeys.
func (ph *PlatformHotkey) Register(mods []Modifier, key Key, keydownIn, keyupIn chan<- interface{}) error {
	ph.mu.Lock()
	if ph.registered {
		ph.mu.Unlock()
		return ErrAlreadyRegistered
	}

	mod := uint8(0)
	for _, m := range mods {
		mod = mod | uint8(m)
	}

	ph.hotkeyId = atomic.AddUint64(&hotkeyId, 1)
	ph.funcs = make(chan func())
	ph.canceled = make(chan struct{})
	go ph.handle(key, keydownIn, keyupIn)

	var (
		ok   bool
		err  error
		done = make(chan struct{})
	)
	ph.funcs <- func() {
		ok, err = RegisterHotKey(0, uintptr(ph.hotkeyId), uintptr(mod), uintptr(key))
		done <- struct{}{}
	}
	<-done
	if !ok {
		close(ph.canceled)
		ph.mu.Unlock()
		return fmt.Errorf("%w: %v", ErrFailedToRegister, err)
	}
	ph.registered = true
	ph.mu.Unlock()
	return nil
}

// Unregister deregisteres a system hotkey.
func (ph *PlatformHotkey) Unregister() error {
	ph.mu.Lock()
	defer ph.mu.Unlock()
	if !ph.registered {
		return ErrNotRegistered
	}

	done := make(chan struct{})
	ph.funcs <- func() {
		UnregisterHotKey(0, uintptr(ph.hotkeyId))
		done <- struct{}{}
		close(ph.canceled)
	}
	<-done

	<-ph.canceled
	ph.registered = false
	return nil
}

const (
	// wmHotkey represents hotkey message
	wmHotkey uint32 = 0x0312
	wmQuit   uint32 = 0x0012
)

// handle handles the hotkey event loop.
// Simple, reliable approach with proper state management to prevent duplicate triggers
func (ph *PlatformHotkey) handle(key Key, keydownIn, keyupIn chan<- interface{}) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	isKeyDown := false
	ticker := time.NewTicker(time.Millisecond * 10)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// Process all pending messages
			msg := MSG{}
			for PeekMessage(&msg, 0, 0, 0) {
				if msg.Message == wmHotkey {
					// Only trigger if not already down (防止重复触发)
					if !isKeyDown {
						keydownIn <- struct{}{}
						isKeyDown = true
					}
				} else if msg.Message == wmQuit {
					return
				}
			}

			// Check for key release when key is down
			if isKeyDown && GetAsyncKeyState(int(key)) == 0 {
				keyupIn <- struct{}{}
				isKeyDown = false
			}

		case f := <-ph.funcs:
			f()

		case <-ph.canceled:
			return
		}
	}
}

// Modifier represents a modifier.
// https://docs.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-registerhotkey
type Modifier uint8

// All kinds of Modifiers
const (
	ModAlt   Modifier = 0x1
	ModCtrl  Modifier = 0x2
	ModShift Modifier = 0x4
	ModWin   Modifier = 0x8
)

// Key represents a key.
// https://docs.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes
type Key uint16

// All kinds of Keys
const (
	KeySpace Key = 0x20
	Key0     Key = 0x30
	Key1     Key = 0x31
	Key2     Key = 0x32
	Key3     Key = 0x33
	Key4     Key = 0x34
	Key5     Key = 0x35
	Key6     Key = 0x36
	Key7     Key = 0x37
	Key8     Key = 0x38
	Key9     Key = 0x39
	KeyA     Key = 0x41
	KeyB     Key = 0x42
	KeyC     Key = 0x43
	KeyD     Key = 0x44
	KeyE     Key = 0x45
	KeyF     Key = 0x46
	KeyG     Key = 0x47
	KeyH     Key = 0x48
	KeyI     Key = 0x49
	KeyJ     Key = 0x4A
	KeyK     Key = 0x4B
	KeyL     Key = 0x4C
	KeyM     Key = 0x4D
	KeyN     Key = 0x4E
	KeyO     Key = 0x4F
	KeyP     Key = 0x50
	KeyQ     Key = 0x51
	KeyR     Key = 0x52
	KeyS     Key = 0x53
	KeyT     Key = 0x54
	KeyU     Key = 0x55
	KeyV     Key = 0x56
	KeyW     Key = 0x57
	KeyX     Key = 0x58
	KeyY     Key = 0x59
	KeyZ     Key = 0x5A

	KeyReturn Key = 0x0D
	KeyEscape Key = 0x1B
	KeyDelete Key = 0x2E
	KeyTab    Key = 0x09

	KeyLeft  Key = 0x25
	KeyRight Key = 0x27
	KeyUp    Key = 0x26
	KeyDown  Key = 0x28

	KeyF1  Key = 0x70
	KeyF2  Key = 0x71
	KeyF3  Key = 0x72
	KeyF4  Key = 0x73
	KeyF5  Key = 0x74
	KeyF6  Key = 0x75
	KeyF7  Key = 0x76
	KeyF8  Key = 0x77
	KeyF9  Key = 0x78
	KeyF10 Key = 0x79
	KeyF11 Key = 0x7A
	KeyF12 Key = 0x7B
	KeyF13 Key = 0x7C
	KeyF14 Key = 0x7D
	KeyF15 Key = 0x7E
	KeyF16 Key = 0x7F
	KeyF17 Key = 0x80
	KeyF18 Key = 0x81
	KeyF19 Key = 0x82
	KeyF20 Key = 0x83
)

// Windows API wrappers

var (
	user32           = syscall.NewLazyDLL("user32")
	registerHotkey   = user32.NewProc("RegisterHotKey")
	unregisterHotkey = user32.NewProc("UnregisterHotKey")
	peekMessage      = user32.NewProc("PeekMessageW")
	getAsyncKeyState = user32.NewProc("GetAsyncKeyState")
)

// RegisterHotKey defines a system-wide hot key.
func RegisterHotKey(hwnd, id uintptr, mod uintptr, k uintptr) (bool, error) {
	ret, _, err := registerHotkey.Call(hwnd, id, mod, k)
	return ret != 0, err
}

// UnregisterHotKey frees a hot key previously registered by the calling thread.
func UnregisterHotKey(hwnd, id uintptr) (bool, error) {
	ret, _, err := unregisterHotkey.Call(hwnd, id)
	return ret != 0, err
}

// MSG contains message information from a thread's message queue.
type MSG struct {
	HWnd    uintptr
	Message uint32
	WParam  uintptr
	LParam  uintptr
	Time    uint32
	Pt      struct {
		x, y int32
	}
}

// PeekMessage checks for messages without blocking and removes them from queue
func PeekMessage(msg *MSG, hWnd uintptr, msgFilterMin, msgFilterMax uint32) bool {
	const PM_REMOVE = 0x0001
	ret, _, _ := peekMessage.Call(
		uintptr(unsafe.Pointer(msg)),
		hWnd,
		uintptr(msgFilterMin),
		uintptr(msgFilterMax),
		PM_REMOVE,
	)
	return ret != 0
}

// GetAsyncKeyState determines whether a key is up or down
func GetAsyncKeyState(keycode int) uintptr {
	ret, _, _ := getAsyncKeyState.Call(uintptr(keycode))
	return ret
}
