package services

import (
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	"github.com/wailsapp/wails/v3/pkg/services/log"
	"math"
	"sync"
	"time"
	"voidraft/internal/common/helper"
)

// 防抖和检测常量
const (
	// 移动事件防抖阈值：连续移动事件间隔小于此值时忽略
	debounceThreshold = 30 * time.Millisecond

	// 用户拖拽检测阈值：快速移动被认为是用户主动拖拽
	// 设置为稍大于防抖阈值，确保逻辑一致
	dragDetectionThreshold = 40 * time.Millisecond
)

// SnapEdge 表示吸附的边缘类型
type SnapEdge int

const (
	SnapEdgeNone        SnapEdge = iota // 未吸附
	SnapEdgeTop                         // 吸附到上边缘
	SnapEdgeRight                       // 吸附到右边缘
	SnapEdgeBottom                      // 吸附到下边缘
	SnapEdgeLeft                        // 吸附到左边缘
	SnapEdgeTopRight                    // 吸附到右上角
	SnapEdgeBottomRight                 // 吸附到右下角
	SnapEdgeBottomLeft                  // 吸附到左下角
	SnapEdgeTopLeft                     // 吸附到左上角
)

// WindowPosition 窗口位置
type WindowPosition struct {
	X int `json:"x"` // X坐标
	Y int `json:"y"` // Y坐标
}

// SnapPosition 表示吸附的相对位置
type SnapPosition struct {
	X int `json:"x"` // X轴相对偏移
	Y int `json:"y"` // Y轴相对偏移
}

// WindowInfo 窗口信息
type WindowInfo struct {
	DocumentID int64          `json:"documentID"` // 文档ID
	IsSnapped  bool           `json:"isSnapped"`  // 是否处于吸附状态
	SnapOffset SnapPosition   `json:"snapOffset"` // 与主窗口的相对位置偏移
	SnapEdge   SnapEdge       `json:"snapEdge"`   // 吸附的边缘类型
	LastPos    WindowPosition `json:"lastPos"`    // 上一次记录的窗口位置
	MoveTime   time.Time      `json:"moveTime"`   // 上次移动时间，用于判断移动速度
}

// WindowSnapService 窗口吸附服务
type WindowSnapService struct {
	logger        *log.LogService
	configService *ConfigService
	windowHelper  *helper.WindowHelper
	mu            sync.RWMutex

	// 吸附配置
	snapEnabled bool // 是否启用窗口吸附功能

	// 自适应阈值参数
	baseThresholdRatio float64 // 基础阈值比例
	minThreshold       int     // 最小阈值(像素)
	maxThreshold       int     // 最大阈值(像素)

	// 位置缓存
	lastMainWindowPos  WindowPosition // 缓存主窗口位置
	lastMainWindowSize [2]int         // 缓存主窗口尺寸 [width, height]

	// 管理的窗口
	managedWindows map[int64]*WindowInfo                // documentID -> WindowInfo
	windowRefs     map[int64]*application.WebviewWindow // documentID -> Window引用

	// 窗口尺寸缓存
	windowSizeCache map[int64][2]int // documentID -> [width, height]

	// 事件循环保护
	isUpdatingPosition map[int64]bool // documentID -> 是否正在更新位置

	// 事件监听器清理函数
	mainMoveUnhook    func()           // 主窗口移动监听清理函数
	windowMoveUnhooks map[int64]func() // documentID -> 子窗口移动监听清理函数

	// 配置观察者取消函数
	cancelObserver helper.CancelFunc
}

// NewWindowSnapService 创建新的窗口吸附服务实例
func NewWindowSnapService(logger *log.LogService, configService *ConfigService) *WindowSnapService {
	if logger == nil {
		logger = log.New()
	}

	// 从配置获取窗口吸附设置
	config, err := configService.GetConfig()
	snapEnabled := true // 默认启用

	if err == nil {
		snapEnabled = config.General.EnableWindowSnap
	}

	wss := &WindowSnapService{
		logger:             logger,
		configService:      configService,
		windowHelper:       helper.NewWindowHelper(),
		snapEnabled:        snapEnabled,
		baseThresholdRatio: 0.025, // 2.5%的主窗口宽度作为基础阈值
		minThreshold:       8,     // 最小8像素（小屏幕保底）
		maxThreshold:       40,    // 最大40像素（大屏幕上限）
		managedWindows:     make(map[int64]*WindowInfo),
		windowRefs:         make(map[int64]*application.WebviewWindow),
		windowSizeCache:    make(map[int64][2]int),
		isUpdatingPosition: make(map[int64]bool),
		windowMoveUnhooks:  make(map[int64]func()),
	}

	// 注册窗口吸附配置监听
	wss.cancelObserver = configService.Watch("general.enableWindowSnap", wss.onWindowSnapConfigChange)

	return wss
}

// onWindowSnapConfigChange 窗口吸附配置变更回调
func (wss *WindowSnapService) onWindowSnapConfigChange(oldValue, newValue interface{}) {
	enabled := false
	if newValue != nil {
		if val, ok := newValue.(bool); ok {
			enabled = val
		}
	}

	_ = wss.OnWindowSnapConfigChanged(enabled)
}

// RegisterWindow 注册需要吸附管理的窗口
func (wss *WindowSnapService) RegisterWindow(documentID int64, window *application.WebviewWindow) {
	wss.mu.Lock()
	defer wss.mu.Unlock()

	// 获取初始位置
	x, y := window.Position()

	windowInfo := &WindowInfo{
		DocumentID: documentID,
		IsSnapped:  false,
		SnapOffset: SnapPosition{X: 0, Y: 0},
		SnapEdge:   SnapEdgeNone,
		LastPos:    WindowPosition{X: x, Y: y},
		MoveTime:   time.Now(),
	}

	wss.managedWindows[documentID] = windowInfo
	wss.windowRefs[documentID] = window

	// 初始化窗口尺寸缓存
	wss.updateWindowSizeCacheLocked(documentID, window)

	// 如果这是第一个注册的窗口，启动主窗口事件监听
	if len(wss.managedWindows) == 1 {
		wss.setupMainWindowEvents()
	}

	// 为窗口设置移动事件监听
	wss.setupWindowEvents(window, windowInfo)
}

// UnregisterWindow 取消注册窗口
func (wss *WindowSnapService) UnregisterWindow(documentID int64) {
	wss.mu.Lock()
	defer wss.mu.Unlock()

	// 清理子窗口事件监听
	if unhook, exists := wss.windowMoveUnhooks[documentID]; exists {
		unhook()
		delete(wss.windowMoveUnhooks, documentID)
	}

	delete(wss.managedWindows, documentID)
	delete(wss.windowRefs, documentID)
	delete(wss.windowSizeCache, documentID)
	delete(wss.isUpdatingPosition, documentID)

	// 如果没有管理的窗口了，取消主窗口事件监听
	if len(wss.managedWindows) == 0 {
		wss.cleanupMainWindowEvents()
	}
}

// SetSnapEnabled 设置是否启用窗口吸附
func (wss *WindowSnapService) SetSnapEnabled(enabled bool) {
	wss.mu.Lock()
	defer wss.mu.Unlock()

	if wss.snapEnabled == enabled {
		return
	}

	wss.snapEnabled = enabled

	// 如果禁用吸附，解除所有吸附窗口
	if !enabled {
		for _, windowInfo := range wss.managedWindows {
			if windowInfo.IsSnapped {
				windowInfo.IsSnapped = false
				windowInfo.SnapEdge = SnapEdgeNone
			}
		}
	}
}

// calculateAdaptiveThreshold 计算自适应吸附阈值
func (wss *WindowSnapService) calculateAdaptiveThreshold() int {
	// 基于主窗口宽度计算阈值
	mainWidth := wss.lastMainWindowSize[0]
	if mainWidth == 0 {
		return wss.minThreshold // 默认最小值
	}

	// 计算基础阈值：主窗口宽度的2.5%
	adaptiveThreshold := int(float64(mainWidth) * wss.baseThresholdRatio)

	// 限制在最小和最大值之间
	if adaptiveThreshold < wss.minThreshold {
		return wss.minThreshold
	}
	if adaptiveThreshold > wss.maxThreshold {
		return wss.maxThreshold
	}

	return adaptiveThreshold
}

// GetCurrentThreshold 获取当前自适应阈值
func (wss *WindowSnapService) GetCurrentThreshold() int {
	wss.mu.RLock()
	defer wss.mu.RUnlock()

	return wss.calculateAdaptiveThreshold()
}

// OnWindowSnapConfigChanged 处理窗口吸附配置变更
func (wss *WindowSnapService) OnWindowSnapConfigChanged(enabled bool) error {
	wss.SetSnapEnabled(enabled)
	return nil
}

// setupMainWindowEventsLocked 设置主窗口事件监听
func (wss *WindowSnapService) setupMainWindowEvents() {
	// 如果已经设置过，不重复设置
	if wss.mainMoveUnhook != nil {
		return
	}

	// 在锁外获取主窗口
	wss.mu.Unlock()
	mainWindow, ok := wss.windowHelper.GetMainWindow()
	wss.mu.Lock()

	if !ok {
		return
	}

	// 监听主窗口移动事件
	wss.mainMoveUnhook = mainWindow.RegisterHook(events.Common.WindowDidMove, func(event *application.WindowEvent) {
		wss.onMainWindowMoved()
	})

}

// cleanupMainWindowEventsLocked 清理主窗口事件监听
func (wss *WindowSnapService) cleanupMainWindowEvents() {
	// 调用清理函数取消监听
	if wss.mainMoveUnhook != nil {
		wss.mainMoveUnhook()
		wss.mainMoveUnhook = nil
	}
}

// setupWindowEvents 为子窗口设置事件监听
func (wss *WindowSnapService) setupWindowEvents(window *application.WebviewWindow, windowInfo *WindowInfo) {
	// 监听子窗口移动事件，保存清理函数
	unhook := window.RegisterHook(events.Common.WindowDidMove, func(event *application.WindowEvent) {
		wss.onChildWindowMoved(window, windowInfo)
	})

	// 保存清理函数以便后续取消监听
	wss.windowMoveUnhooks[windowInfo.DocumentID] = unhook
}

// updateMainWindowCache 更新主窗口缓存
func (wss *WindowSnapService) updateMainWindowCacheLocked() {
	mainWindow := wss.windowHelper.MustGetMainWindow()
	if mainWindow == nil {
		return
	}

	// 在锁外获取窗口信息,避免死锁
	wss.mu.Unlock()
	x, y := mainWindow.Position()
	w, h := mainWindow.Size()
	wss.mu.Lock()

	wss.lastMainWindowPos = WindowPosition{X: x, Y: y}
	wss.lastMainWindowSize = [2]int{w, h}
}

// UpdateMainWindowCache 更新主窗口缓存
func (wss *WindowSnapService) UpdateMainWindowCache() {
	wss.mu.Lock()
	defer wss.mu.Unlock()
	wss.updateMainWindowCacheLocked()
}

// updateWindowSizeCacheLocked 更新窗口尺寸缓存
func (wss *WindowSnapService) updateWindowSizeCacheLocked(documentID int64, window *application.WebviewWindow) {
	// 在锁外获取窗口尺寸，避免死锁
	wss.mu.Unlock()
	w, h := window.Size()
	wss.mu.Lock()

	wss.windowSizeCache[documentID] = [2]int{w, h}
}

// getWindowSizeCached 获取缓存的窗口尺寸，如果不存在则实时获取并缓存
func (wss *WindowSnapService) getWindowSizeCached(documentID int64, window *application.WebviewWindow) (int, int) {
	// 先检查缓存
	if size, exists := wss.windowSizeCache[documentID]; exists {
		return size[0], size[1]
	}

	// 缓存不存在，实时获取并缓存
	wss.updateWindowSizeCacheLocked(documentID, window)

	if size, exists := wss.windowSizeCache[documentID]; exists {
		return size[0], size[1]
	}

	// 直接返回实时尺寸
	wss.mu.Unlock()
	w, h := window.Size()
	wss.mu.Lock()
	return w, h
}

// onMainWindowMoved 主窗口移动事件处理
func (wss *WindowSnapService) onMainWindowMoved() {
	if !wss.snapEnabled {
		return
	}

	// 先在锁外获取主窗口的位置和尺寸
	mainWindow := wss.windowHelper.MustGetMainWindow()
	if mainWindow == nil {
		return
	}

	x, y := mainWindow.Position()
	w, h := mainWindow.Size()

	wss.mu.Lock()
	defer wss.mu.Unlock()

	// 更新主窗口位置和尺寸缓存
	wss.lastMainWindowPos = WindowPosition{X: x, Y: y}
	wss.lastMainWindowSize = [2]int{w, h}

	// 只更新已吸附窗口的位置，无需重新检测所有窗口
	for _, windowInfo := range wss.managedWindows {
		if windowInfo.IsSnapped {
			wss.updateSnappedWindowPosition(windowInfo)
		}
	}
}

// onChildWindowMoved 子窗口移动事件处理
func (wss *WindowSnapService) onChildWindowMoved(window *application.WebviewWindow, windowInfo *WindowInfo) {
	if !wss.snapEnabled {
		return
	}

	// 事件循环保护：如果正在更新位置，忽略此次事件
	wss.mu.Lock()
	if wss.isUpdatingPosition[windowInfo.DocumentID] {
		wss.mu.Unlock()
		return
	}
	wss.mu.Unlock()

	x, y := window.Position()
	currentPos := WindowPosition{X: x, Y: y}

	wss.mu.Lock()
	defer wss.mu.Unlock()

	// 检查是否真的移动了（避免无效触发）
	if currentPos.X == windowInfo.LastPos.X && currentPos.Y == windowInfo.LastPos.Y {
		return
	}

	// 保存上次移动时间用于防抖检测
	lastMoveTime := windowInfo.MoveTime
	windowInfo.MoveTime = time.Now()

	if windowInfo.IsSnapped {
		// 已吸附窗口：检查是否被用户拖拽解除吸附
		wss.handleSnappedWindow(window, windowInfo, currentPos)
		// 对于已吸附窗口，总是更新为当前位置
		windowInfo.LastPos = currentPos
	} else {
		// 未吸附窗口：检查是否应该吸附
		isSnapped := wss.handleUnsnappedWindow(window, windowInfo, currentPos, lastMoveTime)
		if !isSnapped {
			// 如果没有吸附，更新为当前位置
			windowInfo.LastPos = currentPos
		}
		// 如果成功吸附，位置已在handleUnsnappedWindow中更新
	}
}

// updateSnappedWindowPosition 更新已吸附窗口的位置
func (wss *WindowSnapService) updateSnappedWindowPosition(windowInfo *WindowInfo) {
	// 计算新的目标位置（基于主窗口新位置）
	expectedX := wss.lastMainWindowPos.X + windowInfo.SnapOffset.X
	expectedY := wss.lastMainWindowPos.Y + windowInfo.SnapOffset.Y

	// 查找对应的window对象
	window, exists := wss.windowRefs[windowInfo.DocumentID]
	if !exists {
		return
	}

	// 设置更新标志，防止事件循环
	wss.isUpdatingPosition[windowInfo.DocumentID] = true

	wss.mu.Unlock()
	window.SetPosition(expectedX, expectedY)
	wss.mu.Lock()

	// 清除更新标志
	wss.isUpdatingPosition[windowInfo.DocumentID] = false

	windowInfo.LastPos = WindowPosition{X: expectedX, Y: expectedY}
}

// handleSnappedWindow 处理已吸附窗口的移动
func (wss *WindowSnapService) handleSnappedWindow(window *application.WebviewWindow, windowInfo *WindowInfo, currentPos WindowPosition) {
	// 计算预期位置
	expectedX := wss.lastMainWindowPos.X + windowInfo.SnapOffset.X
	expectedY := wss.lastMainWindowPos.Y + windowInfo.SnapOffset.Y

	// 计算实际位置与预期位置的距离
	distanceX := math.Abs(float64(currentPos.X - expectedX))
	distanceY := math.Abs(float64(currentPos.Y - expectedY))
	maxDistance := math.Max(distanceX, distanceY)

	// 用户拖拽检测：距离超过阈值且移动很快（使用统一的拖拽检测阈值）
	userDragThreshold := float64(wss.calculateAdaptiveThreshold())
	isUserDrag := maxDistance > userDragThreshold && time.Since(windowInfo.MoveTime) < dragDetectionThreshold

	if isUserDrag {
		// 用户主动拖拽，解除吸附
		windowInfo.IsSnapped = false
		windowInfo.SnapEdge = SnapEdgeNone
	}
}

// handleUnsnappedWindow 处理未吸附窗口的移动，返回是否成功吸附
func (wss *WindowSnapService) handleUnsnappedWindow(window *application.WebviewWindow, windowInfo *WindowInfo, currentPos WindowPosition, lastMoveTime time.Time) bool {
	// 检查是否应该吸附
	should, snapEdge := wss.shouldSnapToMainWindow(window, windowInfo, currentPos, lastMoveTime)
	if should {
		// 设置吸附状态
		windowInfo.IsSnapped = true
		windowInfo.SnapEdge = snapEdge

		// 执行吸附移动
		targetPos := wss.calculateSnapPosition(snapEdge, currentPos, windowInfo.DocumentID, window)

		// 设置更新标志，防止事件循环
		wss.isUpdatingPosition[windowInfo.DocumentID] = true

		wss.mu.Unlock()
		window.SetPosition(targetPos.X, targetPos.Y)
		wss.mu.Lock()

		// 清除更新标志
		wss.isUpdatingPosition[windowInfo.DocumentID] = false

		// 计算并保存偏移量
		windowInfo.SnapOffset.X = targetPos.X - wss.lastMainWindowPos.X
		windowInfo.SnapOffset.Y = targetPos.Y - wss.lastMainWindowPos.Y

		// 更新位置为吸附后的位置
		windowInfo.LastPos = targetPos

		return true
	}

	return false
}

// shouldSnapToMainWindow 吸附检测
func (wss *WindowSnapService) shouldSnapToMainWindow(window *application.WebviewWindow, windowInfo *WindowInfo, currentPos WindowPosition, lastMoveTime time.Time) (bool, SnapEdge) {
	// 防抖：移动太快时不检测（使用统一的防抖阈值）
	timeSinceLastMove := time.Since(lastMoveTime)
	if timeSinceLastMove < debounceThreshold {
		return false, SnapEdgeNone
	}

	// 使用缓存的主窗口位置和尺寸
	if wss.lastMainWindowSize[0] == 0 || wss.lastMainWindowSize[1] == 0 {
		// 主窗口缓存未初始化，立即更新
		wss.updateMainWindowCacheLocked()
	}

	mainPos := wss.lastMainWindowPos
	mainWidth := wss.lastMainWindowSize[0]
	mainHeight := wss.lastMainWindowSize[1]

	// 使用缓存的子窗口尺寸，减少系统调用
	windowWidth, windowHeight := wss.getWindowSizeCached(windowInfo.DocumentID, window)

	// 自适应阈值计算
	threshold := float64(wss.calculateAdaptiveThreshold())
	cornerThreshold := threshold * 1.5

	// 计算边界
	mainLeft, mainTop := mainPos.X, mainPos.Y
	mainRight, mainBottom := mainPos.X+mainWidth, mainPos.Y+mainHeight

	windowLeft, windowTop := currentPos.X, currentPos.Y
	windowRight, windowBottom := currentPos.X+windowWidth, currentPos.Y+windowHeight

	// 简化的距离计算结构
	type snapCheck struct {
		edge     SnapEdge
		distance float64
		priority int // 1=角落, 2=边缘
	}

	var bestSnap *snapCheck

	// 检查角落吸附（优先级1）
	cornerChecks := []struct {
		edge SnapEdge
		dx   int
		dy   int
	}{
		{SnapEdgeTopRight, mainRight - windowLeft, mainTop - windowBottom},
		{SnapEdgeBottomRight, mainRight - windowLeft, mainBottom - windowTop},
		{SnapEdgeBottomLeft, mainLeft - windowRight, mainBottom - windowTop},
		{SnapEdgeTopLeft, mainLeft - windowRight, mainTop - windowBottom},
	}

	for _, check := range cornerChecks {
		dist := math.Sqrt(float64(check.dx*check.dx + check.dy*check.dy))
		if dist <= cornerThreshold {
			if bestSnap == nil || dist < bestSnap.distance {
				bestSnap = &snapCheck{check.edge, dist, 1}
			}
		}
	}

	// 如果没有角落吸附，检查边缘吸附（优先级2）
	if bestSnap == nil {
		edgeChecks := []struct {
			edge     SnapEdge
			distance float64
		}{
			{SnapEdgeRight, math.Abs(float64(mainRight - windowLeft))},
			{SnapEdgeLeft, math.Abs(float64(mainLeft - windowRight))},
			{SnapEdgeBottom, math.Abs(float64(mainBottom - windowTop))},
			{SnapEdgeTop, math.Abs(float64(mainTop - windowBottom))},
		}

		for _, check := range edgeChecks {
			if check.distance <= threshold {
				if bestSnap == nil || check.distance < bestSnap.distance {
					bestSnap = &snapCheck{check.edge, check.distance, 2}
				}
			}
		}
	}

	if bestSnap == nil {
		return false, SnapEdgeNone
	}

	return true, bestSnap.edge
}

// calculateSnapPosition 计算吸附目标位置
func (wss *WindowSnapService) calculateSnapPosition(snapEdge SnapEdge, currentPos WindowPosition, documentID int64, window *application.WebviewWindow) WindowPosition {
	// 使用缓存的主窗口信息
	mainPos := wss.lastMainWindowPos
	mainWidth := wss.lastMainWindowSize[0]
	mainHeight := wss.lastMainWindowSize[1]

	// 使用缓存的子窗口尺寸，减少系统调用
	windowWidth, windowHeight := wss.getWindowSizeCached(documentID, window)

	switch snapEdge {
	case SnapEdgeRight:
		return WindowPosition{
			X: mainPos.X + mainWidth,
			Y: currentPos.Y, // 保持当前Y位置
		}
	case SnapEdgeLeft:
		return WindowPosition{
			X: mainPos.X - windowWidth,
			Y: currentPos.Y,
		}
	case SnapEdgeBottom:
		return WindowPosition{
			X: currentPos.X,
			Y: mainPos.Y + mainHeight,
		}
	case SnapEdgeTop:
		return WindowPosition{
			X: currentPos.X,
			Y: mainPos.Y - windowHeight,
		}
	case SnapEdgeTopRight:
		return WindowPosition{
			X: mainPos.X + mainWidth,
			Y: mainPos.Y - windowHeight,
		}
	case SnapEdgeBottomRight:
		return WindowPosition{
			X: mainPos.X + mainWidth,
			Y: mainPos.Y + mainHeight,
		}
	case SnapEdgeBottomLeft:
		return WindowPosition{
			X: mainPos.X - windowWidth,
			Y: mainPos.Y + mainHeight,
		}
	case SnapEdgeTopLeft:
		return WindowPosition{
			X: mainPos.X - windowWidth,
			Y: mainPos.Y - windowHeight,
		}
	}

	return currentPos
}

// Cleanup 清理资源
func (wss *WindowSnapService) Cleanup() {
	wss.mu.Lock()
	defer wss.mu.Unlock()

	// 清理主窗口事件监听
	wss.cleanupMainWindowEvents()

	// 清理所有子窗口事件监听
	for documentID, unhook := range wss.windowMoveUnhooks {
		if unhook != nil {
			unhook()
		}
		delete(wss.windowMoveUnhooks, documentID)
	}

	// 清空管理的窗口
	wss.managedWindows = make(map[int64]*WindowInfo)
	wss.windowRefs = make(map[int64]*application.WebviewWindow)
	wss.windowSizeCache = make(map[int64][2]int)
	wss.isUpdatingPosition = make(map[int64]bool)
	wss.windowMoveUnhooks = make(map[int64]func())
}

// ServiceShutdown 实现服务关闭接口
func (wss *WindowSnapService) ServiceShutdown() error {
	// 取消配置观察者
	if wss.cancelObserver != nil {
		wss.cancelObserver()
	}
	wss.Cleanup()
	return nil
}
