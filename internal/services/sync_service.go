package services

import (
	"context"
	"fmt"
	"path/filepath"
	"time"
	"voidraft/internal/common/helper"
	"voidraft/internal/models"
	"voidraft/internal/syncer"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

const (
	syncDir        = "sync"
	localFSHeadKey = "head.json"
)

// SyncService 提供应用层同步服务入口。
type SyncService struct {
	configService   *ConfigService
	dbService       *DatabaseService
	logger          *log.LogService
	app             *syncer.App
	cancelObservers []helper.CancelFunc
}

// NewSyncService 创建新的同步服务实例。
func NewSyncService(configService *ConfigService, dbService *DatabaseService, logger *log.LogService) *SyncService {
	return &SyncService{
		configService: configService,
		dbService:     dbService,
		logger:        logger,
	}
}

// ServiceStartup 在服务启动时初始化同步系统。
func (s *SyncService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	_ = options

	if err := s.ensureApp(); err != nil {
		return err
	}

	s.cancelObservers = []helper.CancelFunc{
		s.configService.Watch("sync", s.onSyncConfigChange),
		s.configService.Watch("general.dataPath", s.onDataPathChange),
	}

	if err := s.Initialize(); err != nil {
		s.logger.Error("initializing sync service: %v", err)
	}

	return nil
}

// Initialize 重新加载配置并启动自动同步。
func (s *SyncService) Initialize() error {
	if err := s.ensureApp(); err != nil {
		return err
	}

	config, err := s.buildConfig()
	if err != nil {
		return err
	}

	if err := s.app.Reconfigure(context.Background(), config); err != nil {
		return fmt.Errorf("reconfigure sync app: %w", err)
	}
	if err := s.app.Start(context.Background()); err != nil {
		return fmt.Errorf("start sync app: %w", err)
	}
	return nil
}

// Reinitialize 重新初始化同步服务。
func (s *SyncService) Reinitialize() error {
	return s.Initialize()
}

// HandleConfigChange 在配置变化时重新应用配置。
func (s *SyncService) HandleConfigChange(config *models.SyncConfig) error {
	_ = config
	return s.Initialize()
}

// StartAutoSync 启动自动同步调度。
func (s *SyncService) StartAutoSync() error {
	if err := s.ensureApp(); err != nil {
		return err
	}
	return s.app.Start(context.Background())
}

// StopAutoSync 停止自动同步调度。
func (s *SyncService) StopAutoSync() {
	if s.app == nil {
		return
	}
	if err := s.app.Stop(context.Background()); err != nil {
		s.logger.Warning("stop sync app: %v", err)
	}
}

// Sync 执行一次手动同步。
func (s *SyncService) Sync() error {
	if err := s.ensureApp(); err != nil {
		return err
	}

	targetID, err := s.selectedTargetID()
	if err != nil {
		return err
	}

	if _, err := s.app.Sync(context.Background(), targetID); err != nil {
		return err
	}
	return nil
}

// ServiceShutdown 停止同步服务并释放资源。
func (s *SyncService) ServiceShutdown() {
	for _, cancel := range s.cancelObservers {
		if cancel != nil {
			cancel()
		}
	}
	s.StopAutoSync()
}

// onSyncConfigChange 响应 sync 配置变化。
func (s *SyncService) onSyncConfigChange(oldValue interface{}, newValue interface{}) {
	_, _ = oldValue, newValue
	if err := s.Initialize(); err != nil {
		s.logger.Error("reconfigure sync after sync config change: %v", err)
	}
}

// onDataPathChange 响应数据目录变化。
func (s *SyncService) onDataPathChange(oldValue interface{}, newValue interface{}) {
	_, _ = oldValue, newValue
	if err := s.Reinitialize(); err != nil {
		s.logger.Error("reconfigure sync after data path change: %v", err)
	}
}

// ensureApp 保证同步应用已被创建。
func (s *SyncService) ensureApp() error {
	if s.app != nil {
		return nil
	}
	if s.dbService == nil || s.dbService.Client == nil {
		return fmt.Errorf("sync database client is not ready")
	}

	s.app = syncer.NewApp(s.dbService.Client, syncer.Options{
		Logger:          s.logger,
		MaxSyncAttempts: 3,
	})
	return nil
}

// buildConfig 将现有应用配置映射为同步核心配置。
func (s *SyncService) buildConfig() (syncer.Config, error) {
	appConfig, err := s.configService.GetConfig()
	if err != nil {
		return syncer.Config{}, err
	}

	return syncer.Config{
		Targets: []syncer.TargetConfig{
			s.buildGitTargetConfig(appConfig.General.DataPath, appConfig.Sync.Git),
			s.buildLocalFSTargetConfig(appConfig.Sync.LocalFS),
		},
	}, nil
}

// selectedTargetID 返回当前选中的同步目标标识。
func (s *SyncService) selectedTargetID() (string, error) {
	appConfig, err := s.configService.GetConfig()
	if err != nil {
		return "", err
	}

	switch appConfig.Sync.Target {
	case models.SyncTargetGit:
		return string(models.SyncTargetGit), nil
	case models.SyncTargetLocalFS:
		return string(models.SyncTargetLocalFS), nil
	default:
		return "", fmt.Errorf("unsupported sync target: %s", appConfig.Sync.Target)
	}
}

// buildGitTargetConfig 将 Git 配置转换为同步核心目标配置。
func (s *SyncService) buildGitTargetConfig(dataPath string, config models.GitSyncConfig) syncer.TargetConfig {
	return syncer.TargetConfig{
		Kind:    syncer.TargetKindGit,
		Enabled: config.Enabled,
		Schedule: syncer.ScheduleConfig{
			AutoSync: config.AutoSync,
			Interval: time.Duration(config.SyncInterval) * time.Minute,
		},
		Git: &syncer.GitTargetConfig{
			RepoPath:    filepath.Join(dataPath, syncDir),
			RepoURL:     config.RepoURL,
			Branch:      syncer.DefaultBranch,
			RemoteName:  syncer.DefaultRemoteName,
			AuthorName:  "voidraft",
			AuthorEmail: "sync@voidraft.app",
			Auth: syncer.GitAuthConfig{
				Method:         string(config.AuthMethod),
				Username:       config.Username,
				Password:       config.Password,
				Token:          config.Token,
				SSHKeyPath:     config.SSHKeyPath,
				SSHKeyPassword: config.SSHKeyPass,
			},
		},
	}
}

// buildLocalFSTargetConfig 将 localfs 配置转换为同步核心目标配置。
func (s *SyncService) buildLocalFSTargetConfig(config models.LocalFSSyncConfig) syncer.TargetConfig {
	return syncer.TargetConfig{
		Kind:    syncer.TargetKindLocalFS,
		Enabled: config.Enabled,
		Schedule: syncer.ScheduleConfig{
			AutoSync: config.AutoSync,
			Interval: time.Duration(config.SyncInterval) * time.Minute,
		},
		LocalFS: &syncer.LocalFSTargetConfig{
			Namespace: string(models.SyncTargetLocalFS),
			HeadKey:   localFSHeadKey,
			RootPath:  config.RootPath,
		},
	}
}
