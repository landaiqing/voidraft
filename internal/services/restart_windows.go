//go:build windows

package services

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

// restartApplication Windows平台的重启实现
func (s *SelfUpdateService) restartApplication() error {
	// 获取当前可执行文件路径
	exe, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get executable path: %w", err)
	}

	// 获取当前工作目录
	workDir, err := os.Getwd()
	if err != nil {
		s.logger.Error("Failed to get working directory", "error", err)
		workDir = filepath.Dir(exe) // 如果获取失败，使用可执行文件所在目录
	}

	// 创建唯一的批处理文件来重启应用程序
	// 使用进程ID和时间戳确保文件名唯一性
	batchFile := filepath.Join(os.TempDir(), fmt.Sprintf("restart_voidraft_%d_%d.bat", os.Getpid(), time.Now().Unix()))

	// 正确转义命令行参数
	escapedArgs := escapeWindowsArgs(os.Args[1:])
	batchContent := fmt.Sprintf(`@echo off
timeout /t 1 /nobreak > NUL
cd /d "%s"
start "" "%s" %s
del "%s"
`, workDir, exe, escapedArgs, batchFile)

	s.logger.Info("Creating batch file", "path", batchFile, "content", batchContent)

	// 写入批处理文件
	err = os.WriteFile(batchFile, []byte(batchContent), 0644)
	if err != nil {
		return fmt.Errorf("failed to create batch file: %w", err)
	}

	// 启动批处理文件
	cmd := exec.Command("cmd.exe", "/C", batchFile)
	cmd.Stdout = nil
	cmd.Stderr = nil
	cmd.Stdin = nil
	// 分离进程，这样即使父进程退出，批处理文件仍然会继续执行
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: syscall.CREATE_NEW_PROCESS_GROUP,
	}

	err = cmd.Start()
	if err != nil {
		return fmt.Errorf("failed to start batch file: %w", err)
	}

	// 立即退出当前进程
	os.Exit(0)

	return nil // 不会执行到这里
}

// escapeWindowsArgs 转义Windows命令行参数
func escapeWindowsArgs(args []string) string {
	if len(args) == 0 {
		return ""
	}

	var escaped []string
	for _, arg := range args {
		escaped = append(escaped, escapeWindowsArg(arg))
	}

	return strings.Join(escaped, " ")
}

// escapeWindowsArg 转义单个Windows命令行参数
func escapeWindowsArg(arg string) string {
	// 如果参数不包含空格、制表符、换行符、双引号或反斜杠，则不需要转义
	if !strings.ContainsAny(arg, " \t\n\r\"\\") {
		return arg
	}

	// 需要转义的参数用双引号包围
	var result strings.Builder
	result.WriteByte('"')

	for i := 0; i < len(arg); i++ {
		c := arg[i]
		switch c {
		case '"':
			// 双引号需要转义
			result.WriteString(`\"`)
		case '\\':
			// 反斜杠需要特殊处理
			// 如果后面跟着双引号，需要转义反斜杠
			if i+1 < len(arg) && arg[i+1] == '"' {
				result.WriteString(`\\`)
			} else {
				result.WriteByte(c)
			}
		default:
			result.WriteByte(c)
		}
	}

	result.WriteByte('"')
	return result.String()
}
