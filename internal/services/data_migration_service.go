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

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// MigrationProgress 迁移进度信息
type MigrationProgress struct {
	Progress float64 `json:"progress"` // 0-100
	Error    string  `json:"error,omitempty"`
}

// MigrationService 迁移服务
type MigrationService struct {
	logger    *log.LogService
	dbService *DatabaseService
	progress  atomic.Value // stores MigrationProgress

	mu     sync.Mutex
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
	ms.progress.Store(MigrationProgress{})
	return ms
}

// GetProgress 获取当前进度
func (ms *MigrationService) GetProgress() MigrationProgress {
	return ms.progress.Load().(MigrationProgress)
}

// setProgress 设置进度
func (ms *MigrationService) setProgress(progress float64) {
	ms.progress.Store(MigrationProgress{Progress: progress})
}

// fail 标记失败并返回错误
func (ms *MigrationService) fail(err error) error {
	ms.progress.Store(MigrationProgress{Error: err.Error()})
	return err
}

// MigrateDirectory 迁移目录
func (ms *MigrationService) MigrateDirectory(srcPath, dstPath string) error {
	// 创建可取消的上下文
	ctx, cancel := context.WithCancel(context.Background())
	ms.mu.Lock()
	ms.ctx, ms.cancel = ctx, cancel
	ms.mu.Unlock()

	defer func() {
		ms.mu.Lock()
		ms.ctx, ms.cancel = nil, nil
		ms.mu.Unlock()
	}()

	ms.setProgress(0)

	// 预检查
	needMigrate, err := ms.preCheck(srcPath, dstPath)
	if err != nil {
		return ms.fail(err)
	}
	if !needMigrate {
		ms.setProgress(100)
		return nil
	}

	// 迁移前断开数据库连接
	ms.setProgress(10)
	if ms.dbService != nil {
		if err := ms.dbService.ServiceShutdown(); err != nil {
			ms.logger.Error("Failed to close database connection", "error", err)
		}
	}

	// 确保失败时恢复数据库连接
	defer func() {
		if ms.dbService != nil {
			if err := ms.dbService.ServiceStartup(ctx, application.ServiceOptions{}); err != nil {
				ms.logger.Error("Failed to reconnect database", "error", err)
			}
		}
	}()

	// 执行原子迁移
	if err := ms.atomicMove(ctx, srcPath, dstPath); err != nil {
		return ms.fail(err)
	}

	ms.setProgress(100)
	return nil
}

// preCheck 预检查，返回是否需要迁移
func (ms *MigrationService) preCheck(srcPath, dstPath string) (bool, error) {
	// 源目录不存在，无需迁移
	if _, err := os.Stat(srcPath); os.IsNotExist(err) {
		return false, nil
	}

	// 路径相同，无需迁移
	srcAbs, _ := filepath.Abs(srcPath)
	dstAbs, _ := filepath.Abs(dstPath)
	if srcAbs == dstAbs {
		return false, nil
	}

	// 目标不能是源的子目录
	if isSubDir(srcAbs, dstAbs) {
		return false, fmt.Errorf("target path cannot be a subdirectory of source path")
	}

	return true, nil
}

// atomicMove 原子移动目录
func (ms *MigrationService) atomicMove(ctx context.Context, srcPath, dstPath string) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	// 确保目标父目录存在
	if err := os.MkdirAll(filepath.Dir(dstPath), 0755); err != nil {
		return fmt.Errorf("failed to create target parent directory: %w", err)
	}

	// 检查目标路径
	if err := ms.checkTargetPath(dstPath); err != nil {
		return err
	}

	ms.setProgress(20)

	// 尝试直接重命名（同一文件系统时最快）
	if err := os.Rename(srcPath, dstPath); err == nil {
		ms.setProgress(90)
		ms.logger.Info("Directory migration completed using direct rename", "src", srcPath, "dst", dstPath)
		return nil
	}

	// 重命名失败（跨文件系统），使用压缩迁移
	ms.logger.Info("Direct rename failed, using compress migration", "src", srcPath, "dst", dstPath)
	ms.setProgress(30)

	return ms.compressMove(ctx, srcPath, dstPath)
}

// checkTargetPath 检查目标路径是否可用
func (ms *MigrationService) checkTargetPath(dstPath string) error {
	stat, err := os.Stat(dstPath)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("failed to check target path: %w", err)
	}
	if !stat.IsDir() {
		return fmt.Errorf("target path exists but is not a directory")
	}

	isEmpty, err := isDirEmpty(dstPath)
	if err != nil {
		return fmt.Errorf("failed to check target directory: %w", err)
	}
	if !isEmpty {
		return fmt.Errorf("target directory is not empty")
	}
	return nil
}

// compressMove 压缩迁移
func (ms *MigrationService) compressMove(ctx context.Context, srcPath, dstPath string) error {
	tempZip := filepath.Join(os.TempDir(), fmt.Sprintf("voidraft_migration_%d.zip", time.Now().UnixNano()))
	defer os.Remove(tempZip)

	// 压缩源目录
	ms.setProgress(40)
	if err := ms.compressDir(ctx, srcPath, tempZip); err != nil {
		return fmt.Errorf("failed to compress source directory: %w", err)
	}

	// 解压到目标位置
	ms.setProgress(70)
	if err := ms.extractZip(ctx, tempZip, dstPath); err != nil {
		return fmt.Errorf("failed to extract to target location: %w", err)
	}

	// 检查取消
	if err := ctx.Err(); err != nil {
		os.RemoveAll(dstPath)
		return err
	}

	// 验证迁移结果
	if err := ms.verifyMigration(dstPath); err != nil {
		os.RemoveAll(dstPath)
		return fmt.Errorf("migration verification failed: %w", err)
	}

	// 删除源目录
	ms.setProgress(90)
	os.RemoveAll(srcPath)
	return nil
}

// compressDir 压缩目录到zip文件
func (ms *MigrationService) compressDir(ctx context.Context, srcDir, zipPath string) error {
	zipFile, err := os.Create(zipPath)
	if err != nil {
		return err
	}
	defer zipFile.Close()

	zw := zip.NewWriter(zipFile)
	defer zw.Close()

	return filepath.Walk(srcDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if err := ctx.Err(); err != nil {
			return err
		}

		relPath, err := filepath.Rel(srcDir, path)
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
			file, err := os.Open(path)
			if err != nil {
				return err
			}
			defer file.Close()
			_, err = io.Copy(writer, file)
			return err
		}
		return nil
	})
}

// extractZip 解压zip文件到目录
func (ms *MigrationService) extractZip(ctx context.Context, zipPath, dstDir string) error {
	reader, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer reader.Close()

	if err := os.MkdirAll(dstDir, 0755); err != nil {
		return err
	}

	for _, file := range reader.File {
		if err := ctx.Err(); err != nil {
			return err
		}
		if err := extractFile(file, dstDir); err != nil {
			return err
		}
	}
	return nil
}

// extractFile 解压单个文件
func extractFile(file *zip.File, dstDir string) error {
	dstPath := filepath.Join(dstDir, file.Name)

	// 安全检查：防止zip slip攻击
	if !strings.HasPrefix(filepath.Clean(dstPath), filepath.Clean(dstDir)+string(os.PathSeparator)) {
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

// verifyMigration 验证迁移结果
func (ms *MigrationService) verifyMigration(dstPath string) error {
	stat, err := os.Stat(dstPath)
	if err != nil {
		return fmt.Errorf("target directory does not exist: %w", err)
	}
	if !stat.IsDir() {
		return fmt.Errorf("target path is not a directory")
	}

	isEmpty, err := isDirEmpty(dstPath)
	if err != nil {
		return fmt.Errorf("failed to check target directory: %w", err)
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
	_ = ms.CancelMigration()
	return nil
}

// isDirEmpty 检查目录是否为空
func isDirEmpty(path string) (bool, error) {
	f, err := os.Open(path)
	if err != nil {
		return false, err
	}
	defer f.Close()

	_, err = f.Readdir(1)
	return err == io.EOF, nil
}

// isSubDir 检查target是否是parent的子目录
func isSubDir(parent, target string) bool {
	parent = filepath.Clean(parent) + string(filepath.Separator)
	target = filepath.Clean(target) + string(filepath.Separator)
	return len(target) > len(parent) && strings.HasPrefix(target, parent)
}
