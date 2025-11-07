package services

import (
	"context"
	"errors"
	"fmt"
	"os"
	"runtime"
	"sync"
	"time"

	"github.com/creativeprojects/go-selfupdate"
	"github.com/wailsapp/wails/v3/pkg/services/dock"
	"github.com/wailsapp/wails/v3/pkg/services/log"
	"github.com/wailsapp/wails/v3/pkg/services/notifications"
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
	logger              *log.LogService
	configService       *ConfigService
	badgeService        *dock.DockService
	notificationService *notifications.NotificationService

	mu         sync.Mutex // 保护更新状态
	isUpdating bool
}

// NewSelfUpdateService 创建自我更新服务实例
func NewSelfUpdateService(configService *ConfigService, badgeService *dock.DockService, notificationService *notifications.NotificationService, logger *log.LogService) *SelfUpdateService {
	return &SelfUpdateService{
		logger:              logger,
		configService:       configService,
		badgeService:        badgeService,
		notificationService: notificationService,
		isUpdating:          false,
	}
}

// getConfig 获取最新配置
func (s *SelfUpdateService) getConfig() (*models.AppConfig, error) {
	config, err := s.configService.GetConfig()
	if err != nil {
		return nil, fmt.Errorf("get config failed: %w", err)
	}
	return config, nil
}

// CheckForUpdates 检查更新
func (s *SelfUpdateService) CheckForUpdates(ctx context.Context) (*SelfUpdateResult, error) {
	config, err := s.getConfig()
	if err != nil {
		return nil, err
	}

	result := &SelfUpdateResult{
		CurrentVersion: config.Updates.Version,
		HasUpdate:      false,
		UpdateApplied:  false,
	}

	// 尝试主要更新源
	primaryResult, err := s.checkSourceForUpdates(ctx, config.Updates.PrimarySource, config)
	if err == nil && primaryResult != nil {
		s.handleUpdateBadge(primaryResult)
		return primaryResult, nil
	}

	// 尝试备用更新源
	backupResult, backupErr := s.checkSourceForUpdates(ctx, config.Updates.BackupSource, config)
	if backupErr != nil {
		result.Error = fmt.Sprintf("both sources failed: %v; %v", err, backupErr)
		s.handleUpdateBadge(result)
		return result, errors.New(result.Error)
	}

	s.handleUpdateBadge(backupResult)
	return backupResult, nil
}

// checkSourceForUpdates 根据更新源类型检查更新
func (s *SelfUpdateService) checkSourceForUpdates(ctx context.Context, sourceType models.UpdateSourceType, config *models.AppConfig) (*SelfUpdateResult, error) {
	timeout := config.Updates.UpdateTimeout
	if timeout <= 0 {
		timeout = 30
	}
	timeoutCtx, cancel := context.WithTimeout(ctx, time.Duration(timeout)*time.Second)
	defer cancel()

	result := &SelfUpdateResult{
		CurrentVersion: config.Updates.Version,
		HasUpdate:      false,
		UpdateApplied:  false,
		Source:         string(sourceType),
	}

	var release *selfupdate.Release
	var found bool
	var err error

	switch sourceType {
	case models.UpdateSourceGithub:
		release, found, err = s.checkGithubUpdates(timeoutCtx, config)
	case models.UpdateSourceGitea:
		release, found, err = s.checkGiteaUpdates(timeoutCtx, config)
	default:
		return nil, fmt.Errorf("unsupported source: %s", sourceType)
	}

	if err != nil {
		return result, fmt.Errorf("check failed: %w", err)
	}

	if !found {
		return result, fmt.Errorf("no release for %s/%s", runtime.GOOS, runtime.GOARCH)
	}

	result.LatestVersion = release.Version()
	result.AssetURL = release.AssetURL
	result.ReleaseNotes = release.ReleaseNotes
	result.HasUpdate = release.GreaterThan(config.Updates.Version)

	return result, nil
}

// createGithubUpdater 创建GitHub更新器
func (s *SelfUpdateService) createGithubUpdater() (*selfupdate.Updater, error) {
	return selfupdate.NewUpdater(selfupdate.Config{})
}

// createGiteaUpdater 创建Gitea更新器
func (s *SelfUpdateService) createGiteaUpdater(config *models.AppConfig) (*selfupdate.Updater, error) {
	source, err := selfupdate.NewGiteaSource(selfupdate.GiteaConfig{
		BaseURL: config.Updates.Gitea.BaseURL,
	})
	if err != nil {
		return nil, fmt.Errorf("create gitea source failed: %w", err)
	}

	return selfupdate.NewUpdater(selfupdate.Config{Source: source})
}

// checkGithubUpdates 检查GitHub更新
func (s *SelfUpdateService) checkGithubUpdates(ctx context.Context, config *models.AppConfig) (*selfupdate.Release, bool, error) {
	updater, err := s.createGithubUpdater()
	if err != nil {
		return nil, false, err
	}

	repo := selfupdate.NewRepositorySlug(config.Updates.Github.Owner, config.Updates.Github.Repo)
	return updater.DetectLatest(ctx, repo)
}

// checkGiteaUpdates 检查Gitea更新
func (s *SelfUpdateService) checkGiteaUpdates(ctx context.Context, config *models.AppConfig) (*selfupdate.Release, bool, error) {
	updater, err := s.createGiteaUpdater(config)
	if err != nil {
		return nil, false, err
	}

	repo := selfupdate.NewRepositorySlug(config.Updates.Gitea.Owner, config.Updates.Gitea.Repo)
	return updater.DetectLatest(ctx, repo)
}

// ApplyUpdate 应用更新
func (s *SelfUpdateService) ApplyUpdate(ctx context.Context) (*SelfUpdateResult, error) {
	s.mu.Lock()
	if s.isUpdating {
		s.mu.Unlock()
		return nil, errors.New("update in progress")
	}
	s.isUpdating = true
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		s.isUpdating = false
		s.mu.Unlock()
	}()

	config, err := s.getConfig()
	if err != nil {
		return nil, err
	}

	exe, err := selfupdate.ExecutablePath()
	if err != nil {
		return nil, fmt.Errorf("locate executable failed: %w", err)
	}

	// 尝试主要源
	result, err := s.performUpdate(ctx, config.Updates.PrimarySource, exe, config)
	if err == nil {
		return result, nil
	}

	// 尝试备用源
	result, err = s.performUpdate(ctx, config.Updates.BackupSource, exe, config)
	if err != nil {
		return nil, fmt.Errorf("update failed from both sources: %w", err)
	}

	return result, nil
}

// performUpdate 执行更新操作（包括检测、备份、下载、应用）
func (s *SelfUpdateService) performUpdate(ctx context.Context, sourceType models.UpdateSourceType, exe string, config *models.AppConfig) (*SelfUpdateResult, error) {
	timeout := config.Updates.UpdateTimeout
	if timeout <= 0 {
		timeout = 30
	}
	checkCtx, cancel := context.WithTimeout(ctx, time.Duration(timeout)*time.Second)
	defer cancel()

	// 获取更新器和版本信息
	updater, release, found, err := s.getUpdateFromSource(checkCtx, sourceType, config)
	if err != nil || !found {
		return nil, fmt.Errorf("detect release failed: %w", err)
	}

	result := &SelfUpdateResult{
		CurrentVersion: config.Updates.Version,
		LatestVersion:  release.Version(),
		AssetURL:       release.AssetURL,
		ReleaseNotes:   release.ReleaseNotes,
		Source:         string(sourceType),
		HasUpdate:      release.GreaterThan(config.Updates.Version),
	}

	// 无更新
	if !result.HasUpdate {
		return result, nil
	}

	// 创建备份
	var backupPath string
	if config.Updates.BackupBeforeUpdate {
		backupPath, err = s.createBackup(exe)
		if err != nil {
			return nil, fmt.Errorf("backup failed: %w", err)
		}
		defer func() {
			if backupPath != "" {
				s.cleanupBackup(backupPath)
			}
		}()
	}

	// 下载并应用更新
	if err := updater.UpdateTo(ctx, release, exe); err != nil {
		return nil, fmt.Errorf("apply update failed: %w", err)
	}

	result.UpdateApplied = true
	s.handleUpdateSuccess(result)
	return result, nil
}

// getUpdateFromSource 从指定源获取更新信息
func (s *SelfUpdateService) getUpdateFromSource(ctx context.Context, sourceType models.UpdateSourceType, config *models.AppConfig) (*selfupdate.Updater, *selfupdate.Release, bool, error) {
	var updater *selfupdate.Updater
	var release *selfupdate.Release
	var found bool
	var err error

	switch sourceType {
	case models.UpdateSourceGithub:
		updater, err = s.createGithubUpdater()
		if err != nil {
			return nil, nil, false, err
		}
		release, found, err = s.checkGithubUpdates(ctx, config)
	case models.UpdateSourceGitea:
		updater, err = s.createGiteaUpdater(config)
		if err != nil {
			return nil, nil, false, err
		}
		release, found, err = s.checkGiteaUpdates(ctx, config)
	default:
		return nil, nil, false, fmt.Errorf("unsupported source: %s", sourceType)
	}

	return updater, release, found, err
}

// handleUpdateSuccess 处理更新成功后的操作
func (s *SelfUpdateService) handleUpdateSuccess(result *SelfUpdateResult) {
	// 更新配置版本
	if err := s.configService.Set("updates.version", result.LatestVersion); err != nil {
		s.logger.Error("update config version failed", "error", err)
	}

	// 执行配置迁移
	if err := s.configService.MigrateConfig(); err != nil {
		s.logger.Error("migrate config failed", "error", err)
	}

	// 移除badge
	if s.badgeService != nil {
		s.badgeService.RemoveBadge()
	}
}

// createBackup 创建可执行文件备份
func (s *SelfUpdateService) createBackup(executablePath string) (string, error) {
	backupPath := executablePath + ".backup"
	data, err := os.ReadFile(executablePath)
	if err != nil {
		return "", fmt.Errorf("read executable failed: %w", err)
	}

	if err := os.WriteFile(backupPath, data, 0755); err != nil {
		return "", fmt.Errorf("write backup failed: %w", err)
	}

	return backupPath, nil
}

// cleanupBackup 清理备份文件
func (s *SelfUpdateService) cleanupBackup(backupPath string) error {
	if err := os.Remove(backupPath); err != nil && !os.IsNotExist(err) {
		s.logger.Error("cleanup backup failed", "error", err)
	}
	return nil
}

// RestartApplication 重启应用程序
func (s *SelfUpdateService) RestartApplication() error {
	return s.restartApplication()
}

// handleUpdateBadge 处理更新徽章和通知
func (s *SelfUpdateService) handleUpdateBadge(result *SelfUpdateResult) {
	if result == nil || !result.HasUpdate {
		if s.badgeService != nil {
			s.badgeService.RemoveBadge()
		}
		return
	}

	// 显示徽章
	if s.badgeService != nil {
		if err := s.badgeService.SetBadge("●"); err != nil {
			s.logger.Error("set badge failed", "error", err)
		}
	}

	// 发送通知
	s.sendUpdateNotification(result)
}

// sendUpdateNotification 发送更新通知
func (s *SelfUpdateService) sendUpdateNotification(result *SelfUpdateResult) {
	if s.notificationService == nil {
		return
	}

	// 检查授权
	authorized, err := s.notificationService.CheckNotificationAuthorization()
	if err != nil || !authorized {
		authorized, err = s.notificationService.RequestNotificationAuthorization()
		if err != nil || !authorized {
			return
		}
	}

	// 发送通知
	s.notificationService.SendNotification(notifications.NotificationOptions{
		ID:       "update_available",
		Title:    "Voidraft Update Available",
		Subtitle: "New version available",
		Body:     fmt.Sprintf("Version %s available (current: %s)", result.LatestVersion, result.CurrentVersion),
	})
}
