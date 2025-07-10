//go:build darwin

package services

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/mac"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// DarwinStartupImpl macOS 平台开机启动实现
type DarwinStartupImpl struct {
	logger   *log.Service
	disabled bool
	appPath  string
	appName  string
}

// newStartupImplementation 创建平台特定的开机启动实现
func newStartupImplementation(logger *log.Service) StartupImplementation {
	return &DarwinStartupImpl{
		logger: logger,
	}
}

// Initialize 初始化 macOS 实现
func (d *DarwinStartupImpl) Initialize() error {
	if mac.GetBundleID() == "" {
		d.disabled = true
		return nil
	}

	exe, _ := os.Executable()
	binName := filepath.Base(exe)
	if !strings.HasSuffix(exe, "/Contents/MacOS/"+binName) {
		d.disabled = true
		return nil
	}

	d.appPath = strings.TrimSuffix(exe, "/Contents/MacOS/"+binName)
	d.appName = strings.TrimSuffix(filepath.Base(d.appPath), ".app")
	return nil
}

// SetEnabled 设置开机启动状态
func (d *DarwinStartupImpl) SetEnabled(enabled bool) error {
	if d.disabled {
		return fmt.Errorf("app is not properly packaged as .app bundle, cannot set startup")
	}

	var command string
	if enabled {
		command = fmt.Sprintf(
			`tell application "System Events" to make login item at end with properties {name: "%s",path:"%s", hidden:false}`,
			d.appName, d.appPath,
		)
	} else {
		command = fmt.Sprintf(
			`tell application "System Events" to delete login item "%s"`,
			d.appName,
		)
	}

	cmd := exec.Command("osascript", "-e", command)
	output, err := cmd.CombinedOutput()
	if err != nil {
		if strings.Contains(string(output), "not allowed") || strings.Contains(string(output), "permission") {
			return fmt.Errorf("accessibility permission required: go to System Preferences > Security & Privacy > Privacy > Accessibility")
		}
		return fmt.Errorf("failed to set login item: %w", err)
	}

	// 简单验证：重新查询登录项
	if enabled {
		checkCmd := exec.Command("osascript", "-e", `tell application "System Events" to get the name of every login item`)
		checkOutput, _ := checkCmd.CombinedOutput()
		if !strings.Contains(string(checkOutput), d.appName) {
			return fmt.Errorf("login item verification failed")
		}
	}

	return nil
}
