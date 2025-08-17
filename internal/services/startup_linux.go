//go:build linux

package services

import (
	"fmt"
	"os"
	"path/filepath"
	"text/template"

	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// LinuxStartupImpl Linux 平台开机启动实现
type LinuxStartupImpl struct {
	logger       *log.LogService
	autostartDir string
	execPath     string
	appName      string
}

// desktopEntry 桌面条目模板数据
type desktopEntry struct {
	Name    string
	Cmd     string
	Comment string
}

const desktopEntryTemplate = `[Desktop Entry]
Name={{.Name}}
Comment={{.Comment}}
Type=Application
Exec={{.Cmd}}
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
`

// newStartupImplementation 创建平台特定的开机启动实现
func newStartupImplementation(logger *log.LogService) StartupImplementation {
	return &LinuxStartupImpl{
		logger: logger,
	}
}

// Initialize 初始化 Linux 实现
func (l *LinuxStartupImpl) Initialize() error {
	homeDir, _ := os.UserHomeDir()
	l.autostartDir = filepath.Join(homeDir, ".config", "autostart")

	// 检查是否有桌面环境
	if os.Getenv("DISPLAY") == "" && os.Getenv("WAYLAND_DISPLAY") == "" {
		return fmt.Errorf("no desktop environment detected, cannot set startup")
	}

	if err := os.MkdirAll(l.autostartDir, 0755); err != nil {
		return fmt.Errorf("failed to create autostart directory: %w", err)
	}

	execPath, _ := os.Executable()
	l.execPath = execPath
	l.appName = filepath.Base(execPath)
	return nil
}

// getDesktopFilePath 获取桌面文件路径
func (l *LinuxStartupImpl) getDesktopFilePath() string {
	filename := fmt.Sprintf("%s-autostart.desktop", l.appName)
	return filepath.Join(l.autostartDir, filename)
}

// SetEnabled 设置开机启动状态
func (l *LinuxStartupImpl) SetEnabled(enabled bool) error {
	desktopFile := l.getDesktopFilePath()

	if !enabled {
		os.Remove(desktopFile)
		return nil
	}

	if err := l.createDesktopFile(desktopFile); err != nil {
		return fmt.Errorf("failed to create autostart file: %w", err)
	}

	// 验证文件是否创建成功
	if _, err := os.Stat(desktopFile); err != nil {
		return fmt.Errorf("autostart file verification failed: %w", err)
	}

	return nil
}

// createDesktopFile 创建桌面文件
func (l *LinuxStartupImpl) createDesktopFile(filename string) error {
	file, err := os.OpenFile(filename, os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		return err
	}
	defer file.Close()

	tmpl, _ := template.New("desktopEntry").Parse(desktopEntryTemplate)
	data := desktopEntry{
		Name:    l.appName,
		Cmd:     l.execPath,
		Comment: fmt.Sprintf("Autostart service for %s", l.appName),
	}

	return tmpl.Execute(file, data)
}
