package services

import (
	"sync"
	"testing"
	"time"
	"voidraft/internal/models"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// MockWindow 模拟窗口对象
type MockWindow struct {
	x, y int
	w, h int
	mu   sync.Mutex
}

func (mw *MockWindow) Position() (int, int) {
	mw.mu.Lock()
	defer mw.mu.Unlock()
	return mw.x, mw.y
}

func (mw *MockWindow) Size() (int, int) {
	mw.mu.Lock()
	defer mw.mu.Unlock()
	return mw.w, mw.h
}

func (mw *MockWindow) SetPosition(x, y int) {
	mw.mu.Lock()
	defer mw.mu.Unlock()
	mw.x, mw.y = x, y
}

// 创建测试用的服务实例
func createTestService() *WindowSnapService {
	logger := log.New()

	service := &WindowSnapService{
		logger:             logger,
		configService:      nil, // 测试中不需要实际的配置服务
		windowHelper:       NewWindowHelper(),
		snapEnabled:        true,
		baseThresholdRatio: 0.025,
		minThreshold:       8,
		maxThreshold:       40,
		managedWindows:     make(map[int64]*models.WindowInfo),
		windowRefs:         make(map[int64]*application.WebviewWindow),
		windowSizeCache:    make(map[int64][2]int),
		isUpdatingPosition: make(map[int64]bool),
		windowMoveUnhooks:  make(map[int64]func()),
		lastMainWindowPos:  models.WindowPosition{X: 100, Y: 100},
		lastMainWindowSize: [2]int{800, 600},
	}

	return service
}

// TestDebounceThreshold 测试防抖阈值常量
func TestDebounceThreshold(t *testing.T) {
	if debounceThreshold != 30*time.Millisecond {
		t.Errorf("debounceThreshold = %v, want %v", debounceThreshold, 30*time.Millisecond)
	}

	if dragDetectionThreshold != 40*time.Millisecond {
		t.Errorf("dragDetectionThreshold = %v, want %v", dragDetectionThreshold, 40*time.Millisecond)
	}

	// 确保拖拽阈值大于防抖阈值
	if dragDetectionThreshold <= debounceThreshold {
		t.Error("dragDetectionThreshold should be greater than debounceThreshold")
	}
}

// TestCalculateAdaptiveThreshold 测试自适应阈值计算
func TestCalculateAdaptiveThreshold(t *testing.T) {
	tests := []struct {
		name       string
		mainWidth  int
		wantMin    int
		wantMax    int
		wantResult int
	}{
		{
			name:       "小窗口",
			mainWidth:  400,
			wantMin:    8,
			wantMax:    40,
			wantResult: 10, // 400 * 0.025 = 10
		},
		{
			name:       "中等窗口",
			mainWidth:  1920,
			wantMin:    8,
			wantMax:    40,
			wantResult: 40, // 1920 * 0.025 = 48, 但限制在 40
		},
		{
			name:       "超小窗口",
			mainWidth:  200,
			wantMin:    8,
			wantMax:    40,
			wantResult: 8, // 200 * 0.025 = 5, 但最小是 8
		},
		{
			name:       "零宽度",
			mainWidth:  0,
			wantMin:    8,
			wantMax:    40,
			wantResult: 8, // 应返回最小值
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := createTestService()
			service.lastMainWindowSize = [2]int{tt.mainWidth, 600}

			result := service.calculateAdaptiveThreshold()

			if result != tt.wantResult {
				t.Errorf("calculateAdaptiveThreshold() = %v, want %v", result, tt.wantResult)
			}

			if result < tt.wantMin {
				t.Errorf("result %v is less than minimum %v", result, tt.wantMin)
			}

			if result > tt.wantMax {
				t.Errorf("result %v is greater than maximum %v", result, tt.wantMax)
			}
		})
	}
}

// TestWindowSizeCache 测试窗口尺寸缓存
func TestWindowSizeCache(t *testing.T) {
	service := createTestService()

	// 初始化缓存
	service.windowSizeCache[1] = [2]int{640, 480}

	// 测试缓存读取
	service.mu.Lock()
	if size, exists := service.windowSizeCache[1]; !exists {
		t.Error("Cache should exist for documentID 1")
	} else if size[0] != 640 || size[1] != 480 {
		t.Errorf("Cache size = [%d, %d], want [640, 480]", size[0], size[1])
	}
	service.mu.Unlock()

	// 测试缓存不存在的情况
	service.mu.Lock()
	if _, exists := service.windowSizeCache[999]; exists {
		t.Error("Cache should not exist for documentID 999")
	}
	service.mu.Unlock()
}

// TestSetSnapEnabled 测试启用/禁用吸附
func TestSetSnapEnabled(t *testing.T) {
	service := createTestService()

	// 初始状态
	if !service.snapEnabled {
		t.Error("Initial snapEnabled should be true")
	}

	// 禁用吸附
	service.SetSnapEnabled(false)
	if service.snapEnabled {
		t.Error("snapEnabled should be false after SetSnapEnabled(false)")
	}

	// 启用吸附
	service.SetSnapEnabled(true)
	if !service.snapEnabled {
		t.Error("snapEnabled should be true after SetSnapEnabled(true)")
	}
}

// TestUnregisterWindow 测试窗口注销
func TestUnregisterWindow(t *testing.T) {
	service := createTestService()

	// 模拟注册窗口
	documentID := int64(1)
	service.managedWindows[documentID] = &models.WindowInfo{DocumentID: documentID}
	service.windowSizeCache[documentID] = [2]int{640, 480}
	service.isUpdatingPosition[documentID] = false

	// 模拟事件清理函数
	cleanupCalled := false
	service.windowMoveUnhooks[documentID] = func() {
		cleanupCalled = true
	}

	// 验证已注册
	service.mu.RLock()
	if _, exists := service.managedWindows[documentID]; !exists {
		t.Error("Window should be registered")
	}
	service.mu.RUnlock()

	// 注销窗口
	service.UnregisterWindow(documentID)

	// 验证已清理
	service.mu.RLock()
	if _, exists := service.managedWindows[documentID]; exists {
		t.Error("managedWindows should be cleaned up")
	}
	if _, exists := service.windowSizeCache[documentID]; exists {
		t.Error("windowSizeCache should be cleaned up")
	}
	if _, exists := service.isUpdatingPosition[documentID]; exists {
		t.Error("isUpdatingPosition should be cleaned up")
	}
	if _, exists := service.windowMoveUnhooks[documentID]; exists {
		t.Error("windowMoveUnhooks should be cleaned up")
	}
	service.mu.RUnlock()

	// 验证清理函数被调用
	if !cleanupCalled {
		t.Error("Cleanup function should have been called")
	}
}

// TestCleanup 测试资源清理
func TestCleanup(t *testing.T) {
	service := createTestService()

	// 添加一些数据
	service.managedWindows[1] = &models.WindowInfo{DocumentID: 1}
	service.managedWindows[2] = &models.WindowInfo{DocumentID: 2}
	service.windowSizeCache[1] = [2]int{640, 480}
	service.windowSizeCache[2] = [2]int{800, 600}
	service.isUpdatingPosition[1] = false
	service.isUpdatingPosition[2] = true

	// 添加事件清理函数
	cleanup1Called := false
	cleanup2Called := false
	service.windowMoveUnhooks[1] = func() {
		cleanup1Called = true
	}
	service.windowMoveUnhooks[2] = func() {
		cleanup2Called = true
	}

	// 执行清理
	service.Cleanup()

	// 验证所有map都被重置
	service.mu.RLock()
	defer service.mu.RUnlock()

	if len(service.managedWindows) != 0 {
		t.Errorf("managedWindows length = %d, want 0", len(service.managedWindows))
	}
	if len(service.windowSizeCache) != 0 {
		t.Errorf("windowSizeCache length = %d, want 0", len(service.windowSizeCache))
	}
	if len(service.isUpdatingPosition) != 0 {
		t.Errorf("isUpdatingPosition length = %d, want 0", len(service.isUpdatingPosition))
	}
	if len(service.windowMoveUnhooks) != 0 {
		t.Errorf("windowMoveUnhooks length = %d, want 0", len(service.windowMoveUnhooks))
	}

	// 验证清理函数都被调用
	if !cleanup1Called {
		t.Error("Cleanup function for window 1 should have been called")
	}
	if !cleanup2Called {
		t.Error("Cleanup function for window 2 should have been called")
	}
}

// TestEventCleanupOnUnregister 测试事件清理功能
func TestEventCleanupOnUnregister(t *testing.T) {
	service := createTestService()

	// 模拟多个窗口注册
	documentIDs := []int64{1, 2, 3, 4, 5}
	cleanupCounters := make(map[int64]int)

	for _, id := range documentIDs {
		service.managedWindows[id] = &models.WindowInfo{DocumentID: id}
		service.windowSizeCache[id] = [2]int{640, 480}

		// 为每个窗口添加清理函数
		localID := id // 捕获循环变量
		service.windowMoveUnhooks[id] = func() {
			cleanupCounters[localID]++
		}
	}

	// 验证初始状态
	if len(service.windowMoveUnhooks) != len(documentIDs) {
		t.Errorf("Expected %d cleanup hooks, got %d", len(documentIDs), len(service.windowMoveUnhooks))
	}

	// 逐个注销窗口
	for _, id := range documentIDs[:3] { // 注销前3个
		service.UnregisterWindow(id)
	}

	// 验证部分清理
	service.mu.RLock()
	remainingHooks := len(service.windowMoveUnhooks)
	service.mu.RUnlock()

	if remainingHooks != 2 {
		t.Errorf("Expected 2 remaining hooks, got %d", remainingHooks)
	}

	// 验证清理函数被调用
	for _, id := range documentIDs[:3] {
		if cleanupCounters[id] != 1 {
			t.Errorf("Cleanup for window %d should have been called once, got %d", id, cleanupCounters[id])
		}
	}

	// 验证未注销的窗口清理函数未被调用
	for _, id := range documentIDs[3:] {
		if cleanupCounters[id] != 0 {
			t.Errorf("Cleanup for window %d should not have been called, got %d", id, cleanupCounters[id])
		}
	}

	t.Log("Event cleanup test passed")
}

// TestEventCleanupNilSafety 测试空清理函数的安全性
func TestEventCleanupNilSafety(t *testing.T) {
	service := createTestService()

	documentID := int64(1)
	service.managedWindows[documentID] = &models.WindowInfo{DocumentID: documentID}
	// 故意不设置清理函数

	// 注销窗口不应该panic
	defer func() {
		if r := recover(); r != nil {
			t.Errorf("UnregisterWindow panicked with nil cleanup function: %v", r)
		}
	}()

	service.UnregisterWindow(documentID)

	t.Log("Nil cleanup function handled safely")
}

// ========== 并发测试 ==========

// TestConcurrentRegisterUnregister 测试并发注册和注销窗口
func TestConcurrentRegisterUnregister(t *testing.T) {
	service := createTestService()
	const goroutines = 100
	const iterations = 50

	var wg sync.WaitGroup
	wg.Add(goroutines * 2)

	// 并发注册
	for i := 0; i < goroutines; i++ {
		go func(id int) {
			defer wg.Done()
			for j := 0; j < iterations; j++ {
				documentID := int64(id*iterations + j)
				windowInfo := &models.WindowInfo{
					DocumentID: documentID,
					IsSnapped:  false,
					LastPos:    models.WindowPosition{X: 0, Y: 0},
					MoveTime:   time.Now(),
				}
				service.mu.Lock()
				service.managedWindows[documentID] = windowInfo
				service.windowSizeCache[documentID] = [2]int{640, 480}
				service.mu.Unlock()
			}
		}(i)
	}

	// 并发注销
	for i := 0; i < goroutines; i++ {
		go func(id int) {
			defer wg.Done()
			time.Sleep(10 * time.Millisecond) // 让注册先执行一点
			for j := 0; j < iterations; j++ {
				documentID := int64(id*iterations + j)
				service.UnregisterWindow(documentID)
			}
		}(i)
	}

	wg.Wait()

	// 验证数据一致性
	service.mu.RLock()
	defer service.mu.RUnlock()

	if len(service.managedWindows) != len(service.windowSizeCache) {
		t.Errorf("managedWindows length (%d) != windowSizeCache length (%d)",
			len(service.managedWindows), len(service.windowSizeCache))
	}
}

// TestConcurrentSetSnapEnabled 测试并发启用/禁用吸附
func TestConcurrentSetSnapEnabled(t *testing.T) {
	service := createTestService()
	const goroutines = 50

	var wg sync.WaitGroup
	wg.Add(goroutines * 2)

	// 并发启用
	for i := 0; i < goroutines; i++ {
		go func() {
			defer wg.Done()
			for j := 0; j < 100; j++ {
				service.SetSnapEnabled(true)
			}
		}()
	}

	// 并发禁用
	for i := 0; i < goroutines; i++ {
		go func() {
			defer wg.Done()
			for j := 0; j < 100; j++ {
				service.SetSnapEnabled(false)
			}
		}()
	}

	wg.Wait()

	// 只要不panic就算成功
	t.Log("Concurrent SetSnapEnabled completed without panic")
}

// TestConcurrentCacheAccess 测试并发缓存访问
func TestConcurrentCacheAccess(t *testing.T) {
	service := createTestService()
	const goroutines = 50
	const operations = 1000

	// 初始化一些缓存数据
	for i := 0; i < 10; i++ {
		service.windowSizeCache[int64(i)] = [2]int{640 + i*10, 480 + i*10}
	}

	var wg sync.WaitGroup
	wg.Add(goroutines * 3)

	// 并发读取
	for i := 0; i < goroutines; i++ {
		go func() {
			defer wg.Done()
			for j := 0; j < operations; j++ {
				service.mu.RLock()
				_ = service.windowSizeCache[int64(j%10)]
				service.mu.RUnlock()
			}
		}()
	}

	// 并发写入
	for i := 0; i < goroutines; i++ {
		go func(id int) {
			defer wg.Done()
			for j := 0; j < operations; j++ {
				documentID := int64(id*operations + j)
				service.mu.Lock()
				service.windowSizeCache[documentID] = [2]int{640, 480}
				service.mu.Unlock()
			}
		}(i)
	}

	// 并发删除
	for i := 0; i < goroutines; i++ {
		go func(id int) {
			defer wg.Done()
			for j := 0; j < operations; j++ {
				documentID := int64(id*operations + j)
				service.mu.Lock()
				delete(service.windowSizeCache, documentID)
				service.mu.Unlock()
			}
		}(i)
	}

	wg.Wait()

	t.Log("Concurrent cache access completed without race conditions")
}

// TestConcurrentUpdateMainWindowCache 测试并发更新主窗口缓存
func TestConcurrentUpdateMainWindowCache(t *testing.T) {
	service := createTestService()
	const goroutines = 50

	var wg sync.WaitGroup
	wg.Add(goroutines)

	for i := 0; i < goroutines; i++ {
		go func(id int) {
			defer wg.Done()
			for j := 0; j < 100; j++ {
				service.mu.Lock()
				service.lastMainWindowPos = models.WindowPosition{
					X: id*100 + j,
					Y: id*100 + j,
				}
				service.lastMainWindowSize = [2]int{800 + id, 600 + id}
				service.mu.Unlock()
			}
		}(i)
	}

	wg.Wait()

	// 验证数据一致性
	service.mu.RLock()
	defer service.mu.RUnlock()

	if service.lastMainWindowSize[0] < 800 || service.lastMainWindowSize[0] > 800+goroutines {
		t.Errorf("Unexpected main window width: %d", service.lastMainWindowSize[0])
	}
}

// ========== 性能测试 ==========

// BenchmarkCalculateAdaptiveThreshold 基准测试：阈值计算
func BenchmarkCalculateAdaptiveThreshold(b *testing.B) {
	service := createTestService()
	service.lastMainWindowSize = [2]int{1920, 1080}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = service.calculateAdaptiveThreshold()
	}
}

// BenchmarkWindowSizeCacheHit 基准测试：缓存命中
func BenchmarkWindowSizeCacheHit(b *testing.B) {
	service := createTestService()
	documentID := int64(1)
	service.windowSizeCache[documentID] = [2]int{640, 480}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		service.mu.RLock()
		_, _ = service.windowSizeCache[documentID][0], service.windowSizeCache[documentID][1]
		service.mu.RUnlock()
	}
}

// BenchmarkRegisterUnregister 基准测试：注册注销窗口
func BenchmarkRegisterUnregister(b *testing.B) {
	service := createTestService()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		documentID := int64(i)
		windowInfo := &models.WindowInfo{
			DocumentID: documentID,
			IsSnapped:  false,
			LastPos:    models.WindowPosition{X: 0, Y: 0},
			MoveTime:   time.Now(),
		}

		service.mu.Lock()
		service.managedWindows[documentID] = windowInfo
		service.windowSizeCache[documentID] = [2]int{640, 480}
		service.mu.Unlock()

		service.UnregisterWindow(documentID)
	}
}

// BenchmarkConcurrentCacheRead 基准测试：并发缓存读取
func BenchmarkConcurrentCacheRead(b *testing.B) {
	service := createTestService()

	// 初始化缓存
	for i := 0; i < 100; i++ {
		service.windowSizeCache[int64(i)] = [2]int{640, 480}
	}

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			documentID := int64(i % 100)
			service.mu.RLock()
			_, _ = service.windowSizeCache[documentID][0], service.windowSizeCache[documentID][1]
			service.mu.RUnlock()
			i++
		}
	})
}

// BenchmarkSetSnapEnabled 基准测试：启用禁用吸附
func BenchmarkSetSnapEnabled(b *testing.B) {
	service := createTestService()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		service.SetSnapEnabled(i%2 == 0)
	}
}

// ========== 压力测试 ==========

// TestHighFrequencyUpdates 测试高频率更新
func TestHighFrequencyUpdates(t *testing.T) {
	service := createTestService()
	const updates = 10000

	start := time.Now()

	for i := 0; i < updates; i++ {
		service.mu.Lock()
		service.lastMainWindowPos = models.WindowPosition{X: i, Y: i}
		service.mu.Unlock()
	}

	elapsed := time.Since(start)
	avgTime := elapsed / updates

	t.Logf("High frequency updates: %d updates in %v", updates, elapsed)
	t.Logf("Average time per update: %v", avgTime)

	if avgTime > 100*time.Microsecond {
		t.Logf("Warning: Average update time (%v) is higher than expected", avgTime)
	}
}

// TestMemoryUsage 测试内存使用
func TestMemoryUsage(t *testing.T) {
	service := createTestService()
	const windows = 1000

	// 添加大量窗口
	for i := 0; i < windows; i++ {
		documentID := int64(i)
		service.mu.Lock()
		service.managedWindows[documentID] = &models.WindowInfo{
			DocumentID: documentID,
			IsSnapped:  false,
			LastPos:    models.WindowPosition{X: i, Y: i},
			MoveTime:   time.Now(),
		}
		service.windowSizeCache[documentID] = [2]int{640, 480}
		service.mu.Unlock()
	}

	// 验证数据
	service.mu.RLock()
	managedCount := len(service.managedWindows)
	cacheCount := len(service.windowSizeCache)
	service.mu.RUnlock()

	if managedCount != windows {
		t.Errorf("managedWindows count = %d, want %d", managedCount, windows)
	}
	if cacheCount != windows {
		t.Errorf("windowSizeCache count = %d, want %d", cacheCount, windows)
	}

	// 清理
	service.Cleanup()

	service.mu.RLock()
	afterCleanup := len(service.managedWindows) + len(service.windowSizeCache)
	service.mu.RUnlock()

	if afterCleanup != 0 {
		t.Errorf("After cleanup, total items = %d, want 0", afterCleanup)
	}

	t.Logf("Memory test: Successfully managed %d windows", windows)
}

// TestWindowResizeCache 测试窗口尺寸变化时缓存更新
func TestWindowResizeCache(t *testing.T) {
	service := createTestService()

	// 初始化缓存
	documentID := int64(1)
	service.windowSizeCache[documentID] = [2]int{640, 480}

	// 验证初始缓存
	service.mu.RLock()
	size := service.windowSizeCache[documentID]
	service.mu.RUnlock()

	if size[0] != 640 || size[1] != 480 {
		t.Errorf("Initial cache = [%d, %d], want [640, 480]", size[0], size[1])
	}

	// 模拟窗口尺寸变化
	service.mu.Lock()
	service.windowSizeCache[documentID] = [2]int{800, 600}
	service.mu.Unlock()

	// 验证缓存更新
	service.mu.RLock()
	newSize := service.windowSizeCache[documentID]
	service.mu.RUnlock()

	if newSize[0] != 800 || newSize[1] != 600 {
		t.Errorf("Updated cache = [%d, %d], want [800, 600]", newSize[0], newSize[1])
	}

	t.Log("Window resize cache test passed")
}

// TestMainWindowResizeEffect 测试主窗口尺寸变化对吸附窗口的影响
func TestMainWindowResizeEffect(t *testing.T) {
	service := createTestService()

	// 设置初始主窗口尺寸
	service.lastMainWindowPos = models.WindowPosition{X: 100, Y: 100}
	service.lastMainWindowSize = [2]int{800, 600}

	// 添加一个已吸附的窗口
	documentID := int64(1)
	service.managedWindows[documentID] = &models.WindowInfo{
		DocumentID: documentID,
		IsSnapped:  true,
		SnapEdge:   models.SnapEdgeRight,
		SnapOffset: models.SnapPosition{X: 800, Y: 0}, // 吸附在右侧
		LastPos:    models.WindowPosition{X: 900, Y: 100},
		MoveTime:   time.Now(),
	}

	// 模拟主窗口尺寸变化
	service.mu.Lock()
	service.lastMainWindowSize = [2]int{1000, 600} // 宽度从800变为1000
	service.mu.Unlock()

	// 验证吸附偏移量应该基于新的尺寸重新计算
	// 注意：这里只是验证数据结构，实际的位置更新由事件触发

	service.mu.RLock()
	windowInfo := service.managedWindows[documentID]
	service.mu.RUnlock()

	if !windowInfo.IsSnapped {
		t.Error("Window should still be snapped after main window resize")
	}

	if windowInfo.SnapEdge != models.SnapEdgeRight {
		t.Errorf("SnapEdge = %v, want %v", windowInfo.SnapEdge, models.SnapEdgeRight)
	}

	t.Log("Main window resize effect test passed")
}

// TestConcurrentResizeAndMove 测试并发的尺寸变化和移动操作
func TestConcurrentResizeAndMove(t *testing.T) {
	service := createTestService()
	const goroutines = 20
	const operations = 100

	// 初始化一些窗口
	for i := 0; i < 10; i++ {
		documentID := int64(i)
		service.managedWindows[documentID] = &models.WindowInfo{
			DocumentID: documentID,
			IsSnapped:  false,
			LastPos:    models.WindowPosition{X: i * 100, Y: i * 100},
			MoveTime:   time.Now(),
		}
		service.windowSizeCache[documentID] = [2]int{640, 480}
	}

	var wg sync.WaitGroup
	wg.Add(goroutines * 3)

	// 并发更新窗口尺寸缓存
	for i := 0; i < goroutines; i++ {
		go func(id int) {
			defer wg.Done()
			for j := 0; j < operations; j++ {
				documentID := int64(id % 10)
				service.mu.Lock()
				service.windowSizeCache[documentID] = [2]int{640 + j, 480 + j}
				service.mu.Unlock()
			}
		}(i)
	}

	// 并发更新主窗口尺寸
	for i := 0; i < goroutines; i++ {
		go func(id int) {
			defer wg.Done()
			for j := 0; j < operations; j++ {
				service.mu.Lock()
				service.lastMainWindowSize = [2]int{800 + j, 600 + j}
				service.mu.Unlock()
			}
		}(i)
	}

	// 并发读取缓存
	for i := 0; i < goroutines; i++ {
		go func() {
			defer wg.Done()
			for j := 0; j < operations; j++ {
				documentID := int64(j % 10)
				service.mu.RLock()
				_ = service.windowSizeCache[documentID]
				service.mu.RUnlock()
			}
		}()
	}

	wg.Wait()

	t.Log("Concurrent resize and move test completed without race conditions")
}
