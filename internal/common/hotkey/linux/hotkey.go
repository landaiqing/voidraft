//go:build linux

package linux

/*
#cgo LDFLAGS: -lX11

#include <stdint.h>
#include <stdlib.h>

// DisplayContext is defined in hotkey.c
typedef struct DisplayContext DisplayContext;

int displayTest();
DisplayContext* registerHotkey(unsigned int mod, int key, int* error_code);
void unregisterHotkey(DisplayContext* ctx);
int waitHotkeyEvent(DisplayContext* ctx, uintptr_t hkhandle);
*/
import "C"
import (
	"context"
	"errors"
	"fmt"
	"runtime"
	"runtime/cgo"
	"sync"
)

const errmsg = `Failed to initialize the X11 display. Install the following dependency may help:

	apt install -y libx11-dev
If you are in an environment without a frame buffer (e.g., cloud server), 
you may also need to install xvfb:
	apt install -y xvfb
and initialize a virtual frame buffer:
	Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &
	export DISPLAY=:99.0
`

var x11Available bool

func init() {
	x11Available = C.displayTest() == 0
}

func checkX11() error {
	if !x11Available {
		return fmt.Errorf("%w: %s", ErrPlatformUnavailable, errmsg)
	}
	return nil
}

// Standard errors
var (
	ErrAlreadyRegistered   = errors.New("hotkey: already registered")
	ErrNotRegistered       = errors.New("hotkey: not registered")
	ErrPlatformUnavailable = errors.New("hotkey: platform support unavailable")
	ErrHotkeyConflict      = errors.New("hotkey: hotkey conflict with other applications")
	ErrFailedToRegister    = errors.New("hotkey: failed to register")
)

type PlatformHotkey struct {
	mu         sync.Mutex
	registered bool
	ctx        context.Context
	cancel     context.CancelFunc
	canceled   chan struct{}
	cgoHandle  cgo.Handle        // 改名避免与方法名冲突
	displayCtx *C.DisplayContext // Persistent X11 display connection
}

func (ph *PlatformHotkey) Register(mods []Modifier, key Key, keydownIn, keyupIn chan<- interface{}) error {
	// Check X11 availability first
	if err := checkX11(); err != nil {
		return err
	}

	ph.mu.Lock()
	if ph.registered {
		ph.mu.Unlock()
		return ErrAlreadyRegistered
	}

	// Calculate combined modifier
	var mod Modifier
	for _, m := range mods {
		mod = mod | m
	}

	// Try to register the hotkey and check for conflicts
	var errorCode C.int
	displayCtx := C.registerHotkey(C.uint(mod), C.int(key), &errorCode)
	if displayCtx == nil {
		ph.mu.Unlock()
		switch errorCode {
		case -1:
			return fmt.Errorf("%w: key combination already grabbed by another application", ErrHotkeyConflict)
		default:
			return fmt.Errorf("%w: failed to open X11 display or register hotkey", ErrFailedToRegister)
		}
	}

	ph.registered = true
	ph.displayCtx = displayCtx
	ph.ctx, ph.cancel = context.WithCancel(context.Background())
	ph.canceled = make(chan struct{})

	// Store callbacks info
	callbacks := &callbackData{
		keydownIn: keydownIn,
		keyupIn:   keyupIn,
	}
	ph.cgoHandle = cgo.NewHandle(callbacks)
	ph.mu.Unlock()

	go ph.eventLoop()
	return nil
}

func (ph *PlatformHotkey) Unregister() error {
	ph.mu.Lock()
	defer ph.mu.Unlock()
	if !ph.registered {
		return ErrNotRegistered
	}
	ph.cancel()
	ph.registered = false
	<-ph.canceled

	// Clean up CGO handle and X11 display
	ph.cgoHandle.Delete()
	if ph.displayCtx != nil {
		C.unregisterHotkey(ph.displayCtx)
		ph.displayCtx = nil
	}

	return nil
}

// eventLoop continuously waits for hotkey events on the registered display.
// The display connection is kept open for the lifetime of the registration,
// avoiding repeated XOpenDisplay/XCloseDisplay calls.
func (ph *PlatformHotkey) eventLoop() {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	for {
		select {
		case <-ph.ctx.Done():
			close(ph.canceled)
			return
		default:
			// Wait for the next event on the persistent display connection
			result := C.waitHotkeyEvent(ph.displayCtx, C.uintptr_t(ph.cgoHandle))
			// result: 1 = KeyPress, 2 = KeyRelease, 0 = other event, -1 = error
			if result < 0 {
				// Error occurred, likely display connection issue
				// The context will be canceled by Unregister, so we'll exit
				continue
			}
			// Events are handled by the C callback (hotkeyDown/hotkeyUp)
		}
	}
}

type callbackData struct {
	keydownIn chan<- interface{}
	keyupIn   chan<- interface{}
}

//export hotkeyDown
func hotkeyDown(h uintptr) {
	cb := cgo.Handle(h).Value().(*callbackData)
	cb.keydownIn <- struct{}{}
}

//export hotkeyUp
func hotkeyUp(h uintptr) {
	cb := cgo.Handle(h).Value().(*callbackData)
	cb.keyupIn <- struct{}{}
}

// Modifier represents a modifier.
type Modifier uint32

// All kinds of Modifiers
// See /usr/include/X11/X.h
const (
	ModCtrl  Modifier = (1 << 2)
	ModShift Modifier = (1 << 0)
	Mod1     Modifier = (1 << 3)
	Mod2     Modifier = (1 << 4)
	Mod3     Modifier = (1 << 5)
	Mod4     Modifier = (1 << 6)
	Mod5     Modifier = (1 << 7)

	// ModAlt is typically mapped to Mod1 on most Linux systems
	ModAlt = Mod1
)

// Key represents a key.
// See /usr/include/X11/keysymdef.h
type Key uint16

// All kinds of keys
const (
	KeySpace Key = 0x0020
	Key1     Key = 0x0030
	Key2     Key = 0x0031
	Key3     Key = 0x0032
	Key4     Key = 0x0033
	Key5     Key = 0x0034
	Key6     Key = 0x0035
	Key7     Key = 0x0036
	Key8     Key = 0x0037
	Key9     Key = 0x0038
	Key0     Key = 0x0039
	KeyA     Key = 0x0061
	KeyB     Key = 0x0062
	KeyC     Key = 0x0063
	KeyD     Key = 0x0064
	KeyE     Key = 0x0065
	KeyF     Key = 0x0066
	KeyG     Key = 0x0067
	KeyH     Key = 0x0068
	KeyI     Key = 0x0069
	KeyJ     Key = 0x006a
	KeyK     Key = 0x006b
	KeyL     Key = 0x006c
	KeyM     Key = 0x006d
	KeyN     Key = 0x006e
	KeyO     Key = 0x006f
	KeyP     Key = 0x0070
	KeyQ     Key = 0x0071
	KeyR     Key = 0x0072
	KeyS     Key = 0x0073
	KeyT     Key = 0x0074
	KeyU     Key = 0x0075
	KeyV     Key = 0x0076
	KeyW     Key = 0x0077
	KeyX     Key = 0x0078
	KeyY     Key = 0x0079
	KeyZ     Key = 0x007a

	KeyReturn Key = 0xff0d
	KeyEscape Key = 0xff1b
	KeyDelete Key = 0xffff
	KeyTab    Key = 0xff1b

	KeyLeft  Key = 0xff51
	KeyRight Key = 0xff53
	KeyUp    Key = 0xff52
	KeyDown  Key = 0xff54

	KeyF1  Key = 0xffbe
	KeyF2  Key = 0xffbf
	KeyF3  Key = 0xffc0
	KeyF4  Key = 0xffc1
	KeyF5  Key = 0xffc2
	KeyF6  Key = 0xffc3
	KeyF7  Key = 0xffc4
	KeyF8  Key = 0xffc5
	KeyF9  Key = 0xffc6
	KeyF10 Key = 0xffc7
	KeyF11 Key = 0xffc8
	KeyF12 Key = 0xffc9
	KeyF13 Key = 0xffca
	KeyF14 Key = 0xffcb
	KeyF15 Key = 0xffcc
	KeyF16 Key = 0xffcd
	KeyF17 Key = 0xffce
	KeyF18 Key = 0xffcf
	KeyF19 Key = 0xffd0
	KeyF20 Key = 0xffd1
)
