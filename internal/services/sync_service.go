package services

import (
	"context"
	"fmt"
	"strings"
	"voidraft/internal/common/helper"
	"voidraft/internal/common/syncer"
	"voidraft/internal/models"
	"voidraft/internal/models/ent"
	"voidraft/internal/models/ent/syncrunlog"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// SyncService exposes app-layer sync operations.
type SyncService struct {
	configService   *ConfigService
	dbService       *DatabaseService
	logger          *log.LogService
	app             *syncer.App
	cancelObservers []helper.CancelFunc
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

	cfg, dataPath, err := s.currentSyncConfig()
	if err != nil {
		return err
	}

	if err := s.app.Reconfigure(context.Background(), dataPath, cfg); err != nil {
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
	return s.Initialize()
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

// Sync runs one manual sync.
func (s *SyncService) Sync() error {
	if err := s.ensureApp(); err != nil {
		return err
	}

	cfg, dataPath, err := s.currentSyncConfig()
	if err != nil {
		return err
	}
	if err := s.app.Reconfigure(context.Background(), dataPath, cfg); err != nil {
		return fmt.Errorf("reconfigure sync app: %w", err)
	}

	return s.app.Sync(context.Background(), models.SyncRunTriggerManual)
}

// ListSyncRunLogs returns paginated sync execution records.
func (s *SyncService) ListSyncRunLogs(page int, pageSize int) ([]models.SyncRunRecord, error) {
	if s.dbService == nil || s.dbService.Client == nil {
		return []models.SyncRunRecord{}, fmt.Errorf("sync database client is not ready")
	}
	if page < 1 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}

	items, err := s.dbService.Client.SyncRunLog.Query().
		Order(ent.Desc(syncrunlog.FieldStartedAt)).
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		All(context.Background())
	if err != nil {
		return nil, err
	}

	records := make([]models.SyncRunRecord, 0, len(items))
	for _, item := range items {
		records = append(records, models.SyncRunRecord{
			ID:          item.ID,
			TargetType:  models.SyncTarget(item.TargetType),
			TargetPath:  item.TargetPath,
			Branch:      item.Branch,
			TriggerType: models.SyncRunTriggerType(item.TriggerType),
			Status:      models.SyncRunStatus(item.Status),
			StartedAt:   item.StartedAt,
			FinishedAt:  item.FinishedAt,
			Details:     item.Details,
		})
	}

	return records, nil
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
	})
	return nil
}

func (s *SyncService) currentSyncConfig() (models.SyncConfig, string, error) {
	appConfig, err := s.configService.GetConfig()
	if err != nil {
		return models.SyncConfig{}, "", err
	}

	cfg := appConfig.Sync
	if cfg.Target == "" {
		cfg.Target = models.SyncTargetGit
	}
	if cfg.SyncInterval <= 0 {
		cfg.SyncInterval = 60
	}
	if strings.TrimSpace(cfg.Git.Branch) == "" {
		cfg.Git.Branch = models.DefaultGitSyncBranch
	}

	return cfg, appConfig.General.DataPath, nil
}
