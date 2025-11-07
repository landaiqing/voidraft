package services

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// ObserverCallback 观察者回调函数
type ObserverCallback func(oldValue, newValue interface{})

// CancelFunc 取消订阅函数
// 调用此函数可以取消对配置的监听
type CancelFunc func()

// observer 内部观察者结构
type observer struct {
	id       string           // 唯一ID
	path     string           // 监听的配置路径
	callback ObserverCallback // 回调函数
}

// ConfigObserver 配置观察者系统
type ConfigObserver struct {
	observers      map[string][]*observer // 路径 -> 观察者列表
	observerMu     sync.RWMutex           // 观察者锁
	nextObserverID atomic.Uint64          // 观察者ID生成器
	workerPool     chan struct{}          // Goroutine 池，限制并发数
	logger         *log.LogService        // 日志服务
	ctx            context.Context        // 全局 context
	cancel         context.CancelFunc     // 取消函数
	wg             sync.WaitGroup         // 等待组，用于优雅关闭
}

// NewConfigObserver 创建新的配置观察者系统
func NewConfigObserver(logger *log.LogService) *ConfigObserver {
	ctx, cancel := context.WithCancel(context.Background())
	return &ConfigObserver{
		observers:  make(map[string][]*observer),
		workerPool: make(chan struct{}, 100), // 限制最多100个并发回调
		logger:     logger,
		ctx:        ctx,
		cancel:     cancel,
	}
}

// Watch 注册配置变更监听器
func (co *ConfigObserver) Watch(path string, callback ObserverCallback) CancelFunc {
	// 生成唯一ID
	id := fmt.Sprintf("obs_%d", co.nextObserverID.Add(1))

	obs := &observer{
		id:       id,
		path:     path,
		callback: callback,
	}

	// 添加到观察者列表
	co.observerMu.Lock()
	co.observers[path] = append(co.observers[path], obs)
	co.observerMu.Unlock()

	// 返回取消函数
	return func() {
		co.removeObserver(path, id)
	}
}

// WatchWithContext 使用 Context 注册监听器，Context 取消时自动清理
func (co *ConfigObserver) WatchWithContext(ctx context.Context, path string, callback ObserverCallback) {
	cancel := co.Watch(path, callback)
	go func() {
		select {
		case <-ctx.Done():
			cancel()
		case <-co.ctx.Done():
			return
		}
	}()
}

// removeObserver 移除观察者
func (co *ConfigObserver) removeObserver(path, id string) {
	co.observerMu.Lock()
	defer co.observerMu.Unlock()

	observers := co.observers[path]
	for i, obs := range observers {
		if obs.id == id {
			// 从切片中移除
			co.observers[path] = append(observers[:i], observers[i+1:]...)
			break
		}
	}

	// 如果没有观察者了，删除整个条目
	if len(co.observers[path]) == 0 {
		delete(co.observers, path)
	}
}

// Notify 通知指定路径的所有观察者
func (co *ConfigObserver) Notify(path string, oldValue, newValue interface{}) {
	// 获取该路径的所有观察者（拷贝以避免并发问题）
	co.observerMu.RLock()
	observers := co.observers[path]
	if len(observers) == 0 {
		co.observerMu.RUnlock()
		return
	}

	// 拷贝观察者列表
	callbacks := make([]ObserverCallback, len(observers))
	for i, obs := range observers {
		callbacks[i] = obs.callback
	}
	co.observerMu.RUnlock()

	// 在独立 goroutine 中执行回调
	for _, callback := range callbacks {
		co.executeCallback(callback, oldValue, newValue)
	}
}

// NotifyAll 通知所有匹配前缀的观察者
func (co *ConfigObserver) NotifyAll(changes map[string]struct {
	OldValue interface{}
	NewValue interface{}
}) {
	for path, change := range changes {
		co.Notify(path, change.OldValue, change.NewValue)
	}
}

// executeCallback 执行回调函数
func (co *ConfigObserver) executeCallback(callback ObserverCallback, oldValue, newValue interface{}) {
	co.wg.Add(1)

	// 获取 worker（限制并发数）
	select {
	case co.workerPool <- struct{}{}:
		// 成功获取 worker
	case <-co.ctx.Done():
		// 系统正在关闭
		co.wg.Done()
		return
	}

	go func() {
		defer co.wg.Done()
		defer func() { <-co.workerPool }() // 释放 worker

		// Panic 恢复
		defer func() {
			recover()
		}()

		// 创建带超时的 context
		ctx, cancel := context.WithTimeout(co.ctx, 5*time.Second)
		defer cancel()

		// 在 channel 中执行回调，以便可以超时控制
		done := make(chan struct{})
		go func() {
			defer close(done)
			callback(oldValue, newValue)
		}()

		// 等待完成或超时
		select {
		case <-done:
			// 正常完成
		case <-ctx.Done():
		}
	}()
}

// Clear 清空所有观察者
func (co *ConfigObserver) Clear() {
	co.observerMu.Lock()
	co.observers = make(map[string][]*observer)
	co.observerMu.Unlock()

}

// Shutdown 关闭观察者系统
func (co *ConfigObserver) Shutdown() {
	// 取消 context
	co.cancel()

	// 等待所有回调完成
	done := make(chan struct{})
	go func() {
		co.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(10 * time.Second):
	}
	// 清空所有观察者
	co.Clear()
}
