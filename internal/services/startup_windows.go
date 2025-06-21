//go:build windows

package services

import (
	"fmt"
	"os"
	"os/exec"
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
	taskName    string // 任务计划程序任务名
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

	// 使用文件名作为注册表键名和任务名
	baseName := strings.TrimSuffix(filepath.Base(w.execPath), filepath.Ext(w.execPath))
	w.registryKey = baseName
	w.taskName = baseName + "_Startup"

	return nil
}

// createTaskSchedulerEntry 创建任务计划程序条目
func (w *WindowsStartupImpl) createTaskSchedulerEntry() error {
	// 创建任务计划程序条目的XML内容
	taskXML := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>%s startup task</Description>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>false</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>true</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>%s</Command>
      <WorkingDirectory>%s</WorkingDirectory>
    </Exec>
  </Actions>
</Task>`, w.taskName, w.execPath, w.workingDir)

	// 创建临时XML文件
	tempFile := filepath.Join(os.TempDir(), w.taskName+".xml")
	if err := os.WriteFile(tempFile, []byte(taskXML), 0644); err != nil {
		return fmt.Errorf("failed to create task XML file: %w", err)
	}
	defer os.Remove(tempFile) // 清理临时文件

	// 使用schtasks命令创建任务
	cmd := exec.Command("schtasks", "/create", "/tn", w.taskName, "/xml", tempFile, "/f")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to create scheduled task: %w, output: %s", err, string(output))
	}

	return nil
}

// deleteTaskSchedulerEntry 删除任务计划程序条目
func (w *WindowsStartupImpl) deleteTaskSchedulerEntry() error {
	cmd := exec.Command("schtasks", "/delete", "/tn", w.taskName, "/f")
	output, err := cmd.CombinedOutput()
	if err != nil {
		// 如果任务不存在
		if strings.Contains(string(output), "cannot find") || strings.Contains(string(output), "does not exist") {
			return nil
		}
		return fmt.Errorf("failed to delete scheduled task: %w, output: %s", err, string(output))
	}

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

// buildStartupCommand 构建启动命令
func (w *WindowsStartupImpl) buildStartupCommand() (string, error) {
	execPath := w.execPath

	if strings.Contains(execPath, " ") {
		execPath = `"` + execPath + `"`
	}

	return execPath, nil
}

// SetEnabled 设置开机启动状态
func (w *WindowsStartupImpl) SetEnabled(enabled bool) error {
	if enabled {
		// 优先使用任务计划程序方式，可以绕过UAC限制
		if err := w.createTaskSchedulerEntry(); err != nil {
			// 如果任务计划程序失败，回退到注册表方式
			return w.setRegistryStartup(true)
		}
		return nil
	} else {

		// 删除任务计划程序条目
		if err := w.deleteTaskSchedulerEntry(); err != nil {
			w.logger.Error("Failed to delete scheduled task", "error", err)
		}

		// 删除注册表条目
		if err := w.setRegistryStartup(false); err != nil {
			w.logger.Error("Failed to remove registry startup entry", "error", err)
		}

		return nil
	}
}

// setRegistryStartup 设置注册表启动项（备用方法）
func (w *WindowsStartupImpl) setRegistryStartup(enabled bool) error {
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

		if err := key.SetStringValue(w.registryKey, startupCmd); err != nil {
			return fmt.Errorf("failed to set startup entry: %w", err)
		}

		// 验证设置是否成功
		if value, _, err := key.GetStringValue(w.registryKey); err != nil {
			return fmt.Errorf("startup entry verification failed: %w", err)
		} else if value != startupCmd {
			return fmt.Errorf("startup command verification failed: expected %s, got %s", startupCmd, value)
		}

	} else {
		if err := key.DeleteValue(w.registryKey); err != nil {
			if err != registry.ErrNotExist {
				return fmt.Errorf("failed to remove startup entry: %w", err)
			}
		}
	}

	return nil
}
