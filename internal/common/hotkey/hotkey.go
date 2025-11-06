// Package hotkey provides a high-performance, thread-safe facility to register
// system-level global hotkey shortcuts. Applications can be notified when users
// trigger hotkeys. A hotkey consists of a combination of modifier keys (Ctrl, Alt,
// Shift, etc.) and a single key.
//
// # Basic Usage
//
//	hk := hotkey.New([]hotkey.Modifier{hotkey.ModCtrl, hotkey.ModShift}, hotkey.KeyS)
//	if err := hk.Register(); err != nil {
//	    log.Fatal(err)
//	}
//	defer hk.Close()
//
//	for {
//	    select {
//	    case <-hk.Keydown():
//	        fmt.Println("Hotkey pressed!")
//	    case <-hk.Keyup():
//	        fmt.Println("Hotkey released!")
//	    }
//	}
//
// # Error Handling
//
// The package provides standardized error types for robust error handling:
//
//	if err := hk.Register(); err != nil {
//	    switch {
//	    case errors.Is(err, hotkey.ErrHotkeyConflict):
//	        // Key combination already grabbed by another application
//	    case errors.Is(err, hotkey.ErrPlatformUnavailable):
//	        // Platform support unavailable (e.g., Linux without X11)
//	    case errors.Is(err, hotkey.ErrAlreadyRegistered):
//	        // Hotkey already registered
//	    }
//	}
//
// # Platform-Specific Notes
//
// Linux (X11):
//   - Requires libx11-dev: `sudo apt install -y libx11-dev`
//   - For headless environments, use Xvfb virtual display
//   - AutoRepeat may cause repeated Keydown events - implement debouncing if needed
//   - Display connection is kept open during registration for optimal performance
//   - Conflict detection: XSetErrorHandler catches BadAccess and returns ErrHotkeyConflict
//
// macOS:
//   - For GUI applications (like Wails): works out of the box
//   - For pure CLI applications: use darwin.Init(yourMainFunc) to start event loop
//   - Advanced: use darwin.Call(func) to execute code on main thread
//   - May require Accessibility permissions in System Preferences
//   - Uses Carbon API with GCD (dispatch_get_main_queue)
//
// Windows:
//   - No additional dependencies required
//   - Keyup events simulated via GetAsyncKeyState polling (10-30ms delay)
//   - Some system hotkeys (Win+L, Ctrl+Alt+Del) are reserved
//
// # Resource Management
//
// Always use Close() to release resources:
//
//	hk := hotkey.New(mods, key)
//	defer hk.Close() // Safe to call multiple times
//
//	if err := hk.Register(); err != nil {
//	    return err
//	}
//	// ... use hotkey ...
//
// After Unregister() or Close(), you must re-obtain channel references:
//
//	hk.Unregister()
//	// ... modify hotkey ...
//	hk.Register()
//	keydownChan := hk.Keydown() // Get new channel reference
//
// # Performance
//
//   - Memory: ~1KB per hotkey
//   - Goroutines: 3 per hotkey (event loop + 2 channel converters)
//   - Latency: Keydown < 10ms, Keyup < 30ms (Windows polling overhead)
//   - Thread-safe: All public APIs use mutex protection
//
// For complete documentation and examples, see README.md in this package.
package hotkey

import (
	"errors"
	"fmt"
	"runtime"
	"sync"
)

// Standard errors
var (
	ErrAlreadyRegistered   = errors.New("hotkey: already registered")
	ErrNotRegistered       = errors.New("hotkey: not registered")
	ErrClosed              = errors.New("hotkey: hotkey has been closed")
	ErrFailedToRegister    = errors.New("hotkey: failed to register")
	ErrFailedToUnregister  = errors.New("hotkey: failed to unregister")
	ErrHotkeyConflict      = errors.New("hotkey: hotkey conflict with other applications")
	ErrPlatformUnavailable = errors.New("hotkey: platform support unavailable")
)

// Event represents a hotkey event
type Event struct{}

// Hotkey is a combination of modifiers and key to trigger an event
type Hotkey struct {
	platformHotkey

	mods []Modifier
	key  Key

	keydownIn  chan<- Event
	keydownOut <-chan Event
	keyupIn    chan<- Event
	keyupOut   <-chan Event

	// 用于停止 newEventChan goroutines
	eventChansWg sync.WaitGroup

	// 状态管理
	mu         sync.RWMutex
	registered bool
	closed     bool

	// 用于防止 Finalizer 和 Unregister 并发
	finalizerMu sync.Mutex
	finalized   bool
}

// New creates a new hotkey for the given modifiers and keycode.
func New(mods []Modifier, key Key) *Hotkey {
	hk := &Hotkey{
		mods: mods,
		key:  key,
	}

	hk.eventChansWg.Add(2)
	keydownIn, keydownOut := newEventChan(&hk.eventChansWg)
	keyupIn, keyupOut := newEventChan(&hk.eventChansWg)

	hk.keydownIn = keydownIn
	hk.keydownOut = keydownOut
	hk.keyupIn = keyupIn
	hk.keyupOut = keyupOut

	// Make sure the hotkey is unregistered when the created
	// hotkey is garbage collected.
	// Note: This is a safety net only. Users should explicitly call Unregister().
	runtime.SetFinalizer(hk, func(x interface{}) {
		hk := x.(*Hotkey)
		hk.finalizerMu.Lock()
		defer hk.finalizerMu.Unlock()

		if hk.finalized {
			return
		}
		hk.finalized = true

		// Best effort cleanup - ignore errors
		_ = hk.unregister()
	})
	return hk
}

// Register registers a combination of hotkeys. If the hotkey has
// already been registered, this function will return an error.
// Use Unregister first if you want to re-register.
func (hk *Hotkey) Register() error {
	hk.mu.Lock()
	if hk.closed {
		hk.mu.Unlock()
		return ErrClosed
	}
	if hk.registered {
		hk.mu.Unlock()
		return ErrAlreadyRegistered
	}
	hk.mu.Unlock()

	err := hk.register()
	if err == nil {
		hk.mu.Lock()
		hk.registered = true
		hk.mu.Unlock()
	}
	return err
}

// Keydown returns a channel that receives a signal when the hotkey is triggered.
func (hk *Hotkey) Keydown() <-chan Event { return hk.keydownOut }

// Keyup returns a channel that receives a signal when the hotkey is released.
func (hk *Hotkey) Keyup() <-chan Event { return hk.keyupOut }

// Unregister unregisters the hotkey. After unregister, the hotkey can be
// registered again with Register(). If you don't plan to reuse the hotkey,
// use Close() instead for proper cleanup.
func (hk *Hotkey) Unregister() error {
	hk.mu.Lock()
	if hk.closed {
		hk.mu.Unlock()
		return ErrClosed
	}
	if !hk.registered {
		hk.mu.Unlock()
		return ErrNotRegistered
	}
	hk.mu.Unlock()

	err := hk.unregister()
	if err != nil {
		return err
	}

	hk.mu.Lock()
	hk.registered = false
	hk.mu.Unlock()

	// Close old event channels and wait for goroutines to exit
	close(hk.keydownIn)
	close(hk.keyupIn)
	hk.eventChansWg.Wait()

	// Reset new event channels for potential re-registration
	hk.eventChansWg.Add(2)
	hk.keydownIn, hk.keydownOut = newEventChan(&hk.eventChansWg)
	hk.keyupIn, hk.keyupOut = newEventChan(&hk.eventChansWg)

	return nil
}

// Close unregisters the hotkey and releases all resources.
// After Close(), the hotkey cannot be used again. This is the recommended
// way to cleanup resources when you're done with the hotkey.
// Close is safe to call multiple times.
func (hk *Hotkey) Close() error {
	hk.finalizerMu.Lock()
	if hk.finalized {
		hk.finalizerMu.Unlock()
		return nil
	}
	hk.finalized = true
	hk.finalizerMu.Unlock()

	hk.mu.Lock()
	if hk.closed {
		hk.mu.Unlock()
		return nil
	}
	hk.closed = true
	wasRegistered := hk.registered
	hk.registered = false
	hk.mu.Unlock()

	var err error
	if wasRegistered {
		err = hk.unregister()
	}

	// Close event channels and wait for goroutines
	close(hk.keydownIn)
	close(hk.keyupIn)
	hk.eventChansWg.Wait()

	// Remove finalizer since we're cleaning up properly
	runtime.SetFinalizer(hk, nil)

	return err
}

// IsRegistered returns true if the hotkey is currently registered.
func (hk *Hotkey) IsRegistered() bool {
	hk.mu.RLock()
	defer hk.mu.RUnlock()
	return hk.registered && !hk.closed
}

// IsClosed returns true if the hotkey has been closed.
func (hk *Hotkey) IsClosed() bool {
	hk.mu.RLock()
	defer hk.mu.RUnlock()
	return hk.closed
}

// String returns a string representation of the hotkey.
func (hk *Hotkey) String() string {
	s := fmt.Sprintf("%v", hk.key)
	for _, mod := range hk.mods {
		s += fmt.Sprintf("+%v", mod)
	}
	return s
}

// newEventChan returns a sender and a receiver of a buffered channel
// with infinite capacity.
func newEventChan(wg *sync.WaitGroup) (chan<- Event, <-chan Event) {
	in, out := make(chan Event), make(chan Event)

	go func() {
		defer wg.Done()
		var q []Event

		for {
			e, ok := <-in
			if !ok {
				close(out)
				return
			}
			q = append(q, e)
			for len(q) > 0 {
				select {
				case out <- q[0]:
					q[0] = Event{}
					q = q[1:]
				case e, ok := <-in:
					if ok {
						q = append(q, e)
						break
					}
					for _, e := range q {
						out <- e
					}
					close(out)
					return
				}
			}
		}
	}()
	return in, out
}
