//go:build darwin

package hotkey

import "voidraft/internal/common/hotkey/darwin"

type platformHotkey struct {
	ph        darwin.PlatformHotkey
	keydownIn chan interface{}
	keyupIn   chan interface{}
	stopChans chan struct{} // 用于停止通道转换 goroutines
}

// Modifier represents a modifier.
type Modifier = darwin.Modifier

// All kinds of Modifiers
const (
	ModCtrl   = darwin.ModCtrl
	ModShift  = darwin.ModShift
	ModOption = darwin.ModOption
	ModCmd    = darwin.ModCmd
	ModAlt    = darwin.ModOption // Alias for ModOption (Alt key on macOS)
	ModWin    = darwin.ModCmd    // Alias for ModCmd (Cmd key is like Win key)
)

// Key represents a key.
type Key = darwin.Key

// All kinds of keys
const (
	KeySpace = darwin.KeySpace
	Key1     = darwin.Key1
	Key2     = darwin.Key2
	Key3     = darwin.Key3
	Key4     = darwin.Key4
	Key5     = darwin.Key5
	Key6     = darwin.Key6
	Key7     = darwin.Key7
	Key8     = darwin.Key8
	Key9     = darwin.Key9
	Key0     = darwin.Key0
	KeyA     = darwin.KeyA
	KeyB     = darwin.KeyB
	KeyC     = darwin.KeyC
	KeyD     = darwin.KeyD
	KeyE     = darwin.KeyE
	KeyF     = darwin.KeyF
	KeyG     = darwin.KeyG
	KeyH     = darwin.KeyH
	KeyI     = darwin.KeyI
	KeyJ     = darwin.KeyJ
	KeyK     = darwin.KeyK
	KeyL     = darwin.KeyL
	KeyM     = darwin.KeyM
	KeyN     = darwin.KeyN
	KeyO     = darwin.KeyO
	KeyP     = darwin.KeyP
	KeyQ     = darwin.KeyQ
	KeyR     = darwin.KeyR
	KeyS     = darwin.KeyS
	KeyT     = darwin.KeyT
	KeyU     = darwin.KeyU
	KeyV     = darwin.KeyV
	KeyW     = darwin.KeyW
	KeyX     = darwin.KeyX
	KeyY     = darwin.KeyY
	KeyZ     = darwin.KeyZ

	KeyReturn = darwin.KeyReturn
	KeyEscape = darwin.KeyEscape
	KeyDelete = darwin.KeyDelete
	KeyTab    = darwin.KeyTab

	KeyLeft  = darwin.KeyLeft
	KeyRight = darwin.KeyRight
	KeyUp    = darwin.KeyUp
	KeyDown  = darwin.KeyDown

	KeyF1  = darwin.KeyF1
	KeyF2  = darwin.KeyF2
	KeyF3  = darwin.KeyF3
	KeyF4  = darwin.KeyF4
	KeyF5  = darwin.KeyF5
	KeyF6  = darwin.KeyF6
	KeyF7  = darwin.KeyF7
	KeyF8  = darwin.KeyF8
	KeyF9  = darwin.KeyF9
	KeyF10 = darwin.KeyF10
	KeyF11 = darwin.KeyF11
	KeyF12 = darwin.KeyF12
	KeyF13 = darwin.KeyF13
	KeyF14 = darwin.KeyF14
	KeyF15 = darwin.KeyF15
	KeyF16 = darwin.KeyF16
	KeyF17 = darwin.KeyF17
	KeyF18 = darwin.KeyF18
	KeyF19 = darwin.KeyF19
	KeyF20 = darwin.KeyF20
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
