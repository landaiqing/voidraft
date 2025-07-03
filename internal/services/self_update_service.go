package services

import (
	"context"
	"errors"
	"fmt"
	"github.com/creativeprojects/go-selfupdate"
	"github.com/wailsapp/wails/v3/pkg/services/log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"
	"voidraft/internal/models"
)

// SelfUpdateResult 自我更新结果
type SelfUpdateResult struct {
	HasUpdate      bool   `json:"hasUpdate"`      // 是否有更新
	CurrentVersion string `json:"currentVersion"` // 当前版本
	LatestVersion  string `json:"latestVersion"`  // 最新版本
	UpdateApplied  bool   `json:"updateApplied"`  // 是否已应用更新
	AssetURL       string `json:"assetURL"`       // 下载链接
	ReleaseNotes   string `json:"releaseNotes"`   // 发布说明
	Error          string `json:"error"`          // 错误信息
	Source         string `json:"source"`         // 更新源（github/gitea）
}

// SelfUpdateService 自我更新服务
type SelfUpdateService struct {
	logger        *log.LoggerService
	configService *ConfigService
	config        *models.AppConfig

	// 状态管理
	isUpdating bool
}

// NewSelfUpdateService 创建自我更新服务实例
func NewSelfUpdateService(configService *ConfigService, logger *log.LoggerService) (*SelfUpdateService, error) {
	// 获取配置
	appConfig, err := configService.GetConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get config: %w", err)
	}

	service := &SelfUpdateService{
		logger:        logger,
		configService: configService,
		config:        appConfig,
		isUpdating:    false,
	}

	return service, nil
}

// CheckForUpdates 检查更新
func (s *SelfUpdateService) CheckForUpdates(ctx context.Context) (*SelfUpdateResult, error) {
	result := &SelfUpdateResult{
		CurrentVersion: s.config.Updates.Version,
		HasUpdate:      false,
		UpdateApplied:  false,
	}

	// 首先尝试主要更新源
	primaryResult, err := s.checkSourceForUpdates(ctx, s.config.Updates.PrimarySource)
	if err == nil && primaryResult != nil {
		return primaryResult, nil
	}

	// 如果主要更新源失败，尝试备用更新源
	backupResult, backupErr := s.checkSourceForUpdates(ctx, s.config.Updates.BackupSource)
	if backupErr != nil {
		// 如果备用源也失败，返回主要源的错误信息
		result.Error = fmt.Sprintf("Primary source error: %v; Backup source error: %v", err, backupErr)
		return result, errors.New(result.Error)
	}

	return backupResult, nil
}

// checkSourceForUpdates 根据更新源类型检查更新
func (s *SelfUpdateService) checkSourceForUpdates(ctx context.Context, sourceType models.UpdateSourceType) (*SelfUpdateResult, error) {
	// 创建带超时的上下文
	timeout := s.config.Updates.UpdateTimeout
	if timeout <= 0 {
		timeout = 30 // 默认30秒
	}
	timeoutCtx, cancel := context.WithTimeout(ctx, time.Duration(timeout)*time.Second)
	defer cancel()

	result := &SelfUpdateResult{
		CurrentVersion: s.config.Updates.Version,
		HasUpdate:      false,
		UpdateApplied:  false,
		Source:         string(sourceType),
	}

	var release *selfupdate.Release
	var found bool
	var err error

	switch sourceType {
	case models.UpdateSourceGithub:
		release, found, err = s.checkGithubUpdates(timeoutCtx)
	case models.UpdateSourceGitea:
		release, found, err = s.checkGiteaUpdates(timeoutCtx)
	default:
		return nil, fmt.Errorf("unsupported update source type: %s", sourceType)
	}

	if err != nil {
		result.Error = fmt.Sprintf("Failed to check for updates: %v", err)
		return result, err
	}

	if !found {
		result.Error = fmt.Sprintf("No release found for %s/%s on %s",
			runtime.GOOS, runtime.GOARCH, s.getRepoName(sourceType))
		return result, errors.New(result.Error)
	}

	result.LatestVersion = release.Version()
	result.AssetURL = release.AssetURL
	result.ReleaseNotes = release.ReleaseNotes

	// 比较版本
	if release.GreaterThan(s.config.Updates.Version) {
		result.HasUpdate = true
	} else {
		s.logger.Info("Current version is up to date")
	}

	return result, nil
}

// createGithubUpdater 创建GitHub更新器
func (s *SelfUpdateService) createGithubUpdater() (*selfupdate.Updater, error) {
	// 使用默认的GitHub源
	updaterConfig := selfupdate.Config{}

	return selfupdate.NewUpdater(updaterConfig)
}

// createGiteaUpdater 创建Gitea更新器
func (s *SelfUpdateService) createGiteaUpdater() (*selfupdate.Updater, error) {
	giteaConfig := s.config.Updates.Gitea

	// 创建Gitea源
	source, err := selfupdate.NewGiteaSource(selfupdate.GiteaConfig{
		BaseURL: giteaConfig.BaseURL,
	})

	if err != nil {
		return nil, fmt.Errorf("failed to create Gitea source: %w", err)
	}

	// 创建使用Gitea源的更新器
	updaterConfig := selfupdate.Config{
		Source: source,
	}

	return selfupdate.NewUpdater(updaterConfig)
}

// checkGithubUpdates 检查GitHub更新
func (s *SelfUpdateService) checkGithubUpdates(ctx context.Context) (*selfupdate.Release, bool, error) {
	// 创建GitHub更新器
	updater, err := s.createGithubUpdater()
	if err != nil {
		return nil, false, fmt.Errorf("failed to create GitHub updater: %w", err)
	}

	githubConfig := s.config.Updates.Github
	repository := selfupdate.NewRepositorySlug(githubConfig.Owner, githubConfig.Repo)

	// 检测最新版本
	return updater.DetectLatest(ctx, repository)
}

// checkGiteaUpdates 检查Gitea更新
func (s *SelfUpdateService) checkGiteaUpdates(ctx context.Context) (*selfupdate.Release, bool, error) {
	// 创建Gitea更新器
	updater, err := s.createGiteaUpdater()
	if err != nil {
		return nil, false, fmt.Errorf("failed to create Gitea updater: %w", err)
	}

	giteaConfig := s.config.Updates.Gitea
	repository := selfupdate.NewRepositorySlug(giteaConfig.Owner, giteaConfig.Repo)

	// 检测最新版本
	return updater.DetectLatest(ctx, repository)
}

// getRepoName 获取当前更新源的仓库名称
func (s *SelfUpdateService) getRepoName(sourceType models.UpdateSourceType) string {
	switch sourceType {
	case models.UpdateSourceGithub:
		return s.config.Updates.Github.Repo
	case models.UpdateSourceGitea:
		return s.config.Updates.Gitea.Repo
	default:
		return "unknown"
	}
}

// ApplyUpdate 应用更新
func (s *SelfUpdateService) ApplyUpdate(ctx context.Context) (*SelfUpdateResult, error) {
	if s.isUpdating {
		return nil, errors.New("update is already in progress")
	}

	s.isUpdating = true
	defer func() {
		s.isUpdating = false
	}()

	// 获取可执行文件路径
	exe, err := selfupdate.ExecutablePath()
	if err != nil {
		return &SelfUpdateResult{
			CurrentVersion: s.config.Updates.Version,
			Error:          fmt.Sprintf("Could not locate executable path: %v", err),
		}, err
	}

	// 创建带超时的上下文，仅用于检测最新版本
	timeout := s.config.Updates.UpdateTimeout
	if timeout <= 0 {
		timeout = 30 // 默认30秒
	}
	checkTimeoutCtx, cancel := context.WithTimeout(ctx, time.Duration(timeout)*time.Second)
	defer cancel()

	result := &SelfUpdateResult{
		CurrentVersion: s.config.Updates.Version,
	}

	// 首先尝试从主要更新源获取更新信息
	primarySourceType := s.config.Updates.PrimarySource
	backupSourceType := s.config.Updates.BackupSource

	result.Source = string(primarySourceType)

	// 从主更新源获取更新信息
	primaryUpdater, primaryRelease, primaryFound, err := s.getUpdateFromSource(checkTimeoutCtx, primarySourceType)

	if err != nil || !primaryFound {
		// 主更新源失败，直接尝试备用源
		return s.updateFromSource(ctx, backupSourceType, exe)
	}

	// 检查是否有可用更新
	if !primaryRelease.GreaterThan(s.config.Updates.Version) {
		s.logger.Info("Current version is up to date, no need to apply update")
		result.LatestVersion = primaryRelease.Version()
		return result, nil
	}

	// 更新结果信息
	result.LatestVersion = primaryRelease.Version()
	result.AssetURL = primaryRelease.AssetURL
	result.ReleaseNotes = primaryRelease.ReleaseNotes
	result.HasUpdate = true

	// 备份当前可执行文件（如果启用）
	var backupPath string
	if s.config.Updates.BackupBeforeUpdate {
		var err error
		backupPath, err = s.createBackup(exe)
		if err != nil {
			result.Error = fmt.Sprintf("Failed to create backup: %v", err)
			return result, err
		}
	}

	// 从主要源尝试下载并应用更新，不设置超时
	err = primaryUpdater.UpdateTo(ctx, primaryRelease, exe)

	// 如果主要源下载失败，尝试备用源
	if err != nil {
		// 尝试从备用源更新
		backupResult, backupErr := s.updateFromSource(ctx, backupSourceType, exe)

		// 如果备用源也失败，清理并返回错误
		if backupErr != nil {
			if backupPath != "" {
				s.cleanupBackup(backupPath)
			}

			result.Error = fmt.Sprintf("Update failed from both sources: primary error: %v; backup error: %v", err, backupErr)
			return result, errors.New(result.Error)
		}

		// 备用源成功
		return backupResult, nil
	}

	// 主要源更新成功
	result.UpdateApplied = true

	// 更新成功后清理备份文件
	if backupPath != "" {
		if err := s.cleanupBackup(backupPath); err != nil {
			s.logger.Error("Failed to cleanup backup", "error", err)
		}
	}

	// 更新配置中的版本号
	if err := s.updateConfigVersion(result.LatestVersion); err != nil {
		s.logger.Error("Failed to update config version", "error", err)
	}

	return result, nil
}

// updateFromSource 从指定源尝试下载并应用更新
func (s *SelfUpdateService) updateFromSource(ctx context.Context, sourceType models.UpdateSourceType, exe string) (*SelfUpdateResult, error) {
	// 创建带超时的上下文，仅用于检测最新版本
	checkTimeoutCtx, cancel := context.WithTimeout(ctx, time.Duration(s.config.Updates.UpdateTimeout)*time.Second)
	defer cancel()

	result := &SelfUpdateResult{
		CurrentVersion: s.config.Updates.Version,
		Source:         string(sourceType),
	}

	s.logger.Info("Attempting to update from source", "source", sourceType)

	// 获取更新信息
	updater, release, found, err := s.getUpdateFromSource(checkTimeoutCtx, sourceType)
	if err != nil {
		result.Error = fmt.Sprintf("Failed to detect latest release from %s: %v", sourceType, err)
		return result, err
	}

	if !found {
		result.Error = fmt.Sprintf("Latest release not found from %s", sourceType)
		return result, errors.New(result.Error)
	}

	// 更新结果信息
	result.LatestVersion = release.Version()
	result.AssetURL = release.AssetURL
	result.ReleaseNotes = release.ReleaseNotes

	// 检查是否有更新
	if !release.GreaterThan(s.config.Updates.Version) {
		s.logger.Info("Current version is up to date, no need to apply update")
		return result, nil
	}

	// 标记有更新可用
	result.HasUpdate = true

	// 备份当前可执行文件（如果启用且尚未备份）
	var backupPath string
	if s.config.Updates.BackupBeforeUpdate {
		s.logger.Info("Creating backup before update...")
		var err error
		backupPath, err = s.createBackup(exe)
		if err != nil {
			result.Error = fmt.Sprintf("Failed to create backup: %v", err)
			return result, err
		}
	}

	// 尝试下载并应用更新，不设置超时
	s.logger.Info("Downloading update...", "source", sourceType)
	err = updater.UpdateTo(ctx, release, exe)

	if err != nil {
		result.Error = fmt.Sprintf("Failed to apply update from %s: %v", sourceType, err)

		// 移除下载失败时恢复备份的逻辑，让用户手动处理
		if backupPath != "" {
			s.logger.Info("Update failed, backup is available at: " + backupPath)
		}
		return result, err
	}

	result.UpdateApplied = true

	// 更新成功后清理备份文件
	if backupPath != "" {
		if err := s.cleanupBackup(backupPath); err != nil {
			s.logger.Error("Failed to cleanup backup", "error", err)
		}
	}

	// 更新配置中的版本号
	if err := s.updateConfigVersion(result.LatestVersion); err != nil {
		s.logger.Error("Failed to update config version", "error", err)
	}

	return result, nil
}

// getUpdateFromSource 从指定源获取更新信息
func (s *SelfUpdateService) getUpdateFromSource(ctx context.Context, sourceType models.UpdateSourceType) (*selfupdate.Updater, *selfupdate.Release, bool, error) {
	var updater *selfupdate.Updater
	var release *selfupdate.Release
	var found bool
	var err error

	switch sourceType {
	case models.UpdateSourceGithub:
		updater, err = s.createGithubUpdater()
		if err != nil {
			return nil, nil, false, fmt.Errorf("failed to create GitHub updater: %w", err)
		}
		release, found, err = s.checkGithubUpdates(ctx)
	case models.UpdateSourceGitea:
		updater, err = s.createGiteaUpdater()
		if err != nil {
			return nil, nil, false, fmt.Errorf("failed to create Gitea updater: %w", err)
		}
		release, found, err = s.checkGiteaUpdates(ctx)
	default:
		return nil, nil, false, fmt.Errorf("unsupported update source type: %s", sourceType)
	}

	return updater, release, found, err
}

// RestartApplication 重启应用程序
func (s *SelfUpdateService) RestartApplication() error {

	// 获取当前可执行文件路径
	exe, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get executable path: %w", err)
	}

	// Windows平台需要特殊处理
	if runtime.GOOS == "windows" {

		// 获取当前工作目录
		workDir, err := os.Getwd()
		if err != nil {
			s.logger.Error("Failed to get working directory", "error", err)
			workDir = filepath.Dir(exe) // 如果获取失败，使用可执行文件所在目录
		}

		// 创建批处理文件来重启应用程序
		// 批处理文件会等待当前进程退出，然后启动新进程
		batchFile := filepath.Join(os.TempDir(), "restart_voidraft.bat")
		batchContent := fmt.Sprintf(`@echo off
timeout /t 1 /nobreak > NUL
cd /d "%s"
start "" "%s" %s
del "%s"
`, workDir, exe, strings.Join(os.Args[1:], " "), batchFile)

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

	// 使用syscall.Exec替换当前进程
	err = syscall.Exec(exe, os.Args, os.Environ())
	if err != nil {
		return fmt.Errorf("failed to exec: %w", err)
	}

	return nil
}

// updateConfigVersion 更新配置中的版本号
func (s *SelfUpdateService) updateConfigVersion(version string) error {
	// 使用configService更新配置中的版本号
	if err := s.configService.Set("updates.version", version); err != nil {
		return fmt.Errorf("failed to update config version: %w", err)
	}
	return nil
}

// createBackup 创建当前可执行文件的备份
func (s *SelfUpdateService) createBackup(executablePath string) (string, error) {
	backupPath := executablePath + ".backup"

	// 读取原文件
	data, err := os.ReadFile(executablePath)
	if err != nil {
		return "", fmt.Errorf("failed to read executable: %w", err)
	}

	// 写入备份文件
	err = os.WriteFile(backupPath, data, 0755)
	if err != nil {
		return "", fmt.Errorf("failed to create backup: %w", err)
	}

	return backupPath, nil
}

// cleanupBackup 清理备份文件
func (s *SelfUpdateService) cleanupBackup(backupPath string) error {
	if err := os.Remove(backupPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to remove backup file: %w", err)
	}
	return nil
}
