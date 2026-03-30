package scheduler

import (
	"context"
	"sync"
	"time"
)

const maxBackoffMultiplier = 8

// Ticker runs a periodic job and supports restart/stop.
type Ticker struct {
	mu     sync.Mutex
	cancel context.CancelFunc
	done   chan struct{}
}

// NewTicker creates a new scheduler instance.
func NewTicker() *Ticker {
	return &Ticker{}
}

// Start runs a periodic job with exponential backoff after failures.
func (t *Ticker) Start(interval time.Duration, job func(context.Context) error) {
	if interval <= 0 || job == nil {
		return
	}

	t.Stop()

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})

	t.mu.Lock()
	t.cancel = cancel
	t.done = done
	t.mu.Unlock()

	go func() {
		defer close(done)

		failures := 0
		delay := interval

		for {
			timer := time.NewTimer(delay)
			select {
			case <-ctx.Done():
				if !timer.Stop() {
					<-timer.C
				}
				return
			case <-timer.C:
			}

			if err := job(ctx); err != nil {
				failures++
			} else {
				failures = 0
			}
			delay = nextInterval(interval, failures)
		}
	}()
}

// Stop stops the running job.
func (t *Ticker) Stop() {
	t.mu.Lock()
	cancel := t.cancel
	done := t.done
	t.cancel = nil
	t.done = nil
	t.mu.Unlock()

	if cancel != nil {
		cancel()
	}
	if done != nil {
		<-done
	}
}

// Running reports whether the scheduler is active.
func (t *Ticker) Running() bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.cancel != nil
}

// nextInterval returns the next delay after applying failure backoff.
func nextInterval(interval time.Duration, failures int) time.Duration {
	if interval <= 0 {
		return 0
	}

	multiplier := 1
	for step := 0; step < failures && multiplier < maxBackoffMultiplier; step++ {
		multiplier *= 2
	}

	return interval * time.Duration(multiplier)
}
