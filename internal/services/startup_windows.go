//go:build windows

package services

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/services/log"
	"golang.org/x/sys/windows/registry"
)

// WindowsStartupImpl Windows 平台开机启动实现
type WindowsStartupImpl struct {
	logger      *log.LoggerService
	registryKey string
	execPath    string
	workingDir  string
	batchFile   string
}

// newStartupImplementation 创建平台特定的开机启动实现
func newStartupImplementation(logger *log.LoggerService) StartupImplementation {
	return &WindowsStartupImpl{
		logger: logger,
	}
}

// Initialize 初始化 Windows 实现
func (w *WindowsStartupImpl) Initialize() error {
	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get executable path: %w", err)
	}

	// 获取绝对路径并规范化
	absPath, err := filepath.Abs(exePath)
	if err != nil {
		return fmt.Errorf("failed to get absolute path: %w", err)
	}

	// 转换为Windows标准路径格式
	w.execPath = filepath.ToSlash(absPath)
	w.execPath = strings.ReplaceAll(w.execPath, "/", "\\")

	// 获取工作目录（可执行文件所在目录）
	w.workingDir = filepath.Dir(w.execPath)

	// 使用文件名作为注册表键名
	w.registryKey = strings.TrimSuffix(filepath.Base(w.execPath), filepath.Ext(w.execPath))

	// 批处理文件路径（放在临时目录）
	tempDir := os.TempDir()
	w.batchFile = filepath.Join(tempDir, w.registryKey+"_startup.bat")

	return nil
}

// openRegistryKey 打开注册表键
func (w *WindowsStartupImpl) openRegistryKey() (registry.Key, error) {
	key, err := registry.OpenKey(
		registry.CURRENT_USER,
		`Software\Microsoft\Windows\CurrentVersion\Run`,
		registry.ALL_ACCESS,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to open registry key: %w", err)
	}
	return key, nil
}

// createBatchFile 创建批处理文件
func (w *WindowsStartupImpl) createBatchFile() error {
	// 批处理文件内容
	batchContent := fmt.Sprintf(`@echo off
cd /d "%s"
start "" "%s"
`, w.workingDir, w.execPath)

	// 写入批处理文件
	if err := os.WriteFile(w.batchFile, []byte(batchContent), 0644); err != nil {
		return fmt.Errorf("failed to create batch file: %w", err)
	}

	return nil
}

// deleteBatchFile 删除批处理文件
func (w *WindowsStartupImpl) deleteBatchFile() {
	if _, err := os.Stat(w.batchFile); err == nil {
		os.Remove(w.batchFile)
	}
}

// buildStartupCommand 构建启动命令
func (w *WindowsStartupImpl) buildStartupCommand() (string, error) {
	// 尝试直接使用可执行文件路径
	execPath := w.execPath
	if strings.Contains(execPath, " ") {
		execPath = `"` + execPath + `"`
	}

	// 首先尝试直接路径，如果有问题再使用批处理文件
	return execPath, nil
}

// SetEnabled 设置开机启动状态
func (w *WindowsStartupImpl) SetEnabled(enabled bool) error {
	key, err := w.openRegistryKey()
	if err != nil {
		return fmt.Errorf("failed to access registry: %w", err)
	}
	defer key.Close()

	if enabled {
		startupCmd, err := w.buildStartupCommand()
		if err != nil {
			return fmt.Errorf("failed to build startup command: %w", err)
		}

		w.logger.Info("Setting Windows startup", "command", startupCmd)

		if err := key.SetStringValue(w.registryKey, startupCmd); err != nil {
			return fmt.Errorf("failed to set startup entry: %w", err)
		}

		// 验证设置是否成功
		if value, _, err := key.GetStringValue(w.registryKey); err != nil {
			return fmt.Errorf("startup entry verification failed: %w", err)
		} else if value != startupCmd {
			w.logger.Error("Startup command verification mismatch", "expected", startupCmd, "actual", value)
		}

		w.logger.Info("Windows startup enabled successfully")
	} else {
		// 删除批处理文件（如果存在）
		w.deleteBatchFile()

		if err := key.DeleteValue(w.registryKey); err != nil {
			// 如果键不存在，这不是错误
			if err != registry.ErrNotExist {
				return fmt.Errorf("failed to remove startup entry: %w", err)
			}
		}
		w.logger.Info("Windows startup disabled successfully")
	}

	return nil
}
