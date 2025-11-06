//go:build linux

package linux

import (
	"fmt"
	"runtime"
	"sync"
)

// Call calls f on the main thread and blocks until f finishes.
func Call(f func()) {
	done := donePool.Get().(chan error)
	defer donePool.Put(done)

	data := funcData{fn: f, done: done}
	funcQ <- data
	if err := <-done; err != nil {
		panic(err)
	}
}

// Init initializes the functionality of running arbitrary subsequent functions be called on the main system thread.
//
// Init must be called in the main.main function.
func Init(main func()) {
	done := donePool.Get().(chan error)
	defer donePool.Put(done)

	go func() {
		defer func() {
			done <- nil
		}()
		main()
	}()

	for {
		select {
		case f := <-funcQ:
			func() {
				defer func() {
					r := recover()
					if f.done != nil {
						if r != nil {
							f.done <- fmt.Errorf("%v", r)
						} else {
							f.done <- nil
						}
					} else {
						if r != nil {
							select {
							case erroQ <- fmt.Errorf("%v", r):
							default:
							}
						}
					}
				}()
				f.fn()
			}()
		case <-done:
			return
		}
	}
}

var (
	funcQ    = make(chan funcData, runtime.GOMAXPROCS(0))
	erroQ    = make(chan error, 42)
	donePool = sync.Pool{New: func() interface{} {
		return make(chan error)
	}}
)

type funcData struct {
	fn   func()
	done chan error
}
