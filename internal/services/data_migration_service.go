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
	"sync/atomic"
	"time"

	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// MigrationStatus 迁移状态
type MigrationStatus string

const (
	MigrationStatusMigrating MigrationStatus = "migrating"
	MigrationStatusCompleted MigrationStatus = "completed"
	MigrationStatusFailed    MigrationStatus = "failed"
)

// MigrationProgress 迁移进度信息
type MigrationProgress struct {
	Status   MigrationStatus `json:"status"`
	Progress float64         `json:"progress"`
	Error    string          `json:"error,omitempty"`
}

// MigrationService 迁移服务
type MigrationService struct {
	logger    *log.LogService
	dbService *DatabaseService
	mu        sync.RWMutex
	progress  atomic.Value // stores MigrationProgress

	ctx    context.Context
	cancel context.CancelFunc
}

// NewMigrationService 创建迁移服务
func NewMigrationService(dbService *DatabaseService, logger *log.LogService) *MigrationService {
	if logger == nil {
		logger = log.New()
	}

	ms := &MigrationService{
		logger:    logger,
		dbService: dbService,
	}

	// 初始化进度
	ms.progress.Store(MigrationProgress{
		Status:   MigrationStatusCompleted,
		Progress: 0,
	})

	return ms
}

// GetProgress 获取当前进度
func (ms *MigrationService) GetProgress() MigrationProgress {
	return ms.progress.Load().(MigrationProgress)
}

// updateProgress 更新进度
func (ms *MigrationService) updateProgress(progress MigrationProgress) {
	ms.progress.Store(progress)
}

// MigrateDirectory 迁移目录
func (ms *MigrationService) MigrateDirectory(srcPath, dstPath string) error {
	// 创建可取消的上下文
	ctx, cancel := context.WithCancel(context.Background())
	ms.mu.Lock()
	ms.ctx = ctx
	ms.cancel = cancel
	ms.mu.Unlock()

	defer func() {
		ms.mu.Lock()
		ms.cancel = nil
		ms.ctx = nil
		ms.mu.Unlock()
	}()

	// 初始化进度
	ms.updateProgress(MigrationProgress{
		Status:   MigrationStatusMigrating,
		Progress: 0,
	})

	// 预检查
	if err := ms.preCheck(srcPath, dstPath); err != nil {
		if err == errNoMigrationNeeded {
			ms.updateProgress(MigrationProgress{
				Status:   MigrationStatusCompleted,
				Progress: 100,
			})
			return nil
		}
		return ms.failWithError(err)
	}

	// 迁移前断开数据库连接
	ms.updateProgress(MigrationProgress{
		Status:   MigrationStatusMigrating,
		Progress: 10,
	})

	if ms.dbService != nil {
		if err := ms.dbService.ServiceShutdown(); err != nil {
			ms.logger.Error("Failed to close database connection", "error", err)
		}
	}

	// 执行原子迁移
	if err := ms.atomicMove(ctx, srcPath, dstPath); err != nil {
		return ms.failWithError(err)
	}

	// 迁移完成后重新连接数据库
	ms.updateProgress(MigrationProgress{
		Status:   MigrationStatusMigrating,
		Progress: 95,
	})

	if ms.dbService != nil {
		if err := ms.dbService.initDatabase(); err != nil {
			return ms.failWithError(fmt.Errorf("failed to reconnect database: %v", err))
		}
	}

	// 迁移完成
	ms.updateProgress(MigrationProgress{
		Status:   MigrationStatusCompleted,
		Progress: 100,
	})

	return nil
}

var errNoMigrationNeeded = fmt.Errorf("no migration needed")

// preCheck 预检查
func (ms *MigrationService) preCheck(srcPath, dstPath string) error {
	// 检查源目录是否存在
	if _, err := os.Stat(srcPath); os.IsNotExist(err) {
		return errNoMigrationNeeded
	}

	// 如果路径相同，不需要迁移
	srcAbs, _ := filepath.Abs(srcPath)
	dstAbs, _ := filepath.Abs(dstPath)
	if srcAbs == dstAbs {
		return errNoMigrationNeeded
	}

	// 检查目标路径是否是源路径的子目录
	if ms.isSubDirectory(srcAbs, dstAbs) {
		return fmt.Errorf("target path cannot be a subdirectory of source path")
	}

	return nil
}

// failWithError 失败并记录错误
func (ms *MigrationService) failWithError(err error) error {
	ms.updateProgress(MigrationProgress{
		Status: MigrationStatusFailed,
		Error:  err.Error(),
	})
	return err
}

// atomicMove 原子移动目录
func (ms *MigrationService) atomicMove(ctx context.Context, srcPath, dstPath string) error {
	// 检查是否取消
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	// 确保目标目录的父目录存在
	if err := os.MkdirAll(filepath.Dir(dstPath), 0755); err != nil {
		return fmt.Errorf("failed to create target parent directory: %v", err)
	}

	// 检查目标路径
	if err := ms.checkTargetPath(dstPath); err != nil {
		return err
	}

	// 尝试直接重命名
	ms.updateProgress(MigrationProgress{
		Status:   MigrationStatusMigrating,
		Progress: 20,
	})

	if err := os.Rename(srcPath, dstPath); err == nil {
		// 重命名成功，更新进度到90%
		ms.updateProgress(MigrationProgress{
			Status:   MigrationStatusMigrating,
			Progress: 90,
		})
		ms.logger.Info("Directory migration completed using direct rename", "src", srcPath, "dst", dstPath)
		return nil
	}

	// 重命名失败，使用压缩迁移
	ms.logger.Info("Direct rename failed, using compress migration", "src", srcPath, "dst", dstPath)
	ms.updateProgress(MigrationProgress{
		Status:   MigrationStatusMigrating,
		Progress: 30,
	})

	return ms.compressMove(ctx, srcPath, dstPath)
}

// checkTargetPath 检查目标路径
func (ms *MigrationService) checkTargetPath(dstPath string) error {
	stat, err := os.Stat(dstPath)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("failed to check target path: %v", err)
	}

	if !stat.IsDir() {
		return fmt.Errorf("target path exists but is not a directory")
	}

	isEmpty, err := ms.isDirectoryEmpty(dstPath)
	if err != nil {
		return fmt.Errorf("failed to check target directory: %v", err)
	}
	if !isEmpty {
		return fmt.Errorf("target directory is not empty")
	}

	return nil
}

// compressMove 压缩迁移
func (ms *MigrationService) compressMove(ctx context.Context, srcPath, dstPath string) error {
	tempZipFile := filepath.Join(os.TempDir(),
		fmt.Sprintf("voidraft_migration_%d.zip", time.Now().UnixNano()))

	defer os.Remove(tempZipFile)

	// 压缩源目录
	ms.updateProgress(MigrationProgress{
		Status:   MigrationStatusMigrating,
		Progress: 40,
	})

	if err := ms.compressDirectory(ctx, srcPath, tempZipFile); err != nil {
		return fmt.Errorf("failed to compress source directory: %v", err)
	}

	// 解压到目标位置
	ms.updateProgress(MigrationProgress{
		Status:   MigrationStatusMigrating,
		Progress: 70,
	})

	if err := ms.extractToDirectory(ctx, tempZipFile, dstPath); err != nil {
		return fmt.Errorf("failed to extract to target location: %v", err)
	}

	// 检查是否取消
	select {
	case <-ctx.Done():
		os.RemoveAll(dstPath)
		return ctx.Err()
	default:
	}

	// 验证迁移是否成功
	if err := ms.verifyMigration(dstPath); err != nil {
		// 迁移验证失败，清理目标目录
		os.RemoveAll(dstPath)
		return fmt.Errorf("migration verification failed: %v", err)
	}

	// 删除源目录
	ms.updateProgress(MigrationProgress{
		Status:   MigrationStatusMigrating,
		Progress: 90,
	})
	os.RemoveAll(srcPath)
	return nil
}

// compressDirectory 压缩目录到zip文件
func (ms *MigrationService) compressDirectory(ctx context.Context, srcDir, zipFile string) error {
	zipWriter, err := os.Create(zipFile)
	if err != nil {
		return err
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
		if err != nil || relPath == "." {
			return err
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
			return ms.copyFileToZip(filePath, writer)
		}
		return nil
	})
}

// copyFileToZip 复制文件到zip
func (ms *MigrationService) copyFileToZip(filePath string, writer io.Writer) error {
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = io.Copy(writer, file)
	return err
}

// extractToDirectory 从zip文件解压到目录
func (ms *MigrationService) extractToDirectory(ctx context.Context, zipFile, dstDir string) error {
	reader, err := zip.OpenReader(zipFile)
	if err != nil {
		return err
	}
	defer reader.Close()

	if err := os.MkdirAll(dstDir, 0755); err != nil {
		return err
	}

	for _, file := range reader.File {
		// 检查是否取消
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		if err := ms.extractSingleFile(file, dstDir); err != nil {
			return err
		}
	}

	return nil
}

// extractSingleFile 解压单个文件
func (ms *MigrationService) extractSingleFile(file *zip.File, dstDir string) error {
	dstPath := filepath.Join(dstDir, file.Name)

	// 安全检查：防止zip slip攻击
	if !strings.HasPrefix(dstPath, filepath.Clean(dstDir)+string(os.PathSeparator)) {
		return fmt.Errorf("invalid file path in archive: %s", file.Name)
	}

	if file.FileInfo().IsDir() {
		return os.MkdirAll(dstPath, file.FileInfo().Mode())
	}

	if err := os.MkdirAll(filepath.Dir(dstPath), 0755); err != nil {
		return err
	}

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
	return err == io.EOF, nil
}

// isSubDirectory 检查target是否是parent的子目录
func (ms *MigrationService) isSubDirectory(parent, target string) bool {
	parent = filepath.Clean(parent) + string(filepath.Separator)
	target = filepath.Clean(target) + string(filepath.Separator)
	return len(target) > len(parent) && strings.HasPrefix(target, parent)
}

// verifyMigration 验证迁移是否成功
func (ms *MigrationService) verifyMigration(dstPath string) error {
	// 检查目标目录是否存在
	dstStat, err := os.Stat(dstPath)
	if err != nil {
		return fmt.Errorf("target directory does not exist: %v", err)
	}
	if !dstStat.IsDir() {
		return fmt.Errorf("target path is not a directory")
	}

	// 简单验证：检查目标目录是否非空
	isEmpty, err := ms.isDirectoryEmpty(dstPath)
	if err != nil {
		return fmt.Errorf("failed to check target directory: %v", err)
	}
	if isEmpty {
		return fmt.Errorf("target directory is empty after migration")
	}

	return nil
}

// CancelMigration 取消迁移
func (ms *MigrationService) CancelMigration() error {
	ms.mu.Lock()
	defer ms.mu.Unlock()

	if ms.cancel != nil {
		ms.cancel()
		return nil
	}

	return fmt.Errorf("no active migration to cancel")
}

// ServiceShutdown 服务关闭
func (ms *MigrationService) ServiceShutdown() error {
	ms.CancelMigration()
	return nil
}
