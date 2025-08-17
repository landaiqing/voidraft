package services

import (
	"fmt"
	"runtime"

	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// SystemService 系统监控服务
type SystemService struct {
	logger *log.LogService
}

// MemoryStats 内存统计信息
type MemoryStats struct {
	// 当前堆内存使用量（字节）
	HeapInUse uint64 `json:"heapInUse"`
	// 堆内存分配总量（字节）
	HeapAlloc uint64 `json:"heapAlloc"`
	// 系统内存使用量（字节）
	Sys uint64 `json:"sys"`
	// GC 次数
	NumGC uint32 `json:"numGC"`
	// GC 暂停时间（纳秒）
	PauseTotalNs uint64 `json:"pauseTotalNs"`
	// Goroutine 数量
	NumGoroutine int `json:"numGoroutine"`
}

// NewSystemService 创建新的系统服务实例
func NewSystemService(logger *log.LogService) *SystemService {
	return &SystemService{
		logger: logger,
	}
}

// GetMemoryStats 获取当前内存统计信息
func (ss *SystemService) GetMemoryStats() MemoryStats {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	return MemoryStats{
		HeapInUse:    m.HeapInuse,
		HeapAlloc:    m.HeapAlloc,
		Sys:          m.Sys,
		NumGC:        m.NumGC,
		PauseTotalNs: m.PauseTotalNs,
		NumGoroutine: runtime.NumGoroutine(),
	}
}

// FormatBytes 格式化字节数为人类可读的格式
func (ss *SystemService) FormatBytes(bytes uint64) string {
	const unit = 1024
	if bytes < unit {
		return "< 1 KB"
	}
	div, exp := uint64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}

	switch exp {
	case 0:
		return "< 1 KB"
	case 1:
		return fmt.Sprintf("%.1f KB", float64(bytes)/float64(div))
	case 2:
		return fmt.Sprintf("%.1f MB", float64(bytes)/float64(div))
	case 3:
		return fmt.Sprintf("%.1f GB", float64(bytes)/float64(div))
	default:
		return fmt.Sprintf("%.1f TB", float64(bytes)/float64(div))
	}
}

// TriggerGC 手动触发垃圾回收
func (ss *SystemService) TriggerGC() {
	runtime.GC()
	ss.logger.Info("Manual GC triggered")
}
