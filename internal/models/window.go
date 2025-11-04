package models

import "time"

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
