//go:build linux

package hotkey

import "voidraft/internal/common/hotkey/linux"

type platformHotkey struct {
	ph        linux.PlatformHotkey
	keydownIn chan interface{}
	keyupIn   chan interface{}
	stopChans chan struct{} // 用于停止通道转换 goroutines
}

// Modifier represents a modifier.
type Modifier = linux.Modifier

// All kinds of Modifiers
const (
	ModCtrl  = linux.ModCtrl
	ModShift = linux.ModShift
	ModAlt   = linux.ModAlt // Alias for Mod1
	ModWin   = linux.Mod4   // Super/Windows key is typically Mod4 on Linux
	Mod1     = linux.Mod1
	Mod2     = linux.Mod2
	Mod3     = linux.Mod3
	Mod4     = linux.Mod4
	Mod5     = linux.Mod5
)

// Key represents a key.
type Key = linux.Key

// All kinds of keys
const (
	KeySpace = linux.KeySpace
	Key1     = linux.Key1
	Key2     = linux.Key2
	Key3     = linux.Key3
	Key4     = linux.Key4
	Key5     = linux.Key5
	Key6     = linux.Key6
	Key7     = linux.Key7
	Key8     = linux.Key8
	Key9     = linux.Key9
	Key0     = linux.Key0
	KeyA     = linux.KeyA
	KeyB     = linux.KeyB
	KeyC     = linux.KeyC
	KeyD     = linux.KeyD
	KeyE     = linux.KeyE
	KeyF     = linux.KeyF
	KeyG     = linux.KeyG
	KeyH     = linux.KeyH
	KeyI     = linux.KeyI
	KeyJ     = linux.KeyJ
	KeyK     = linux.KeyK
	KeyL     = linux.KeyL
	KeyM     = linux.KeyM
	KeyN     = linux.KeyN
	KeyO     = linux.KeyO
	KeyP     = linux.KeyP
	KeyQ     = linux.KeyQ
	KeyR     = linux.KeyR
	KeyS     = linux.KeyS
	KeyT     = linux.KeyT
	KeyU     = linux.KeyU
	KeyV     = linux.KeyV
	KeyW     = linux.KeyW
	KeyX     = linux.KeyX
	KeyY     = linux.KeyY
	KeyZ     = linux.KeyZ

	KeyReturn = linux.KeyReturn
	KeyEscape = linux.KeyEscape
	KeyDelete = linux.KeyDelete
	KeyTab    = linux.KeyTab

	KeyLeft  = linux.KeyLeft
	KeyRight = linux.KeyRight
	KeyUp    = linux.KeyUp
	KeyDown  = linux.KeyDown

	KeyF1  = linux.KeyF1
	KeyF2  = linux.KeyF2
	KeyF3  = linux.KeyF3
	KeyF4  = linux.KeyF4
	KeyF5  = linux.KeyF5
	KeyF6  = linux.KeyF6
	KeyF7  = linux.KeyF7
	KeyF8  = linux.KeyF8
	KeyF9  = linux.KeyF9
	KeyF10 = linux.KeyF10
	KeyF11 = linux.KeyF11
	KeyF12 = linux.KeyF12
	KeyF13 = linux.KeyF13
	KeyF14 = linux.KeyF14
	KeyF15 = linux.KeyF15
	KeyF16 = linux.KeyF16
	KeyF17 = linux.KeyF17
	KeyF18 = linux.KeyF18
	KeyF19 = linux.KeyF19
	KeyF20 = linux.KeyF20
)

func (hk *Hotkey) register() error {
	// Convert channels
	hk.platformHotkey.keydownIn = make(chan interface{}, 1)
	hk.platformHotkey.keyupIn = make(chan interface{}, 1)
	hk.platformHotkey.stopChans = make(chan struct{})

	// Start goroutines to convert interface{} events to Event{}
	go func() {
		for {
			select {
			case <-hk.platformHotkey.stopChans:
				return
			case <-hk.platformHotkey.keydownIn:
				hk.keydownIn <- Event{}
			}
		}
	}()
	go func() {
		for {
			select {
			case <-hk.platformHotkey.stopChans:
				return
			case <-hk.platformHotkey.keyupIn:
				hk.keyupIn <- Event{}
			}
		}
	}()

	return hk.platformHotkey.ph.Register(hk.mods, hk.key, hk.platformHotkey.keydownIn, hk.platformHotkey.keyupIn)
}

func (hk *Hotkey) unregister() error {
	// Stop channel conversion goroutines first
	if hk.platformHotkey.stopChans != nil {
		select {
		case <-hk.platformHotkey.stopChans:
			// Already closed, do nothing
		default:
			close(hk.platformHotkey.stopChans)
		}
		hk.platformHotkey.stopChans = nil
	}

	// Then unregister the hotkey
	err := hk.platformHotkey.ph.Unregister()

	// Close conversion channels (don't close, just set to nil)
	// The goroutines will drain them when stopChans is closed
	hk.platformHotkey.keydownIn = nil
	hk.platformHotkey.keyupIn = nil

	return err
}
