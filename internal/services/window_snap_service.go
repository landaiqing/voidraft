package services

import (
	"context"
	"math"
	"sync"
	"time"
	"voidraft/internal/models"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// WindowSnapService 窗口吸附服务
type WindowSnapService struct {
	logger        *log.LogService
	configService *ConfigService
	app           *application.App
	mainWindow    *application.WebviewWindow
	mu            sync.RWMutex

	// 吸附配置
	snapThreshold int  // 吸附触发的阈值距离(像素)
	snapEnabled   bool // 是否启用窗口吸附功能

	// 定时器控制
	snapTicker *time.Ticker
	ctx        context.Context
	cancel     context.CancelFunc

	// 性能优化相关
	lastMainWindowPos models.WindowPosition // 缓存主窗口上次位置
	changedWindows    map[int64]bool        // 记录哪些窗口发生了变化
	skipFrames        int                   // 跳帧计数器，用于降低检测频率

	// 监听的窗口列表
	managedWindows map[int64]*SnapWindowInfo // documentID -> SnapWindowInfo
}

// SnapWindowInfo 吸附窗口信息
type SnapWindowInfo struct {
	Window     *application.WebviewWindow
	DocumentID int64
	Title      string
	IsSnapped  bool                  // 是否处于吸附状态
	SnapOffset models.SnapPosition   // 与主窗口的相对位置偏移
	SnapEdge   models.SnapEdge       // 吸附的边缘类型
	LastPos    models.WindowPosition // 上一次记录的窗口位置
	MoveTime   time.Time             // 上次移动时间，用于判断移动速度
}

// NewWindowSnapService 创建新的窗口吸附服务实例
func NewWindowSnapService(logger *log.LogService, configService *ConfigService) *WindowSnapService {
	if logger == nil {
		logger = log.New()
	}

	// 从配置获取窗口吸附设置
	config, err := configService.GetConfig()
	snapEnabled := true // 默认启用
	snapThreshold := 15 // 默认阈值

	if err == nil {
		snapEnabled = config.General.EnableWindowSnap
		snapThreshold = config.General.SnapThreshold
	}

	return &WindowSnapService{
		logger:         logger,
		configService:  configService,
		snapThreshold:  snapThreshold,
		snapEnabled:    snapEnabled,
		managedWindows: make(map[int64]*SnapWindowInfo),
		changedWindows: make(map[int64]bool),
		skipFrames:     0,
	}
}

// SetAppReferences 设置应用和主窗口引用
func (wss *WindowSnapService) SetAppReferences(app *application.App, mainWindow *application.WebviewWindow) {
	wss.app = app
	wss.mainWindow = mainWindow

	// 初始化上下文，用于控制goroutine的生命周期
	wss.ctx, wss.cancel = context.WithCancel(context.Background())

	// 启动窗口吸附监听器
	wss.StartWindowSnapMonitor()
}

// RegisterWindow 注册需要吸附管理的窗口
func (wss *WindowSnapService) RegisterWindow(documentID int64, window *application.WebviewWindow, title string) {
	wss.mu.Lock()
	defer wss.mu.Unlock()

	wss.managedWindows[documentID] = &SnapWindowInfo{
		Window:     window,
		DocumentID: documentID,
		Title:      title,
		IsSnapped:  false,
		SnapOffset: models.SnapPosition{X: 0, Y: 0},
		SnapEdge:   models.SnapEdgeNone,
		LastPos:    models.WindowPosition{X: 0, Y: 0},
		MoveTime:   time.Now(),
	}
}

// UnregisterWindow 取消注册窗口
func (wss *WindowSnapService) UnregisterWindow(documentID int64) {
	wss.mu.Lock()
	defer wss.mu.Unlock()

	delete(wss.managedWindows, documentID)
	delete(wss.changedWindows, documentID)
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
		// 停止定时器
		if wss.snapTicker != nil {
			wss.snapTicker.Stop()
			wss.snapTicker = nil
		}
	} else if wss.snapTicker == nil && wss.app != nil {
		// 重新启动定时器
		wss.StartWindowSnapMonitor()
	}
}

// SetSnapThreshold 设置窗口吸附阈值
func (wss *WindowSnapService) SetSnapThreshold(threshold int) {
	wss.mu.Lock()
	defer wss.mu.Unlock()

	if threshold <= 0 || wss.snapThreshold == threshold {
		return
	}

	wss.snapThreshold = threshold
}

// OnWindowSnapConfigChanged 处理窗口吸附配置变更
func (wss *WindowSnapService) OnWindowSnapConfigChanged(enabled bool, threshold int) error {
	wss.SetSnapEnabled(enabled)
	wss.SetSnapThreshold(threshold)
	return nil
}

// StartWindowSnapMonitor 启动窗口吸附监听器
func (wss *WindowSnapService) StartWindowSnapMonitor() {
	// 如果定时器已存在，先停止它
	if wss.snapTicker != nil {
		wss.snapTicker.Stop()
	}

	// 只有在吸附功能启用时才启动监听器
	if !wss.snapEnabled {
		return
	}

	// 创建新的定时器，20fps 以优化性能
	wss.snapTicker = time.NewTicker(50 * time.Millisecond)

	// 启动goroutine持续监听窗口位置
	go func() {
		for {
			select {
			case <-wss.snapTicker.C:
				wss.checkAndApplySnapping()
			case <-wss.ctx.Done():
				// 上下文取消时停止goroutine
				return
			}
		}
	}()
}

// checkAndApplySnapping 检测并应用窗口吸附（性能优化版本）
func (wss *WindowSnapService) checkAndApplySnapping() {
	if !wss.snapEnabled {
		return
	}

	// 性能优化：每3帧执行一次完整检测，其他时间只处理变化的窗口
	wss.skipFrames++
	fullCheck := wss.skipFrames%3 == 0

	wss.mu.Lock()
	defer wss.mu.Unlock()

	// 检查主窗口是否存在且可见
	if wss.mainWindow == nil || !wss.isMainWindowAvailable() {
		// 主窗口不可用，解除所有吸附
		for _, windowInfo := range wss.managedWindows {
			if windowInfo.IsSnapped {
				windowInfo.IsSnapped = false
				windowInfo.SnapEdge = models.SnapEdgeNone
			}
		}
		// 清空变化记录
		wss.changedWindows = make(map[int64]bool)
		return
	}

	mainPos, _ := wss.getWindowPosition(wss.mainWindow)

	// 检查主窗口是否移动了
	mainWindowMoved := mainPos.X != wss.lastMainWindowPos.X || mainPos.Y != wss.lastMainWindowPos.Y
	if mainWindowMoved {
		wss.lastMainWindowPos = mainPos
		// 主窗口移动了，标记所有吸附的窗口为变化
		for documentID, windowInfo := range wss.managedWindows {
			if windowInfo.IsSnapped {
				wss.changedWindows[documentID] = true
			}
		}
	}

	for documentID, windowInfo := range wss.managedWindows {
		currentPos, _ := wss.getWindowPosition(windowInfo.Window)

		// 检查窗口是否移动了
		hasMoved := currentPos.X != windowInfo.LastPos.X || currentPos.Y != windowInfo.LastPos.Y
		if hasMoved {
			windowInfo.MoveTime = time.Now()
			windowInfo.LastPos = currentPos
			wss.changedWindows[documentID] = true
		}

		// 性能优化：只处理变化的窗口或进行完整检查时
		if !fullCheck && !wss.changedWindows[documentID] {
			continue
		}

		if windowInfo.IsSnapped {
			// 窗口已吸附，检查是否需要更新位置或解除吸附
			wss.handleSnappedWindow(windowInfo, mainPos, currentPos)
		} else {
			// 窗口未吸附，检查是否应该吸附
			wss.handleUnsnappedWindow(windowInfo)
		}

		// 处理完成后清除变化标记
		delete(wss.changedWindows, documentID)
	}
}

// isMainWindowAvailable 检查主窗口是否可用
func (wss *WindowSnapService) isMainWindowAvailable() bool {
	if wss.mainWindow == nil {
		return false
	}

	// 检查主窗口是否可见和正常状态
	return wss.mainWindow.IsVisible()
}

// handleSnappedWindow 处理已吸附的窗口
func (wss *WindowSnapService) handleSnappedWindow(windowInfo *SnapWindowInfo, mainPos models.WindowPosition, currentPos models.WindowPosition) {
	// 计算预期位置基于主窗口的新位置
	expectedX := mainPos.X + windowInfo.SnapOffset.X
	expectedY := mainPos.Y + windowInfo.SnapOffset.Y

	// 计算当前位置与预期位置的距离
	distanceX := math.Abs(float64(currentPos.X - expectedX))
	distanceY := math.Abs(float64(currentPos.Y - expectedY))
	maxDistance := math.Max(distanceX, distanceY)

	// 检测是否为用户主动拖拽：如果窗口移动幅度超过阈值且是最近移动的
	userDragThreshold := float64(wss.snapThreshold)
	isUserDrag := maxDistance > userDragThreshold && time.Since(windowInfo.MoveTime) < 100*time.Millisecond

	if isUserDrag {
		// 用户主动拖拽，立即解除吸附
		windowInfo.IsSnapped = false
		windowInfo.SnapEdge = models.SnapEdgeNone
		return
	}

	// 对于主窗口移动导致的位置变化，立即跟随且不解除吸附
	if maxDistance > 0 {
		// 直接调整到预期位置，不使用平滑移动以提高响应速度
		windowInfo.Window.SetPosition(expectedX, expectedY)
		windowInfo.LastPos = models.WindowPosition{X: expectedX, Y: expectedY}
	}
}

// handleUnsnappedWindow 处理未吸附的窗口
func (wss *WindowSnapService) handleUnsnappedWindow(windowInfo *SnapWindowInfo) {
	// 检查是否应该吸附到主窗口
	should, snapEdge := wss.shouldSnapToMainWindow(windowInfo)
	if should {
		// 获取主窗口位置用于计算偏移量
		mainPos, _ := wss.getWindowPosition(wss.mainWindow)

		// 设置吸附状态
		windowInfo.IsSnapped = true
		windowInfo.SnapEdge = snapEdge

		// 执行即时吸附，产生明显的吸附效果
		wss.snapWindowToMainWindow(windowInfo, snapEdge)

		// 重新获取吸附后的位置来计算偏移量
		newPos, _ := wss.getWindowPosition(windowInfo.Window)
		windowInfo.SnapOffset.X = newPos.X - mainPos.X
		windowInfo.SnapOffset.Y = newPos.Y - mainPos.Y
		windowInfo.LastPos = newPos
	}
}

// getWindowPosition 获取窗口的位置
func (wss *WindowSnapService) getWindowPosition(window *application.WebviewWindow) (models.WindowPosition, bool) {
	x, y := window.Position()
	return models.WindowPosition{X: x, Y: y}, true
}

// shouldSnapToMainWindow 检查窗口是否应该吸附到主窗口（支持角落吸附）
func (wss *WindowSnapService) shouldSnapToMainWindow(windowInfo *SnapWindowInfo) (bool, models.SnapEdge) {
	// 降低防抖时间，提高吸附响应速度
	if time.Since(windowInfo.MoveTime) < 50*time.Millisecond {
		return false, models.SnapEdgeNone
	}

	// 获取两个窗口的位置
	mainPos, _ := wss.getWindowPosition(wss.mainWindow)
	windowPos, _ := wss.getWindowPosition(windowInfo.Window)

	// 获取主窗口尺寸
	mainWidth, mainHeight := wss.mainWindow.Size()

	// 获取子窗口尺寸
	windowWidth, windowHeight := windowInfo.Window.Size()

	// 计算各个边缘的距离
	threshold := float64(wss.snapThreshold)
	cornerThreshold := threshold * 1.5 // 角落吸附需要更大的阈值

	// 主窗口的四个边界
	mainLeft := mainPos.X
	mainTop := mainPos.Y
	mainRight := mainPos.X + mainWidth
	mainBottom := mainPos.Y + mainHeight

	// 子窗口的四个边界
	windowLeft := windowPos.X
	windowTop := windowPos.Y
	windowRight := windowPos.X + windowWidth
	windowBottom := windowPos.Y + windowHeight

	// 存储每个边缘的吸附信息
	type snapCandidate struct {
		edge     models.SnapEdge
		distance float64
		overlap  float64 // 重叠度，用于优先级判断
		isCorner bool    // 是否为角落吸附
	}

	var candidates []snapCandidate

	// ==== 检查角落吸附（优先级最高） ====

	// 1. 右上角 (SnapEdgeTopRight)
	distToTopRight := math.Sqrt(math.Pow(float64(mainRight-windowLeft), 2) + math.Pow(float64(mainTop-windowBottom), 2))
	if distToTopRight <= cornerThreshold {
		// 检查是否接近右上角区域
		horizDist := math.Abs(float64(mainRight - windowLeft))
		vertDist := math.Abs(float64(mainTop - windowBottom))
		if horizDist <= cornerThreshold && vertDist <= cornerThreshold {
			candidates = append(candidates, snapCandidate{models.SnapEdgeTopRight, distToTopRight, 100, true})
		}
	}

	// 2. 右下角 (SnapEdgeBottomRight)
	distToBottomRight := math.Sqrt(math.Pow(float64(mainRight-windowLeft), 2) + math.Pow(float64(mainBottom-windowTop), 2))
	if distToBottomRight <= cornerThreshold {
		horizDist := math.Abs(float64(mainRight - windowLeft))
		vertDist := math.Abs(float64(mainBottom - windowTop))
		if horizDist <= cornerThreshold && vertDist <= cornerThreshold {
			candidates = append(candidates, snapCandidate{models.SnapEdgeBottomRight, distToBottomRight, 100, true})
		}
	}

	// 3. 左下角 (SnapEdgeBottomLeft)
	distToBottomLeft := math.Sqrt(math.Pow(float64(mainLeft-windowRight), 2) + math.Pow(float64(mainBottom-windowTop), 2))
	if distToBottomLeft <= cornerThreshold {
		horizDist := math.Abs(float64(mainLeft - windowRight))
		vertDist := math.Abs(float64(mainBottom - windowTop))
		if horizDist <= cornerThreshold && vertDist <= cornerThreshold {
			candidates = append(candidates, snapCandidate{models.SnapEdgeBottomLeft, distToBottomLeft, 100, true})
		}
	}

	// 4. 左上角 (SnapEdgeTopLeft)
	distToTopLeft := math.Sqrt(math.Pow(float64(mainLeft-windowRight), 2) + math.Pow(float64(mainTop-windowBottom), 2))
	if distToTopLeft <= cornerThreshold {
		horizDist := math.Abs(float64(mainLeft - windowRight))
		vertDist := math.Abs(float64(mainTop - windowBottom))
		if horizDist <= cornerThreshold && vertDist <= cornerThreshold {
			candidates = append(candidates, snapCandidate{models.SnapEdgeTopLeft, distToTopLeft, 100, true})
		}
	}

	// ==== 检查边缘吸附（只在没有角落吸附时检查） ====
	if len(candidates) == 0 {
		// 1. 吸附到主窗口右侧
		distToRight := math.Abs(float64(mainRight - windowLeft))
		if distToRight <= threshold {
			// 计算垂直重叠
			overlapTop := math.Max(float64(mainTop), float64(windowTop))
			overlapBottom := math.Min(float64(mainBottom), float64(windowBottom))
			verticalOverlap := math.Max(0, overlapBottom-overlapTop)
			candidates = append(candidates, snapCandidate{models.SnapEdgeRight, distToRight, verticalOverlap, false})
		}

		// 2. 吸附到主窗口左侧
		distToLeft := math.Abs(float64(mainLeft - windowRight))
		if distToLeft <= threshold {
			// 计算垂直重叠
			overlapTop := math.Max(float64(mainTop), float64(windowTop))
			overlapBottom := math.Min(float64(mainBottom), float64(windowBottom))
			verticalOverlap := math.Max(0, overlapBottom-overlapTop)
			candidates = append(candidates, snapCandidate{models.SnapEdgeLeft, distToLeft, verticalOverlap, false})
		}

		// 3. 吸附到主窗口底部
		distToBottom := math.Abs(float64(mainBottom - windowTop))
		if distToBottom <= threshold {
			// 计算水平重叠
			overlapLeft := math.Max(float64(mainLeft), float64(windowLeft))
			overlapRight := math.Min(float64(mainRight), float64(windowRight))
			horizontalOverlap := math.Max(0, overlapRight-overlapLeft)
			candidates = append(candidates, snapCandidate{models.SnapEdgeBottom, distToBottom, horizontalOverlap, false})
		}

		// 4. 吸附到主窗口顶部
		distToTop := math.Abs(float64(mainTop - windowBottom))
		if distToTop <= threshold {
			// 计算水平重叠
			overlapLeft := math.Max(float64(mainLeft), float64(windowLeft))
			overlapRight := math.Min(float64(mainRight), float64(windowRight))
			horizontalOverlap := math.Max(0, overlapRight-overlapLeft)
			candidates = append(candidates, snapCandidate{models.SnapEdgeTop, distToTop, horizontalOverlap, false})
		}
	}

	// 如果没有候选，不吸附
	if len(candidates) == 0 {
		return false, models.SnapEdgeNone
	}

	// 选择最佳吸附位置：角落吸附优先，其次考虑重叠度，最后考虑距离
	bestCandidate := candidates[0]
	for _, candidate := range candidates[1:] {
		// 角落吸附优先级最高
		if candidate.isCorner && !bestCandidate.isCorner {
			bestCandidate = candidate
		} else if bestCandidate.isCorner && !candidate.isCorner {
			// 继续使用当前的角落吸附
			continue
		} else {
			// 同类型的吸附，比较重叠度和距离
			if math.Abs(candidate.overlap-bestCandidate.overlap) < 10 {
				if candidate.distance < bestCandidate.distance {
					bestCandidate = candidate
				}
			} else if candidate.overlap > bestCandidate.overlap {
				// 重叠度更高的优先
				bestCandidate = candidate
			}
		}
	}

	return true, bestCandidate.edge
}

// snapWindowToMainWindow 将窗口精确吸附到主窗口边缘（支持角落吸附）
func (wss *WindowSnapService) snapWindowToMainWindow(windowInfo *SnapWindowInfo, snapEdge models.SnapEdge) {
	// 获取主窗口位置和尺寸
	mainPos, _ := wss.getWindowPosition(wss.mainWindow)
	mainWidth, mainHeight := wss.mainWindow.Size()

	// 获取子窗口位置和尺寸
	windowPos, _ := wss.getWindowPosition(windowInfo.Window)
	windowWidth, windowHeight := windowInfo.Window.Size()

	// 计算目标位置
	var targetX, targetY int

	switch snapEdge {
	case models.SnapEdgeRight:
		// 吸附到主窗口右侧
		targetX = mainPos.X + mainWidth
		targetY = windowPos.Y // 保持当前 Y 位置
		// 如果超出主窗口范围，调整到边界
		if targetY < mainPos.Y {
			targetY = mainPos.Y
		} else if targetY+windowHeight > mainPos.Y+mainHeight {
			targetY = mainPos.Y + mainHeight - windowHeight
		}

	case models.SnapEdgeLeft:
		// 吸附到主窗口左侧
		targetX = mainPos.X - windowWidth
		targetY = windowPos.Y // 保持当前 Y 位置
		// 如果超出主窗口范围，调整到边界
		if targetY < mainPos.Y {
			targetY = mainPos.Y
		} else if targetY+windowHeight > mainPos.Y+mainHeight {
			targetY = mainPos.Y + mainHeight - windowHeight
		}

	case models.SnapEdgeBottom:
		// 吸附到主窗口底部
		targetX = windowPos.X // 保持当前 X 位置
		targetY = mainPos.Y + mainHeight
		// 如果超出主窗口范围，调整到边界
		if targetX < mainPos.X {
			targetX = mainPos.X
		} else if targetX+windowWidth > mainPos.X+mainWidth {
			targetX = mainPos.X + mainWidth - windowWidth
		}

	case models.SnapEdgeTop:
		// 吸附到主窗口顶部
		targetX = windowPos.X // 保持当前 X 位置
		targetY = mainPos.Y - windowHeight
		// 如果超出主窗口范围，调整到边界
		if targetX < mainPos.X {
			targetX = mainPos.X
		} else if targetX+windowWidth > mainPos.X+mainWidth {
			targetX = mainPos.X + mainWidth - windowWidth
		}

	// ==== 角落吸附 ====
	case models.SnapEdgeTopRight:
		// 吸附到右上角
		targetX = mainPos.X + mainWidth
		targetY = mainPos.Y - windowHeight

	case models.SnapEdgeBottomRight:
		// 吸附到右下角
		targetX = mainPos.X + mainWidth
		targetY = mainPos.Y + mainHeight

	case models.SnapEdgeBottomLeft:
		// 吸附到左下角
		targetX = mainPos.X - windowWidth
		targetY = mainPos.Y + mainHeight

	case models.SnapEdgeTopLeft:
		// 吸附到左上角
		targetX = mainPos.X - windowWidth
		targetY = mainPos.Y - windowHeight

	default:
		// 不应该到达这里
		return
	}

	// 直接移动到目标位置，不使用平滑过渡以产生明显的吸附效果
	windowInfo.Window.SetPosition(targetX, targetY)

	// 更新窗口信息
	windowInfo.SnapEdge = snapEdge
	windowInfo.LastPos = models.WindowPosition{X: targetX, Y: targetY}
}

// Cleanup 清理资源
func (wss *WindowSnapService) Cleanup() {
	// 如果有取消函数，调用它来停止所有goroutine
	if wss.cancel != nil {
		wss.cancel()
	}

	// 停止定时器
	if wss.snapTicker != nil {
		wss.snapTicker.Stop()
		wss.snapTicker = nil
	}
}

// ServiceShutdown 实现服务关闭接口
func (wss *WindowSnapService) ServiceShutdown() error {
	wss.Cleanup()
	return nil
}
