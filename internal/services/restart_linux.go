//go:build linux

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

// restartApplication Linux平台的重启实现
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

	// 在Linux上，我们使用一个shell脚本来重启应用程序
	// 创建一个唯一的临时shell脚本
	scriptPath := fmt.Sprintf("/tmp/restart_voidraft_%d_%d.sh", os.Getpid(), time.Now().Unix())
	scriptContent := fmt.Sprintf(`#!/bin/bash
sleep 1
cd %s
%s %s &
rm "%s"
`,
		shellEscape(workDir), shellEscape(exe),
		shellEscapeArgs(os.Args[1:]), scriptPath)

	s.logger.Info("Creating restart script", "path", scriptPath)

	// 写入脚本文件
	err = os.WriteFile(scriptPath, []byte(scriptContent), 0755)
	if err != nil {
		return fmt.Errorf("failed to create restart script: %w", err)
	}

	// 启动脚本
	cmd := exec.Command("/bin/bash", scriptPath)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Setsid: true, // 创建新的会话，使进程独立于父进程
	}

	err = cmd.Start()
	if err != nil {
		return fmt.Errorf("failed to start restart script: %w", err)
	}

	// 给脚本一点时间启动
	time.Sleep(100 * time.Millisecond)

	// 立即退出当前进程
	os.Exit(0)

	return nil // 不会执行到这里
}

// shellEscape 转义单个shell参数或路径
func shellEscape(arg string) string {
	if arg == "" {
		return "''"
	}

	// 如果参数只包含安全字符，不需要转义
	if isSafeShellString(arg) {
		return arg
	}

	// 使用单引号转义，但需要处理参数中的单引号
	// 将单引号替换为 '"'"'
	escaped := strings.ReplaceAll(arg, "'", `'"'"'`)
	return "'" + escaped + "'"
}

// shellEscapeArgs 转义多个shell参数
func shellEscapeArgs(args []string) string {
	if len(args) == 0 {
		return ""
	}

	var escaped []string
	for _, arg := range args {
		escaped = append(escaped, shellEscape(arg))
	}

	return strings.Join(escaped, " ")
}

// isSafeShellString 检查字符串是否包含需要转义的字符
func isSafeShellString(s string) bool {
	// 只包含字母、数字、下划线、连字符、点号和斜杠的字符串是安全的
	for _, r := range s {
		if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') ||
			(r >= '0' && r <= '9') || r == '_' || r == '-' ||
			r == '.' || r == '/') {
			return false
		}
	}
	return len(s) > 0
}
