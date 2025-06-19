package services

import (
	"archive/zip"
	"context"
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
	MigrationStatusMigrating MigrationStatus = "migrating" // 迁移中
	MigrationStatusCompleted MigrationStatus = "completed" // 完成
	MigrationStatusFailed    MigrationStatus = "failed"    // 失败
)

// MigrationProgress 迁移进度信息
type MigrationProgress struct {
	Status   MigrationStatus `json:"status"`          // 迁移状态
	Progress float64         `json:"progress"`        // 进度百分比 (0-100)
	Error    string          `json:"error,omitempty"` // 错误信息
}

// MigrationService 迁移服务
type MigrationService struct {
	logger          *log.LoggerService
	mu              sync.RWMutex
	currentProgress MigrationProgress
	cancelFunc      context.CancelFunc
	ctx             context.Context
}

// NewMigrationService 创建迁移服务
func NewMigrationService(logger *log.LoggerService) *MigrationService {
	if logger == nil {
		logger = log.New()
	}

	return &MigrationService{
		logger: logger,
		currentProgress: MigrationProgress{
			Status:   MigrationStatusCompleted, // 初始状态为完成
			Progress: 0,
		},
	}
}

// GetProgress 获取当前进度
func (ms *MigrationService) GetProgress() MigrationProgress {
	ms.mu.RLock()
	defer ms.mu.RUnlock()
	return ms.currentProgress
}

// updateProgress 更新进度
func (ms *MigrationService) updateProgress(progress MigrationProgress) {
	ms.mu.Lock()
	ms.currentProgress = progress
	ms.mu.Unlock()
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

	ms.logger.Info("Migration: Starting directory migration", "from", srcPath, "to", dstPath)

	// 初始化进度
	progress := MigrationProgress{
		Status:   MigrationStatusMigrating,
		Progress: 0,
	}
	ms.updateProgress(progress)

	// 检查源目录是否存在
	if _, err := os.Stat(srcPath); os.IsNotExist(err) {
		progress.Status = MigrationStatusCompleted
		progress.Progress = 100
		ms.updateProgress(progress)
		return nil
	}

	// 如果路径相同，不需要迁移
	srcAbs, _ := filepath.Abs(srcPath)
	dstAbs, _ := filepath.Abs(dstPath)
	if srcAbs == dstAbs {
		progress.Status = MigrationStatusCompleted
		progress.Progress = 100
		ms.updateProgress(progress)
		return nil
	}

	// 检查目标路径是否是源路径的子目录
	if ms.isSubDirectory(srcAbs, dstAbs) {
		progress.Status = MigrationStatusFailed
		progress.Error = "Target path cannot be a subdirectory of source path"
		ms.updateProgress(progress)
		return fmt.Errorf("target path cannot be a subdirectory of source path")
	}

	// 执行原子迁移
	err := ms.atomicMove(ctx, srcPath, dstPath, &progress)
	if err != nil {
		progress.Status = MigrationStatusFailed
		progress.Error = err.Error()
		ms.updateProgress(progress)
		return err
	}

	// 迁移完成
	progress.Status = MigrationStatusCompleted
	progress.Progress = 100
	ms.updateProgress(progress)

	ms.logger.Info("Migration: Directory migration completed", "from", srcPath, "to", dstPath)
	return nil
}

// atomicMove 原子移动目录
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
		return fmt.Errorf("Failed to create target parent directory")
	}

	// 检查目标路径情况
	if stat, err := os.Stat(dstPath); err == nil {
		if !stat.IsDir() {
			return fmt.Errorf("Target path exists but is not a directory")
		}
		isEmpty, err := ms.isDirectoryEmpty(dstPath)
		if err != nil {
			return fmt.Errorf("Failed to check target directory")
		}
		if !isEmpty {
			return fmt.Errorf("Target directory is not empty")
		}
	}

	// 尝试直接重命名（如果在同一分区，这会很快）
	progress.Progress = 20
	ms.updateProgress(*progress)

	if err := os.Rename(srcPath, dstPath); err == nil {
		ms.logger.Info("Migration: Fast rename successful")
		return nil
	} else {
		ms.logger.Info("Migration: Fast rename failed, using copy method", "error", err)
	}

	// 重命名失败，使用压缩迁移
	progress.Progress = 30
	ms.updateProgress(*progress)

	return ms.atomicCompressMove(ctx, srcPath, dstPath, progress)
}

// atomicCompressMove 原子压缩迁移
func (ms *MigrationService) atomicCompressMove(ctx context.Context, srcPath, dstPath string, progress *MigrationProgress) error {
	tempDir := os.TempDir()
	tempZipFile := filepath.Join(tempDir, fmt.Sprintf("voidraft_migration_%d.zip", time.Now().UnixNano()))

	defer func() {
		if err := os.Remove(tempZipFile); err != nil && !os.IsNotExist(err) {
			ms.logger.Error("Migration: Failed to clean up temporary zip file", "error", err)
		}
	}()

	// 压缩源目录
	progress.Progress = 40
	ms.updateProgress(*progress)

	if err := ms.compressDirectory(ctx, srcPath, tempZipFile); err != nil {
		return fmt.Errorf("Failed to compress source directory")
	}

	// 解压到目标位置
	progress.Progress = 70
	ms.updateProgress(*progress)

	if err := ms.extractToDirectory(ctx, tempZipFile, dstPath); err != nil {
		return fmt.Errorf("Failed to extract to target location")
	}

	// 检查是否取消
	select {
	case <-ctx.Done():
		os.RemoveAll(dstPath)
		return ctx.Err()
	default:
	}

	// 删除源目录
	progress.Progress = 90
	ms.updateProgress(*progress)

	if err := os.RemoveAll(srcPath); err != nil {
		ms.logger.Error("Migration: Failed to remove source directory", "error", err)
	}

	return nil
}

// compressDirectory 压缩目录到zip文件
func (ms *MigrationService) compressDirectory(ctx context.Context, srcDir, zipFile string) error {
	zipWriter, err := os.Create(zipFile)
	if err != nil {
		return fmt.Errorf("Failed to create temporary file")
	}
	defer zipWriter.Close()

	zw := zip.NewWriter(zipWriter)
	defer zw.Close()

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

		relPath, err := filepath.Rel(srcDir, filePath)
		if err != nil {
			return err
		}

		if relPath == "." {
			return nil
		}

		header, err := zip.FileInfoHeader(info)
		if err != nil {
			return err
		}

		header.Name = strings.ReplaceAll(relPath, string(filepath.Separator), "/")

		if info.IsDir() {
			header.Name += "/"
			header.Method = zip.Store
		} else {
			header.Method = zip.Deflate
		}

		writer, err := zw.CreateHeader(header)
		if err != nil {
			return err
		}

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
func (ms *MigrationService) extractToDirectory(ctx context.Context, zipFile, dstDir string) error {
	reader, err := zip.OpenReader(zipFile)
	if err != nil {
		return fmt.Errorf("Failed to open temporary file")
	}
	defer reader.Close()

	if err := os.MkdirAll(dstDir, 0755); err != nil {
		return fmt.Errorf("Failed to create target directory")
	}

	for _, file := range reader.File {
		// 检查是否取消
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		dstPath := filepath.Join(dstDir, file.Name)

		// 安全检查：防止zip slip攻击
		if !strings.HasPrefix(dstPath, filepath.Clean(dstDir)+string(os.PathSeparator)) {
			return fmt.Errorf("Invalid file path in archive")
		}

		if file.FileInfo().IsDir() {
			if err := os.MkdirAll(dstPath, file.FileInfo().Mode()); err != nil {
				return err
			}
			continue
		}

		if err := os.MkdirAll(filepath.Dir(dstPath), 0755); err != nil {
			return err
		}

		if err := ms.extractFile(file, dstPath); err != nil {
			return err
		}
	}

	return nil
}

// extractFile 解压单个文件
func (ms *MigrationService) extractFile(file *zip.File, dstPath string) error {
	srcFile, err := file.Open()
	if err != nil {
		return err
	}
	defer srcFile.Close()

	dstFile, err := os.OpenFile(dstPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, file.FileInfo().Mode())
	if err != nil {
		return err
	}
	defer dstFile.Close()

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

	_, err = f.Readdir(1)
	if err == io.EOF {
		return true, nil
	}
	if err != nil {
		return false, err
	}
	return false, nil
}

// isSubDirectory 检查target是否是parent的子目录
func (ms *MigrationService) isSubDirectory(parent, target string) bool {
	parent = filepath.Clean(parent) + string(filepath.Separator)
	target = filepath.Clean(target) + string(filepath.Separator)
	return len(target) > len(parent) && target[:len(parent)] == parent
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

	return fmt.Errorf("No active migration to cancel")
}

// ServiceShutdown 服务关闭
func (ms *MigrationService) ServiceShutdown() error {
	ms.logger.Info("Migration: Service is shutting down...")
	if err := ms.CancelMigration(); err != nil {
		ms.logger.Debug("Migration: No active migration to cancel during shutdown")
	}
	ms.logger.Info("Migration: Service shutdown completed")
	return nil
}
