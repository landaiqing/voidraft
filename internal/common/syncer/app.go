package syncer

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"time"
	"voidraft/internal/common/syncer/backend"
	"voidraft/internal/common/syncer/backend/git"
	snapshotstorebackend "voidraft/internal/common/syncer/backend/snapshotstore"
	localfsblob "voidraft/internal/common/syncer/backend/snapshotstore/blob/localfs"
	"voidraft/internal/common/syncer/engine"
	"voidraft/internal/common/syncer/merge"
	"voidraft/internal/common/syncer/resource"
	"voidraft/internal/common/syncer/scheduler"
	"voidraft/internal/common/syncer/snapshot"
	"voidraft/internal/models"
	"voidraft/internal/models/ent"

	"github.com/wailsapp/wails/v3/pkg/services/log"
)

const (
	defaultAuthorName     = "voidraft"
	defaultAuthorEmail    = "sync@voidraft.app"
	defaultRemoteName     = "origin"
	defaultSyncRepoDir    = "sync"
	defaultLocalFSHeadKey = "head.json"
	defaultSyncAttempts   = 3
)

// Options describes app construction options.
type Options struct {
	Logger          *log.LogService
	MaxSyncAttempts int
}

// App coordinates the sync system.
type App struct {
	client          *ent.Client
	logger          *log.LogService
	snapshotter     snapshot.Snapshotter
	store           snapshot.Store
	merger          merge.Merger
	maxSyncAttempts int

	mu        sync.RWMutex
	syncMu    sync.Mutex
	config    models.SyncConfig
	dataPath  string
	scheduler *scheduler.Ticker
}

// NewApp creates a new sync app.
func NewApp(client *ent.Client, options Options) *App {
	maxSyncAttempts := options.MaxSyncAttempts
	if maxSyncAttempts <= 0 {
		maxSyncAttempts = defaultSyncAttempts
	}

	adapters := []resource.Adapter{
		resource.NewDocumentAdapter(client),
		resource.NewExtensionAdapter(client),
		resource.NewKeyBindingAdapter(client),
		resource.NewThemeAdapter(client),
	}

	return &App{
		client:          client,
		logger:          options.Logger,
		snapshotter:     resource.NewRegistry(adapters...),
		store:           snapshot.NewFileStore(),
		merger:          merge.NewUpdatedAtWinsMerger(),
		maxSyncAttempts: maxSyncAttempts,
	}
}

// Reconfigure replaces the current sync configuration.
func (a *App) Reconfigure(ctx context.Context, dataPath string, cfg models.SyncConfig) error {
	_ = ctx

	a.mu.Lock()
	a.config = cfg
	a.dataPath = dataPath
	a.mu.Unlock()

	return nil
}

// Start starts auto-sync scheduler for the current config.
func (a *App) Start(ctx context.Context) error {
	cfg, dataPath := a.configSnapshot()
	if !cfg.Enabled || !cfg.AutoSync || cfg.SyncInterval <= 0 || !a.isConfigured(cfg, dataPath) {
		a.mu.Lock()
		defer a.mu.Unlock()
		a.stopSchedulerLocked()
		return nil
	}

	if err := a.verifyConfig(ctx, cfg, dataPath); err != nil {
		return err
	}

	interval := time.Duration(cfg.SyncInterval) * time.Minute

	a.mu.Lock()
	defer a.mu.Unlock()

	a.stopSchedulerLocked()

	task := scheduler.NewTicker()
	task.Start(interval, func(runCtx context.Context) error {
		return a.Sync(runCtx, models.SyncRunTriggerAuto)
	})
	a.scheduler = task

	return nil
}

// Stop stops the running auto-sync scheduler.
func (a *App) Stop(ctx context.Context) error {
	_ = ctx

	a.mu.Lock()
	defer a.mu.Unlock()

	a.stopSchedulerLocked()
	return nil
}

// Sync runs one full sync for the current target.
func (a *App) Sync(ctx context.Context, trigger models.SyncRunTriggerType) error {
	cfg, dataPath := a.configSnapshot()
	startedAt := time.Now()

	if !cfg.Enabled {
		return ErrSyncDisabled
	}
	if err := a.validateConfig(cfg, dataPath); err != nil {
		a.recordSyncRun(cfg, dataPath, trigger, startedAt, time.Now(), nil, err, "validate_config", false)
		return err
	}

	if a.logger != nil {
		a.logger.Info(
			"sync started trigger=%s target=%s branch=%s target_path=%s",
			trigger,
			cfg.Target,
			a.syncBranch(cfg),
			a.syncTargetPath(cfg),
		)
	}

	backendInstance, err := a.newBackend(cfg, dataPath)
	if err != nil {
		a.recordSyncRun(cfg, dataPath, trigger, startedAt, time.Now(), nil, err, "prepare_backend", false)
		return err
	}
	defer func() {
		_ = backendInstance.Close()
	}()

	syncEngine := engine.NewSyncEngine(
		backendInstance,
		a.store,
		a.snapshotter,
		a.merger,
		engine.Options{
			Logger:      a.logger,
			MaxAttempts: a.maxSyncAttempts,
		},
	)

	a.syncMu.Lock()
	defer a.syncMu.Unlock()

	result, err := syncEngine.Sync(ctx, engine.SyncOptions{
		CommitMessage: a.commitMessage(cfg),
	})
	finishedAt := time.Now()
	a.recordSyncRun(cfg, dataPath, trigger, startedAt, finishedAt, result, err, "", false)
	if err != nil {
		a.logSyncFailure(cfg, trigger, err)
		return err
	}
	a.logSyncSuccess(cfg, trigger, result)
	return nil
}

func (a *App) verifyConfig(ctx context.Context, cfg models.SyncConfig, dataPath string) error {
	if err := a.validateConfig(cfg, dataPath); err != nil {
		return err
	}

	backendInstance, err := a.newBackend(cfg, dataPath)
	if err != nil {
		return err
	}
	defer func() {
		_ = backendInstance.Close()
	}()

	if err := backendInstance.Verify(ctx); err != nil {
		return err
	}
	return nil
}

// commitMessage builds the sync commit message.
func (a *App) commitMessage(cfg models.SyncConfig) string {
	return fmt.Sprintf("Sync %s %s", cfg.Target, time.Now().Format(time.RFC3339))
}

func (a *App) configSnapshot() (models.SyncConfig, string) {
	a.mu.RLock()
	defer a.mu.RUnlock()

	cfg := a.config
	if cfg.Target == "" {
		cfg.Target = models.SyncTargetGit
	}
	if cfg.SyncInterval <= 0 {
		cfg.SyncInterval = 60
	}
	if strings.TrimSpace(cfg.Git.Branch) == "" {
		cfg.Git.Branch = models.DefaultGitSyncBranch
	}
	return cfg, a.dataPath
}

func (a *App) validateConfig(cfg models.SyncConfig, dataPath string) error {
	switch cfg.Target {
	case models.SyncTargetGit:
		if strings.TrimSpace(dataPath) == "" {
			return ErrSyncNotConfigured
		}
		if strings.TrimSpace(cfg.Git.RepoURL) == "" {
			return ErrSyncNotConfigured
		}
	case models.SyncTargetLocalFS:
		if strings.TrimSpace(cfg.LocalFS.RootPath) == "" {
			return ErrSyncNotConfigured
		}
	default:
		return fmt.Errorf("%w: %s", ErrUnsupportedTarget, cfg.Target)
	}
	return nil
}

func (a *App) isConfigured(cfg models.SyncConfig, dataPath string) bool {
	switch cfg.Target {
	case models.SyncTargetGit:
		return strings.TrimSpace(dataPath) != "" && strings.TrimSpace(cfg.Git.RepoURL) != ""
	case models.SyncTargetLocalFS:
		return strings.TrimSpace(cfg.LocalFS.RootPath) != ""
	default:
		return false
	}
}

// newBackend creates a backend instance from the current sync config.
func (a *App) newBackend(cfg models.SyncConfig, dataPath string) (backend.Backend, error) {
	switch cfg.Target {
	case models.SyncTargetGit:
		return git.New(git.Config{
			RepoPath:    filepath.Join(dataPath, defaultSyncRepoDir),
			RepoURL:     cfg.Git.RepoURL,
			Branch:      cfg.Git.Branch,
			RemoteName:  defaultRemoteName,
			AuthorName:  defaultAuthorName,
			AuthorEmail: defaultAuthorEmail,
			Auth: git.AuthConfig{
				Method:         string(cfg.Git.AuthMethod),
				Username:       cfg.Git.Username,
				Password:       cfg.Git.Password,
				Token:          cfg.Git.Token,
				SSHKeyPath:     cfg.Git.SSHKeyPath,
				SSHKeyPassword: cfg.Git.SSHKeyPass,
			},
		})
	case models.SyncTargetLocalFS:
		store, err := localfsblob.New(cfg.LocalFS.RootPath)
		if err != nil {
			return nil, err
		}
		return snapshotstorebackend.New(snapshotstorebackend.Config{
			Store:     store,
			Namespace: string(models.SyncTargetLocalFS),
			HeadKey:   defaultLocalFSHeadKey,
		})
	default:
		return nil, fmt.Errorf("%w: %s", ErrUnsupportedTarget, cfg.Target)
	}
}

// stopSchedulerLocked stops the scheduler while the app lock is held.
func (a *App) stopSchedulerLocked() {
	if a.scheduler == nil {
		return
	}
	a.scheduler.Stop()
	a.scheduler = nil
}
