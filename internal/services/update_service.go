package services

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/go-github/v63/github"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// UpdateCheckResult 更新检查结果
type UpdateCheckResult struct {
	HasUpdate    bool   `json:"hasUpdate"`    // 是否有更新
	CurrentVer   string `json:"currentVer"`   // 当前版本
	LatestVer    string `json:"latestVer"`    // 最新版本
	ReleaseNotes string `json:"releaseNotes"` // 发布说明
	ReleaseURL   string `json:"releaseURL"`   // 发布页面URL
	Error        string `json:"error"`        // 错误信息
}

// UpdateService 更新服务
type UpdateService struct {
	logger         *log.LoggerService
	configService  *ConfigService
	githubClient   *github.Client
	currentVersion string
}

// NewUpdateService 创建更新服务实例
func NewUpdateService(configService *ConfigService, logger *log.LoggerService) *UpdateService {
	config, err := configService.GetConfig()
	if err != nil {
		logger.Error("Failed to get config", "error", err)
		return nil
	}

	currentVersion := config.Updates.Version
	if currentVersion == "" {
		currentVersion = "1.0.0"
	}

	httpClient := &http.Client{Timeout: 30 * time.Second}
	githubClient := github.NewClient(httpClient)

	return &UpdateService{
		logger:         logger,
		configService:  configService,
		githubClient:   githubClient,
		currentVersion: currentVersion,
	}
}

// CheckForUpdates 检查更新
func (us *UpdateService) CheckForUpdates() UpdateCheckResult {
	result := UpdateCheckResult{
		CurrentVer: us.currentVersion,
		HasUpdate:  false,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	release, _, err := us.githubClient.Repositories.GetLatestRelease(ctx, "landaiqing", "voidraft")
	if err != nil {
		result.Error = fmt.Sprintf("Failed to check for updates: %v", err)
		return result
	}

	if release.GetDraft() || release.GetPrerelease() {
		result.Error = "Latest release is draft or prerelease"
		return result
	}

	latestVer := strings.TrimPrefix(release.GetTagName(), "v")
	currentVer := strings.TrimPrefix(us.currentVersion, "v")

	result.LatestVer = latestVer
	result.ReleaseNotes = release.GetBody()
	result.ReleaseURL = release.GetHTMLURL()

	if latestVer != currentVer && latestVer > currentVer {
		result.HasUpdate = true
	}

	return result
}
