package services

import (
	"context"
	"fmt"
	"path/filepath"
	"sync"
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

// SyncStatus describes the latest manual sync state.
type SyncStatus struct {
	TargetID       string `json:"target_id,omitempty"`
	LastSyncAt     string `json:"last_sync_at,omitempty"`
	LastSuccessAt  string `json:"last_success_at,omitempty"`
	LastError      string `json:"last_error,omitempty"`
	LocalChanged   bool   `json:"local_changed"`
	RemoteChanged  bool   `json:"remote_changed"`
	AppliedToLocal bool   `json:"applied_to_local"`
	Published      bool   `json:"published"`
}

// SyncConnectionResult describes a connection test result.
type SyncConnectionResult struct {
	TargetID       string `json:"target_id"`
	ResolvedBranch string `json:"resolved_branch,omitempty"`
}

// SyncService exposes app-layer sync operations.
type SyncService struct {
	configService   *ConfigService
	dbService       *DatabaseService
	logger          *log.LogService
	app             *syncer.App
	cancelObservers []helper.CancelFunc
	statusMu        sync.RWMutex
	status          SyncStatus
}

// NewSyncService creates a new sync service instance.
func NewSyncService(configService *ConfigService, dbService *DatabaseService, logger *log.LogService) *SyncService {
	return &SyncService{
		configService: configService,
		dbService:     dbService,
		logger:        logger,
	}
}

// ServiceStartup initializes the sync service and config observers.
func (s *SyncService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	_ = ctx
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

// Initialize reloads config and restarts auto-sync.
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
		s.logger.Warning("start sync app: %v", err)
	}
	return nil
}

// Reinitialize is an alias used by config watchers.
func (s *SyncService) Reinitialize() error {
	return s.Initialize()
}

// HandleConfigChange re-applies sync config changes.
func (s *SyncService) HandleConfigChange(config *models.SyncConfig) error {
	_ = config
	return s.Initialize()
}

// StartAutoSync starts auto-sync scheduling.
func (s *SyncService) StartAutoSync() error {
	if err := s.ensureApp(); err != nil {
		return err
	}
	return s.app.Start(context.Background())
}

// StopAutoSync stops auto-sync scheduling.
func (s *SyncService) StopAutoSync() {
	if s.app == nil {
		return
	}
	if err := s.app.Stop(context.Background()); err != nil {
		s.logger.Warning("stop sync app: %v", err)
	}
}

// Sync runs one manual sync and returns the latest status.
func (s *SyncService) Sync() (*SyncStatus, error) {
	if err := s.ensureApp(); err != nil {
		return nil, err
	}

	targetID, err := s.selectedTargetID()
	if err != nil {
		return nil, err
	}

	syncedAt := time.Now().Format(time.RFC3339)
	result, err := s.app.Sync(context.Background(), targetID)
	if err != nil {
		status := s.statusSnapshot()
		status.TargetID = targetID
		status.LastSyncAt = syncedAt
		status.LastError = err.Error()
		status.LocalChanged = false
		status.RemoteChanged = false
		status.AppliedToLocal = false
		status.Published = false
		s.storeStatus(status)
		return nil, err
	}

	status := SyncStatus{
		TargetID:       targetID,
		LastSyncAt:     syncedAt,
		LastSuccessAt:  syncedAt,
		LocalChanged:   result.LocalChanged,
		RemoteChanged:  result.RemoteChanged,
		AppliedToLocal: result.AppliedToLocal,
		Published:      result.Published,
	}
	s.storeStatus(status)
	return s.GetStatus(), nil
}

// TestConnection validates the selected target configuration immediately.
func (s *SyncService) TestConnection() (*SyncConnectionResult, error) {
	if err := s.ensureApp(); err != nil {
		return nil, err
	}

	target, err := s.selectedTargetConfig()
	if err != nil {
		return nil, err
	}

	resolvedBranch, err := s.app.TestTarget(context.Background(), target)
	if err != nil {
		return nil, err
	}

	return &SyncConnectionResult{
		TargetID:       target.Kind,
		ResolvedBranch: resolvedBranch,
	}, nil
}

// GetStatus returns the latest manual sync status.
func (s *SyncService) GetStatus() *SyncStatus {
	status := s.statusSnapshot()
	return &status
}

// ServiceShutdown stops observers and sync schedulers.
func (s *SyncService) ServiceShutdown() {
	for _, cancel := range s.cancelObservers {
		if cancel != nil {
			cancel()
		}
	}
	s.StopAutoSync()
}

// onSyncConfigChange reacts to sync config updates.
func (s *SyncService) onSyncConfigChange(oldValue interface{}, newValue interface{}) {
	_, _ = oldValue, newValue
	if err := s.Initialize(); err != nil {
		s.logger.Error("reconfigure sync after sync config change: %v", err)
	}
}

// onDataPathChange reacts to data path changes.
func (s *SyncService) onDataPathChange(oldValue interface{}, newValue interface{}) {
	_, _ = oldValue, newValue
	if err := s.Reinitialize(); err != nil {
		s.logger.Error("reconfigure sync after data path change: %v", err)
	}
}

// ensureApp ensures the sync app is ready.
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
		MediaRootResolve: func() string {
			if s.configService == nil {
				return ""
			}
			config, err := s.configService.GetConfig()
			if err != nil {
				return ""
			}
			return helper.NewMediaHelper().RootPath(config.General.DataPath)
		},
	})
	return nil
}

// buildConfig maps app config into sync-core config.
func (s *SyncService) buildConfig() (syncer.Config, error) {
	target, err := s.selectedTargetConfig()
	if err != nil {
		return syncer.Config{}, err
	}

	return syncer.Config{
		Targets: []syncer.TargetConfig{target},
	}, nil
}

// selectedTargetConfig builds the config for the selected sync target.
func (s *SyncService) selectedTargetConfig() (syncer.TargetConfig, error) {
	appConfig, err := s.configService.GetConfig()
	if err != nil {
		return syncer.TargetConfig{}, err
	}

	switch appConfig.Sync.Target {
	case models.SyncTargetGit:
		return s.buildGitTargetConfig(appConfig.General.DataPath, appConfig.Sync.Git), nil
	case models.SyncTargetLocalFS:
		return s.buildLocalFSTargetConfig(appConfig.Sync.LocalFS), nil
	default:
		return syncer.TargetConfig{}, fmt.Errorf("unsupported sync target: %s", appConfig.Sync.Target)
	}
}

// selectedTargetID returns the selected target identifier.
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

// buildGitTargetConfig converts Git config into sync-core target config.
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
			Branch:      "",
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

// buildLocalFSTargetConfig converts localfs config into sync-core target config.
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

// statusSnapshot returns a copy of the current sync status.
func (s *SyncService) statusSnapshot() SyncStatus {
	s.statusMu.RLock()
	defer s.statusMu.RUnlock()
	return s.status
}

// storeStatus updates the current sync status.
func (s *SyncService) storeStatus(status SyncStatus) {
	s.statusMu.Lock()
	s.status = status
	s.statusMu.Unlock()
}
