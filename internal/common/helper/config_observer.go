package helper

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/wailsapp/wails/v3/pkg/services/log"
)

const pathSeparator = '.'

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
// 支持前缀监听：注册 "generate" 可以监听 "generate.xxx"、"generate.yyy" 等所有子路径的变化
// 返回取消函数，调用后停止监听
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

// Notify 通知指定路径及其所有父路径的观察者
// 支持前缀监听：当 "generate.xxx" 变化时，同时通知监听 "generate" 的观察者
// 通知顺序：精确匹配 -> 父路径（从近到远）
func (co *ConfigObserver) Notify(path string, oldValue, newValue interface{}) {
	co.observerMu.RLock()
	callbacks := co.collectCallbacks(path)
	co.observerMu.RUnlock()

	if len(callbacks) == 0 {
		return
	}

	// 执行所有回调
	for _, callback := range callbacks {
		co.executeCallback(callback, oldValue, newValue)
	}
}

// collectCallbacks 收集指定路径及其所有父路径的观察者回调
// 调用者必须持有读锁
func (co *ConfigObserver) collectCallbacks(path string) []ObserverCallback {
	if path == "" {
		return nil
	}

	var callbacks []ObserverCallback

	// 1. 收集精确匹配的观察者
	if observers := co.observers[path]; len(observers) > 0 {
		callbacks = make([]ObserverCallback, 0, len(observers)*2)
		for _, obs := range observers {
			callbacks = append(callbacks, obs.callback)
		}
	}

	// 2. 收集父路径的观察者（从后向前遍历，避免 strings.Split 的内存分配）
	for i := len(path) - 1; i >= 0; i-- {
		if path[i] == pathSeparator {
			parentPath := path[:i]
			if observers := co.observers[parentPath]; len(observers) > 0 {
				if callbacks == nil {
					callbacks = make([]ObserverCallback, 0, len(observers))
				}
				for _, obs := range observers {
					callbacks = append(callbacks, obs.callback)
				}
			}
		}
	}

	return callbacks
}

// NotifyAll 批量通知所有匹配路径的观察者
func (co *ConfigObserver) NotifyAll(changes map[string]struct {
	OldValue interface{}
	NewValue interface{}
}) {
	if len(changes) == 0 {
		return
	}

	type callbackTask struct {
		callback ObserverCallback
		oldValue interface{}
		newValue interface{}
	}

	// 只获取一次读锁，收集所有回调
	co.observerMu.RLock()
	var tasks []callbackTask
	for path, change := range changes {
		for _, cb := range co.collectCallbacks(path) {
			tasks = append(tasks, callbackTask{
				callback: cb,
				oldValue: change.OldValue,
				newValue: change.NewValue,
			})
		}
	}
	co.observerMu.RUnlock()

	// 执行所有回调
	for _, task := range tasks {
		co.executeCallback(task.callback, task.oldValue, task.newValue)
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
