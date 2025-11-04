package services

import (
	"context"
	"math"
	"sync"
	"time"
	"voidraft/internal/models"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// WindowSnapService 窗口吸附服务
type WindowSnapService struct {
	logger        *log.LogService
	configService *ConfigService
	windowHelper  *WindowHelper
	mu            sync.RWMutex

	// 吸附配置
	snapEnabled bool // 是否启用窗口吸附功能

	// 自适应阈值参数
	baseThresholdRatio float64 // 基础阈值比例
	minThreshold       int     // 最小阈值(像素)
	maxThreshold       int     // 最大阈值(像素)

	// 位置缓存
	lastMainWindowPos  models.WindowPosition // 缓存主窗口位置
	lastMainWindowSize [2]int                // 缓存主窗口尺寸 [width, height]

	// 管理的窗口
	managedWindows map[int64]*models.WindowInfo         // documentID -> WindowInfo
	windowRefs     map[int64]*application.WebviewWindow // documentID -> Window引用
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

	return &WindowSnapService{
		logger:             logger,
		configService:      configService,
		windowHelper:       NewWindowHelper(),
		snapEnabled:        snapEnabled,
		baseThresholdRatio: 0.025, // 2.5%的主窗口宽度作为基础阈值
		minThreshold:       8,     // 最小8像素（小屏幕保底）
		maxThreshold:       40,    // 最大40像素（大屏幕上限）
		managedWindows:     make(map[int64]*models.WindowInfo),
		windowRefs:         make(map[int64]*application.WebviewWindow),
	}
}

// ServiceStartup 服务启动时初始化
func (wss *WindowSnapService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	// 初始化主窗口位置缓存
	wss.updateMainWindowCache()

	wss.setupMainWindowEvents()

	return nil
}

// RegisterWindow 注册需要吸附管理的窗口
func (wss *WindowSnapService) RegisterWindow(documentID int64, window *application.WebviewWindow) {
	wss.mu.Lock()
	defer wss.mu.Unlock()

	wss.logger.Info("[WindowSnap] RegisterWindow - DocumentID: %d, SnapEnabled: %v", documentID, wss.snapEnabled)

	// 获取初始位置
	x, y := window.Position()
	wss.logger.Info("[WindowSnap] Initial position - X: %d, Y: %d", x, y)

	windowInfo := &models.WindowInfo{
		DocumentID: documentID,
		IsSnapped:  false,
		SnapOffset: models.SnapPosition{X: 0, Y: 0},
		SnapEdge:   models.SnapEdgeNone,
		LastPos:    models.WindowPosition{X: x, Y: y},
		MoveTime:   time.Now(),
	}

	wss.managedWindows[documentID] = windowInfo
	wss.windowRefs[documentID] = window

	wss.logger.Info("[WindowSnap] Managed windows count: %d", len(wss.managedWindows))

	// 为窗口设置移动事件监听
	wss.setupWindowEvents(window, windowInfo)
}

// UnregisterWindow 取消注册窗口
func (wss *WindowSnapService) UnregisterWindow(documentID int64) {
	wss.mu.Lock()
	defer wss.mu.Unlock()

	delete(wss.managedWindows, documentID)
	delete(wss.windowRefs, documentID)
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
				windowInfo.SnapEdge = models.SnapEdgeNone
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

// GetCurrentThreshold 获取当前自适应阈值（用于调试或显示）
func (wss *WindowSnapService) GetCurrentThreshold() int {
	wss.mu.RLock()
	defer wss.mu.RUnlock()

	return wss.calculateAdaptiveThreshold()
}

// OnWindowSnapConfigChanged 处理窗口吸附配置变更
func (wss *WindowSnapService) OnWindowSnapConfigChanged(enabled bool) error {
	wss.SetSnapEnabled(enabled)
	// 阈值现在是自适应的，无需手动设置
	return nil
}

// setupMainWindowEvents 设置主窗口事件监听
func (wss *WindowSnapService) setupMainWindowEvents() {
	// 获取主窗口
	mainWindow, ok := wss.windowHelper.GetMainWindow()
	if !ok {
		return
	}

	// 监听主窗口移动事件
	mainWindow.RegisterHook(events.Common.WindowDidMove, func(event *application.WindowEvent) {
		wss.onMainWindowMoved()
	})
}

// setupWindowEvents 为子窗口设置事件监听
func (wss *WindowSnapService) setupWindowEvents(window *application.WebviewWindow, windowInfo *models.WindowInfo) {
	// 监听子窗口移动事件
	window.RegisterHook(events.Common.WindowDidMove, func(event *application.WindowEvent) {
		wss.onChildWindowMoved(window, windowInfo)
	})
}

// updateMainWindowCache 更新主窗口缓存
func (wss *WindowSnapService) updateMainWindowCache() {
	mainWindow := wss.windowHelper.MustGetMainWindow()
	if mainWindow == nil {
		return
	}

	x, y := mainWindow.Position()
	w, h := mainWindow.Size()

	wss.lastMainWindowPos = models.WindowPosition{X: x, Y: y}
	wss.lastMainWindowSize = [2]int{w, h}
}

// onMainWindowMoved 主窗口移动事件处理
func (wss *WindowSnapService) onMainWindowMoved() {
	if !wss.snapEnabled {
		return
	}

	wss.mu.Lock()
	defer wss.mu.Unlock()

	// 更新主窗口缓存
	wss.updateMainWindowCache()

	// 只更新已吸附窗口的位置，无需重新检测所有窗口
	for _, windowInfo := range wss.managedWindows {
		if windowInfo.IsSnapped {
			wss.updateSnappedWindowPosition(windowInfo)
		}
	}
}

// onChildWindowMoved 子窗口移动事件处理
func (wss *WindowSnapService) onChildWindowMoved(window *application.WebviewWindow, windowInfo *models.WindowInfo) {
	if !wss.snapEnabled {
		return
	}

	wss.mu.Lock()
	defer wss.mu.Unlock()

	// 获取当前位置
	x, y := window.Position()
	currentPos := models.WindowPosition{X: x, Y: y}

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
func (wss *WindowSnapService) updateSnappedWindowPosition(windowInfo *models.WindowInfo) {
	// 计算新的目标位置（基于主窗口新位置）
	expectedX := wss.lastMainWindowPos.X + windowInfo.SnapOffset.X
	expectedY := wss.lastMainWindowPos.Y + windowInfo.SnapOffset.Y

	// 查找对应的window对象并移动
	if window, exists := wss.windowRefs[windowInfo.DocumentID]; exists {
		window.SetPosition(expectedX, expectedY)
	}

	windowInfo.LastPos = models.WindowPosition{X: expectedX, Y: expectedY}
}

// handleSnappedWindow 处理已吸附窗口的移动
func (wss *WindowSnapService) handleSnappedWindow(window *application.WebviewWindow, windowInfo *models.WindowInfo, currentPos models.WindowPosition) {
	// 计算预期位置
	expectedX := wss.lastMainWindowPos.X + windowInfo.SnapOffset.X
	expectedY := wss.lastMainWindowPos.Y + windowInfo.SnapOffset.Y

	// 计算实际位置与预期位置的距离
	distanceX := math.Abs(float64(currentPos.X - expectedX))
	distanceY := math.Abs(float64(currentPos.Y - expectedY))
	maxDistance := math.Max(distanceX, distanceY)

	// 用户拖拽检测：距离超过阈值且移动很快
	userDragThreshold := float64(wss.calculateAdaptiveThreshold())
	isUserDrag := maxDistance > userDragThreshold && time.Since(windowInfo.MoveTime) < 50*time.Millisecond

	if isUserDrag {
		// 用户主动拖拽，解除吸附
		windowInfo.IsSnapped = false
		windowInfo.SnapEdge = models.SnapEdgeNone
	}
}

// handleUnsnappedWindow 处理未吸附窗口的移动，返回是否成功吸附
func (wss *WindowSnapService) handleUnsnappedWindow(window *application.WebviewWindow, windowInfo *models.WindowInfo, currentPos models.WindowPosition, lastMoveTime time.Time) bool {
	// 检查是否应该吸附
	should, snapEdge := wss.shouldSnapToMainWindow(window, windowInfo, currentPos, lastMoveTime)
	if should {
		// 设置吸附状态
		windowInfo.IsSnapped = true
		windowInfo.SnapEdge = snapEdge

		// 执行吸附移动
		targetPos := wss.calculateSnapPosition(snapEdge, currentPos, window)
		window.SetPosition(targetPos.X, targetPos.Y)

		// 计算并保存偏移量
		windowInfo.SnapOffset.X = targetPos.X - wss.lastMainWindowPos.X
		windowInfo.SnapOffset.Y = targetPos.Y - wss.lastMainWindowPos.Y

		// 更新位置为吸附后的位置
		windowInfo.LastPos = targetPos

		return true
	}

	return false
}

// getWindowPosition 获取窗口的位置
func (wss *WindowSnapService) getWindowPosition(window *application.WebviewWindow) (models.WindowPosition, bool) {
	x, y := window.Position()
	return models.WindowPosition{X: x, Y: y}, true
}

// shouldSnapToMainWindow 优化版吸附检测
func (wss *WindowSnapService) shouldSnapToMainWindow(window *application.WebviewWindow, windowInfo *models.WindowInfo, currentPos models.WindowPosition, lastMoveTime time.Time) (bool, models.SnapEdge) {
	// 防抖：移动太快时不检测，
	timeSinceLastMove := time.Since(lastMoveTime)
	if timeSinceLastMove < 30*time.Millisecond && timeSinceLastMove > 0 {
		return false, models.SnapEdgeNone
	}

	// 使用缓存的主窗口位置和尺寸
	if wss.lastMainWindowSize[0] == 0 || wss.lastMainWindowSize[1] == 0 {
		// 主窗口缓存未初始化，立即更新
		wss.updateMainWindowCache()
	}

	mainPos := wss.lastMainWindowPos
	mainWidth := wss.lastMainWindowSize[0]
	mainHeight := wss.lastMainWindowSize[1]

	// 获取子窗口尺寸
	windowWidth, windowHeight := window.Size()

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
		edge     models.SnapEdge
		distance float64
		priority int // 1=角落, 2=边缘
	}

	var bestSnap *snapCheck

	// 检查角落吸附（优先级1）
	cornerChecks := []struct {
		edge models.SnapEdge
		dx   int
		dy   int
	}{
		{models.SnapEdgeTopRight, mainRight - windowLeft, mainTop - windowBottom},
		{models.SnapEdgeBottomRight, mainRight - windowLeft, mainBottom - windowTop},
		{models.SnapEdgeBottomLeft, mainLeft - windowRight, mainBottom - windowTop},
		{models.SnapEdgeTopLeft, mainLeft - windowRight, mainTop - windowBottom},
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
			edge     models.SnapEdge
			distance float64
		}{
			{models.SnapEdgeRight, math.Abs(float64(mainRight - windowLeft))},
			{models.SnapEdgeLeft, math.Abs(float64(mainLeft - windowRight))},
			{models.SnapEdgeBottom, math.Abs(float64(mainBottom - windowTop))},
			{models.SnapEdgeTop, math.Abs(float64(mainTop - windowBottom))},
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
		return false, models.SnapEdgeNone
	}

	return true, bestSnap.edge
}

// calculateSnapPosition 计算吸附目标位置
func (wss *WindowSnapService) calculateSnapPosition(snapEdge models.SnapEdge, currentPos models.WindowPosition, window *application.WebviewWindow) models.WindowPosition {
	// 使用缓存的主窗口信息
	mainPos := wss.lastMainWindowPos
	mainWidth := wss.lastMainWindowSize[0]
	mainHeight := wss.lastMainWindowSize[1]

	// 获取子窗口尺寸
	windowWidth, windowHeight := window.Size()

	switch snapEdge {
	case models.SnapEdgeRight:
		return models.WindowPosition{
			X: mainPos.X + mainWidth,
			Y: currentPos.Y, // 保持当前Y位置
		}
	case models.SnapEdgeLeft:
		return models.WindowPosition{
			X: mainPos.X - windowWidth,
			Y: currentPos.Y,
		}
	case models.SnapEdgeBottom:
		return models.WindowPosition{
			X: currentPos.X,
			Y: mainPos.Y + mainHeight,
		}
	case models.SnapEdgeTop:
		return models.WindowPosition{
			X: currentPos.X,
			Y: mainPos.Y - windowHeight,
		}
	case models.SnapEdgeTopRight:
		return models.WindowPosition{
			X: mainPos.X + mainWidth,
			Y: mainPos.Y - windowHeight,
		}
	case models.SnapEdgeBottomRight:
		return models.WindowPosition{
			X: mainPos.X + mainWidth,
			Y: mainPos.Y + mainHeight,
		}
	case models.SnapEdgeBottomLeft:
		return models.WindowPosition{
			X: mainPos.X - windowWidth,
			Y: mainPos.Y + mainHeight,
		}
	case models.SnapEdgeTopLeft:
		return models.WindowPosition{
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

	// 清空管理的窗口
	wss.managedWindows = make(map[int64]*models.WindowInfo)
	wss.windowRefs = make(map[int64]*application.WebviewWindow)
}

// ServiceShutdown 实现服务关闭接口
func (wss *WindowSnapService) ServiceShutdown() error {
	wss.Cleanup()
	return nil
}
