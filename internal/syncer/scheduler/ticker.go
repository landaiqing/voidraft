package scheduler

import (
	"context"
	"sync"
	"time"
)

// Ticker 提供可重启的周期任务调度器。
type Ticker struct {
	mu     sync.Mutex
	cancel context.CancelFunc
	done   chan struct{}
}

// NewTicker 创建新的调度器实例。
func NewTicker() *Ticker {
	return &Ticker{}
}

// Start 启动周期任务。
func (t *Ticker) Start(interval time.Duration, job func(context.Context) error) {
	if interval <= 0 || job == nil {
		return
	}

	t.Stop()

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	ticker := time.NewTicker(interval)

	t.mu.Lock()
	t.cancel = cancel
	t.done = done
	t.mu.Unlock()

	go func() {
		defer close(done)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				_ = job(ctx)
			}
		}
	}()
}

// Stop 停止当前任务。
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

// Running 返回调度器是否正在运行。
func (t *Ticker) Running() bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.cancel != nil
}
