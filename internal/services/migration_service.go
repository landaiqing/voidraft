package services

import (
	"archive/zip"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// MigrationStatus 迁移状态
type MigrationStatus string

const (
	MigrationStatusIdle      MigrationStatus = "idle"      // 空闲状态
	MigrationStatusPreparing MigrationStatus = "preparing" // 准备中
	MigrationStatusMigrating MigrationStatus = "migrating" // 迁移中
	MigrationStatusCompleted MigrationStatus = "completed" // 完成
	MigrationStatusFailed    MigrationStatus = "failed"    // 失败
	MigrationStatusCancelled MigrationStatus = "cancelled" // 取消
)

// MigrationProgress 迁移进度信息
type MigrationProgress struct {
	Status         MigrationStatus `json:"status"`          // 迁移状态
	CurrentFile    string          `json:"currentFile"`     // 当前处理的文件
	ProcessedFiles int             `json:"processedFiles"`  // 已处理文件数
	TotalFiles     int             `json:"totalFiles"`      // 总文件数
	ProcessedBytes int64           `json:"processedBytes"`  // 已处理字节数
	TotalBytes     int64           `json:"totalBytes"`      // 总字节数
	Progress       float64         `json:"progress"`        // 进度百分比 (0-100)
	Message        string          `json:"message"`         // 状态消息
	Error          string          `json:"error,omitempty"` // 错误信息
	StartTime      time.Time       `json:"startTime"`       // 开始时间
	EstimatedTime  time.Duration   `json:"estimatedTime"`   // 估计剩余时间
}

// MigrationProgressCallback 进度回调函数类型
type MigrationProgressCallback func(progress MigrationProgress)

// MigrationService 迁移服务
type MigrationService struct {
	logger           *log.LoggerService
	mu               sync.RWMutex
	currentProgress  MigrationProgress
	progressCallback MigrationProgressCallback
	cancelFunc       context.CancelFunc
	ctx              context.Context
}

// NewMigrationService 创建迁移服务
func NewMigrationService(logger *log.LoggerService) *MigrationService {
	if logger == nil {
		logger = log.New()
	}

	return &MigrationService{
		logger: logger,
		currentProgress: MigrationProgress{
			Status: MigrationStatusIdle,
		},
	}
}

// SetProgressCallback 设置进度回调
func (ms *MigrationService) SetProgressCallback(callback MigrationProgressCallback) {
	ms.mu.Lock()
	defer ms.mu.Unlock()
	ms.progressCallback = callback
}

// GetProgress 获取当前进度
func (ms *MigrationService) GetProgress() MigrationProgress {
	ms.mu.RLock()
	defer ms.mu.RUnlock()
	return ms.currentProgress
}

// updateProgress 更新进度并触发回调
func (ms *MigrationService) updateProgress(progress MigrationProgress) {
	ms.mu.Lock()
	ms.currentProgress = progress
	callback := ms.progressCallback
	ms.mu.Unlock()

	if callback != nil {
		callback(progress)
	}
}

// MigrateDirectory 迁移目录
func (ms *MigrationService) MigrateDirectory(srcPath, dstPath string) error {
	// 创建可取消的上下文
	ctx, cancel := context.WithCancel(context.Background())
	ms.mu.Lock()
	ms.ctx = ctx
	ms.cancelFunc = cancel
	ms.mu.Unlock()

	defer func() {
		ms.mu.Lock()
		ms.cancelFunc = nil
		ms.ctx = nil
		ms.mu.Unlock()
	}()

	ms.logger.Info("Migration: Starting directory migration",
		"from", srcPath,
		"to", dstPath)

	// 初始化进度
	progress := MigrationProgress{
		Status:    MigrationStatusPreparing,
		Message:   "Preparing migration...",
		StartTime: time.Now(),
	}
	ms.updateProgress(progress)

	// 检查源目录是否存在
	if _, err := os.Stat(srcPath); os.IsNotExist(err) {
		progress.Status = MigrationStatusCompleted
		progress.Message = "Source directory does not exist, skipping migration"
		progress.Progress = 100
		ms.updateProgress(progress)
		return nil
	}

	// 如果路径相同，不需要迁移
	srcAbs, _ := filepath.Abs(srcPath)
	dstAbs, _ := filepath.Abs(dstPath)
	if srcAbs == dstAbs {
		progress.Status = MigrationStatusCompleted
		progress.Message = "Paths are identical, no migration needed"
		progress.Progress = 100
		ms.updateProgress(progress)
		return nil
	}

	// 检查目标路径是否是源路径的子目录，防止无限递归复制
	if ms.isSubDirectory(srcAbs, dstAbs) {
		progress.Status = MigrationStatusFailed
		progress.Error = "Target path cannot be a subdirectory of source path, this would cause infinite recursive copying"
		ms.updateProgress(progress)
		return fmt.Errorf("target path cannot be a subdirectory of source path: src=%s, dst=%s", srcAbs, dstAbs)
	}

	// 计算目录大小（用于显示进度）
	totalFiles, totalBytes, err := ms.calculateDirectorySize(ctx, srcPath)
	if err != nil {
		progress.Status = MigrationStatusFailed
		progress.Error = fmt.Sprintf("Failed to calculate directory size: %v", err)
		ms.updateProgress(progress)
		return err
	}

	progress.TotalFiles = totalFiles
	progress.TotalBytes = totalBytes
	progress.Status = MigrationStatusMigrating
	progress.Message = "Starting atomic migration..."
	ms.updateProgress(progress)

	// 执行原子迁移
	err = ms.atomicMove(ctx, srcPath, dstPath, &progress)
	if err != nil {
		if errors.Is(ctx.Err(), context.Canceled) {
			progress.Status = MigrationStatusCancelled
			progress.Error = "Migration cancelled"
		} else {
			progress.Status = MigrationStatusFailed
			progress.Error = fmt.Sprintf("Migration failed: %v", err)
		}
		ms.updateProgress(progress)
		return err
	}

	// 迁移完成
	progress.Status = MigrationStatusCompleted
	progress.Message = "Migration completed"
	progress.Progress = 100
	progress.ProcessedFiles = totalFiles
	progress.ProcessedBytes = totalBytes
	duration := time.Since(progress.StartTime)
	ms.updateProgress(progress)

	ms.logger.Info("Migration: Directory migration completed",
		"from", srcPath,
		"to", dstPath,
		"duration", duration,
		"files", totalFiles,
		"bytes", totalBytes)

	return nil
}

// atomicMove 原子移动目录 - 使用压缩-移动-解压的方式
func (ms *MigrationService) atomicMove(ctx context.Context, srcPath, dstPath string, progress *MigrationProgress) error {
	// 检查是否取消
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	// 确保目标目录的父目录存在
	dstParent := filepath.Dir(dstPath)
	if err := os.MkdirAll(dstParent, 0755); err != nil {
		return fmt.Errorf("Failed to create target parent directory: %v", err)
	}

	// 检查目标路径情况
	if stat, err := os.Stat(dstPath); err == nil {
		if !stat.IsDir() {
			return fmt.Errorf("Target path exists but is not a directory: %s", dstPath)
		}

		// 检查目录是否为空
		isEmpty, err := ms.isDirectoryEmpty(dstPath)
		if err != nil {
			return fmt.Errorf("Failed to check if target directory is empty: %v", err)
		}

		if !isEmpty {
			return fmt.Errorf("Target directory is not empty: %s", dstPath)
		}

		// 目录存在但为空，可以继续迁移
		ms.logger.Info("Migration: Target directory exists but is empty, proceeding with migration")
	}

	// 尝试直接重命名（如果在同一分区，这会很快）
	progress.Message = "Attempting fast move..."
	ms.updateProgress(*progress)

	if err := os.Rename(srcPath, dstPath); err == nil {
		// 重命名成功，这是最快的方式
		ms.logger.Info("Migration: Fast rename successful")
		return nil
	}

	// 重命名失败（可能跨分区），使用原子压缩迁移
	progress.Message = "Starting atomic compress migration..."
	ms.updateProgress(*progress)

	return ms.atomicCompressMove(ctx, srcPath, dstPath, progress)
}

// atomicCompressMove 原子压缩迁移 - 压缩、移动、解压、清理
func (ms *MigrationService) atomicCompressMove(ctx context.Context, srcPath, dstPath string, progress *MigrationProgress) error {
	// 创建临时压缩文件
	tempDir := os.TempDir()
	tempZipFile := filepath.Join(tempDir, fmt.Sprintf("voidraft_migration_%d.zip", time.Now().UnixNano()))

	// 确保临时文件在函数结束时被清理
	defer func() {
		if err := os.Remove(tempZipFile); err != nil && !os.IsNotExist(err) {
			ms.logger.Error("Migration: Failed to clean up temporary zip file", "file", tempZipFile, "error", err)
		}
	}()

	// 第一步: 压缩源目录
	progress.Message = "Compressing source directory..."
	progress.Progress = 10
	ms.updateProgress(*progress)

	if err := ms.compressDirectory(ctx, srcPath, tempZipFile, progress); err != nil {
		return fmt.Errorf("Failed to compress source directory: %v", err)
	}

	// 检查是否取消
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	// 第二步: 解压到目标位置
	progress.Message = "Extracting to target location..."
	progress.Progress = 70
	ms.updateProgress(*progress)

	if err := ms.extractToDirectory(ctx, tempZipFile, dstPath, progress); err != nil {
		return fmt.Errorf("Failed to extract to target location: %v", err)
	}

	// 检查是否取消
	select {
	case <-ctx.Done():
		// 如果取消，需要清理已解压的目标目录
		os.RemoveAll(dstPath)
		return ctx.Err()
	default:
	}

	// 第三步: 删除源目录
	progress.Message = "Cleaning up source directory..."
	progress.Progress = 90
	ms.updateProgress(*progress)

	if err := os.RemoveAll(srcPath); err != nil {
		ms.logger.Error("Migration: Failed to remove source directory", "error", err)
		// 不返回错误，因为迁移已经成功
	}

	progress.Message = "Migration completed"
	progress.Progress = 100
	ms.updateProgress(*progress)

	ms.logger.Info("Migration: Atomic compress-move completed successfully")
	return nil
}

// compressDirectory 压缩目录到zip文件
func (ms *MigrationService) compressDirectory(ctx context.Context, srcDir, zipFile string, progress *MigrationProgress) error {
	// 创建zip文件
	zipWriter, err := os.Create(zipFile)
	if err != nil {
		return fmt.Errorf("Failed to create zip file: %v", err)
	}
	defer zipWriter.Close()

	// 创建zip writer
	zw := zip.NewWriter(zipWriter)
	defer zw.Close()

	// 遍历源目录并添加到zip
	return filepath.Walk(srcDir, func(filePath string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// 检查是否取消
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// 计算相对路径
		relPath, err := filepath.Rel(srcDir, filePath)
		if err != nil {
			return err
		}

		// 跳过根目录
		if relPath == "." {
			return nil
		}

		// 更新当前处理的文件
		progress.CurrentFile = relPath
		ms.updateProgress(*progress)

		// 创建zip中的文件头
		header, err := zip.FileInfoHeader(info)
		if err != nil {
			return err
		}

		// 使用/作为路径分隔符（zip标准）
		header.Name = strings.ReplaceAll(relPath, string(filepath.Separator), "/")

		// 处理目录
		if info.IsDir() {
			header.Name += "/"
			header.Method = zip.Store
		} else {
			header.Method = zip.Deflate
		}

		// 写入zip文件头
		writer, err := zw.CreateHeader(header)
		if err != nil {
			return err
		}

		// 如果是文件，复制内容
		if !info.IsDir() {
			file, err := os.Open(filePath)
			if err != nil {
				return err
			}
			defer file.Close()

			_, err = io.Copy(writer, file)
			if err != nil {
				return err
			}
		}

		return nil
	})
}

// extractToDirectory 从zip文件解压到目录
func (ms *MigrationService) extractToDirectory(ctx context.Context, zipFile, dstDir string, progress *MigrationProgress) error {
	// 打开zip文件
	reader, err := zip.OpenReader(zipFile)
	if err != nil {
		return fmt.Errorf("Failed to open zip file: %v", err)
	}
	defer reader.Close()

	// 确保目标目录存在
	if err := os.MkdirAll(dstDir, 0755); err != nil {
		return fmt.Errorf("Failed to create target directory: %v", err)
	}

	// 解压每个文件
	for _, file := range reader.File {
		// 检查是否取消
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// 更新当前处理的文件
		progress.CurrentFile = file.Name
		ms.updateProgress(*progress)

		// 构建目标文件路径
		dstPath := filepath.Join(dstDir, file.Name)

		// 安全检查：防止zip slip攻击
		if !strings.HasPrefix(dstPath, filepath.Clean(dstDir)+string(os.PathSeparator)) {
			return fmt.Errorf("Invalid file path: %s", file.Name)
		}

		// 处理目录
		if file.FileInfo().IsDir() {
			if err := os.MkdirAll(dstPath, file.FileInfo().Mode()); err != nil {
				return err
			}
			continue
		}

		// 确保父目录存在
		if err := os.MkdirAll(filepath.Dir(dstPath), 0755); err != nil {
			return err
		}

		// 解压文件
		if err := ms.extractFile(file, dstPath); err != nil {
			return err
		}
	}

	return nil
}

// extractFile 解压单个文件
func (ms *MigrationService) extractFile(file *zip.File, dstPath string) error {
	// 打开zip中的文件
	srcFile, err := file.Open()
	if err != nil {
		return err
	}
	defer srcFile.Close()

	// 创建目标文件
	dstFile, err := os.OpenFile(dstPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, file.FileInfo().Mode())
	if err != nil {
		return err
	}
	defer dstFile.Close()

	// 复制文件内容
	_, err = io.Copy(dstFile, srcFile)
	return err
}

// isDirectoryEmpty 检查目录是否为空
func (ms *MigrationService) isDirectoryEmpty(dirPath string) (bool, error) {
	f, err := os.Open(dirPath)
	if err != nil {
		return false, err
	}
	defer f.Close()

	// 尝试读取一个条目
	_, err = f.Readdir(1)
	if err == io.EOF {
		// 目录为空
		return true, nil
	}
	if err != nil {
		return false, err
	}
	// 目录不为空
	return false, nil
}

// isSubDirectory 检查target是否是parent的子目录
func (ms *MigrationService) isSubDirectory(parent, target string) bool {
	// 确保路径以分隔符结尾，以避免误判
	parent = filepath.Clean(parent) + string(filepath.Separator)
	target = filepath.Clean(target) + string(filepath.Separator)

	// 检查target是否以parent开头
	return len(target) > len(parent) && target[:len(parent)] == parent
}

// calculateDirectorySize 计算目录大小和文件数
func (ms *MigrationService) calculateDirectorySize(ctx context.Context, dirPath string) (int, int64, error) {
	var totalFiles int
	var totalBytes int64

	err := filepath.Walk(dirPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// 检查是否取消
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		if !info.IsDir() {
			totalFiles++
			totalBytes += info.Size()
		}
		return nil
	})

	return totalFiles, totalBytes, err
}

// CancelMigration 取消迁移
func (ms *MigrationService) CancelMigration() error {
	ms.mu.Lock()
	defer ms.mu.Unlock()

	if ms.cancelFunc != nil {
		ms.cancelFunc()
		ms.logger.Info("Migration: Cancellation requested")
		return nil
	}

	return fmt.Errorf("no active migration to cancel")
}

// ServiceShutdown 服务关闭
func (ms *MigrationService) ServiceShutdown() error {
	ms.logger.Info("Migration: Service is shutting down...")

	// 取消正在进行的迁移
	if err := ms.CancelMigration(); err != nil {
		ms.logger.Debug("Migration: No active migration to cancel during shutdown")
	}

	ms.logger.Info("Migration: Service shutdown completed")
	return nil
}
