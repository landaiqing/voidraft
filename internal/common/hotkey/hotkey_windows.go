//go:build windows

package hotkey

import "voidraft/internal/common/hotkey/windows"

type platformHotkey struct {
	ph        windows.PlatformHotkey
	keydownIn chan interface{}
	keyupIn   chan interface{}
	stopChans chan struct{} // 用于停止通道转换 goroutines
}

// Modifier represents a modifier.
type Modifier = windows.Modifier

// All kinds of Modifiers
const (
	ModAlt   = windows.ModAlt
	ModCtrl  = windows.ModCtrl
	ModShift = windows.ModShift
	ModWin   = windows.ModWin
)

// Key represents a key.
type Key = windows.Key

// All kinds of Keys
const (
	KeySpace = windows.KeySpace
	Key0     = windows.Key0
	Key1     = windows.Key1
	Key2     = windows.Key2
	Key3     = windows.Key3
	Key4     = windows.Key4
	Key5     = windows.Key5
	Key6     = windows.Key6
	Key7     = windows.Key7
	Key8     = windows.Key8
	Key9     = windows.Key9
	KeyA     = windows.KeyA
	KeyB     = windows.KeyB
	KeyC     = windows.KeyC
	KeyD     = windows.KeyD
	KeyE     = windows.KeyE
	KeyF     = windows.KeyF
	KeyG     = windows.KeyG
	KeyH     = windows.KeyH
	KeyI     = windows.KeyI
	KeyJ     = windows.KeyJ
	KeyK     = windows.KeyK
	KeyL     = windows.KeyL
	KeyM     = windows.KeyM
	KeyN     = windows.KeyN
	KeyO     = windows.KeyO
	KeyP     = windows.KeyP
	KeyQ     = windows.KeyQ
	KeyR     = windows.KeyR
	KeyS     = windows.KeyS
	KeyT     = windows.KeyT
	KeyU     = windows.KeyU
	KeyV     = windows.KeyV
	KeyW     = windows.KeyW
	KeyX     = windows.KeyX
	KeyY     = windows.KeyY
	KeyZ     = windows.KeyZ

	KeyReturn = windows.KeyReturn
	KeyEscape = windows.KeyEscape
	KeyDelete = windows.KeyDelete
	KeyTab    = windows.KeyTab

	KeyLeft  = windows.KeyLeft
	KeyRight = windows.KeyRight
	KeyUp    = windows.KeyUp
	KeyDown  = windows.KeyDown

	KeyF1  = windows.KeyF1
	KeyF2  = windows.KeyF2
	KeyF3  = windows.KeyF3
	KeyF4  = windows.KeyF4
	KeyF5  = windows.KeyF5
	KeyF6  = windows.KeyF6
	KeyF7  = windows.KeyF7
	KeyF8  = windows.KeyF8
	KeyF9  = windows.KeyF9
	KeyF10 = windows.KeyF10
	KeyF11 = windows.KeyF11
	KeyF12 = windows.KeyF12
	KeyF13 = windows.KeyF13
	KeyF14 = windows.KeyF14
	KeyF15 = windows.KeyF15
	KeyF16 = windows.KeyF16
	KeyF17 = windows.KeyF17
	KeyF18 = windows.KeyF18
	KeyF19 = windows.KeyF19
	KeyF20 = windows.KeyF20
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
