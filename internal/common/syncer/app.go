package syncer

import (
	"context"
	"fmt"
	"sync"
	"time"
	"voidraft/internal/common/syncer/backend"
	"voidraft/internal/common/syncer/backend/git"
	snapshotstorebackend "voidraft/internal/common/syncer/backend/snapshotstore"
	localfsblob "voidraft/internal/common/syncer/backend/snapshotstore/blob/localfs"
	"voidraft/internal/common/syncer/engine"
	merge2 "voidraft/internal/common/syncer/merge"
	resource2 "voidraft/internal/common/syncer/resource"
	"voidraft/internal/common/syncer/scheduler"
	snapshot2 "voidraft/internal/common/syncer/snapshot"
	"voidraft/internal/models/ent"
)

const (
	defaultAuthorName   = "voidraft"
	defaultAuthorEmail  = "sync@voidraft.app"
	defaultSyncAttempts = 3
)

// Options describes app construction options.
type Options struct {
	Logger          Logger
	MaxSyncAttempts int
}

// App coordinates the sync system.
type App struct {
	logger          Logger
	snapshotter     snapshot2.Snapshotter
	store           snapshot2.Store
	merger          merge2.Merger
	maxSyncAttempts int

	mu         sync.RWMutex
	syncMu     sync.Mutex
	config     Config
	schedulers map[string]*scheduler.Ticker
}

// NewApp creates a new sync app.
func NewApp(client *ent.Client, options Options) *App {
	maxSyncAttempts := options.MaxSyncAttempts
	if maxSyncAttempts <= 0 {
		maxSyncAttempts = defaultSyncAttempts
	}

	adapters := []resource2.Adapter{
		resource2.NewDocumentAdapter(client),
		resource2.NewExtensionAdapter(client),
		resource2.NewKeyBindingAdapter(client),
		resource2.NewThemeAdapter(client),
	}

	return &App{
		logger:          options.Logger,
		snapshotter:     resource2.NewRegistry(adapters...),
		store:           snapshot2.NewFileStore(),
		merger:          merge2.NewUpdatedAtWinsMerger(),
		maxSyncAttempts: maxSyncAttempts,
		schedulers:      make(map[string]*scheduler.Ticker),
	}
}

// Reconfigure replaces the current sync configuration.
func (a *App) Reconfigure(ctx context.Context, cfg Config) error {
	_ = ctx

	normalized := cfg.Normalize()
	for _, target := range normalized.Targets {
		if !target.Enabled || !target.Ready() {
			continue
		}
		if err := target.Validate(); err != nil {
			return fmt.Errorf("validate target %s: %w", target.Kind, err)
		}
	}

	a.mu.Lock()
	a.config = normalized
	a.mu.Unlock()

	return nil
}

// Start starts auto-sync schedulers for the current config.
func (a *App) Start(ctx context.Context) error {
	targets := a.targetsSnapshot()
	if err := a.verifyTargets(ctx, targets); err != nil {
		return err
	}

	a.mu.Lock()
	defer a.mu.Unlock()

	a.stopSchedulersLocked()

	for _, target := range targets {
		if !target.Ready() || !target.Schedule.AutoSync || target.Schedule.Interval <= 0 {
			continue
		}

		targetID := target.Kind
		task := scheduler.NewTicker()
		task.Start(target.Schedule.Interval, func(runCtx context.Context) error {
			_, err := a.Sync(runCtx, targetID)
			if err != nil && a.logger != nil {
				a.logger.Error("sync auto run failed for target %s: %v", targetID, err)
			}
			return err
		})
		a.schedulers[targetID] = task
	}

	return nil
}

// Stop stops all running auto-sync schedulers.
func (a *App) Stop(ctx context.Context) error {
	_ = ctx

	a.mu.Lock()
	defer a.mu.Unlock()

	a.stopSchedulersLocked()
	return nil
}

// Sync runs one full sync for the given target.
func (a *App) Sync(ctx context.Context, targetID string) (*SyncResult, error) {
	target, err := a.currentTarget(targetID)
	if err != nil {
		return nil, err
	}
	if !target.Enabled {
		return nil, ErrTargetDisabled
	}
	if !target.Ready() {
		return nil, ErrTargetNotReady
	}

	backendInstance, err := a.newBackend(target)
	if err != nil {
		return nil, err
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
		CommitMessage: a.commitMessage(target),
	})
	if err != nil {
		return nil, err
	}

	return &SyncResult{
		TargetID:       target.Kind,
		LocalChanged:   result.LocalChanged,
		RemoteChanged:  result.RemoteChanged,
		AppliedToLocal: result.AppliedToLocal,
		Published:      result.Published,
	}, nil
}

// TestTarget verifies a target config and returns resolved backend details.
func (a *App) TestTarget(ctx context.Context, target TargetConfig) (string, error) {
	if err := target.Validate(); err != nil {
		return "", err
	}

	backendInstance, err := a.newBackend(target)
	if err != nil {
		return "", err
	}
	defer func() {
		_ = backendInstance.Close()
	}()

	if err := backendInstance.Verify(ctx); err != nil {
		return "", err
	}

	if resolver, ok := backendInstance.(interface{ ResolvedBranch() string }); ok {
		return resolver.ResolvedBranch(), nil
	}
	return "", nil
}

// commitMessage builds the sync commit message.
func (a *App) commitMessage(target TargetConfig) string {
	return fmt.Sprintf("Sync %s %s", target.Kind, time.Now().Format(time.RFC3339))
}

// currentTarget returns the current target config from memory.
func (a *App) currentTarget(targetID string) (TargetConfig, error) {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.config.Target(targetID)
}

// targetsSnapshot returns a stable copy of the configured targets.
func (a *App) targetsSnapshot() []TargetConfig {
	a.mu.RLock()
	defer a.mu.RUnlock()

	targets := make([]TargetConfig, len(a.config.Targets))
	copy(targets, a.config.Targets)
	return targets
}

// verifyTargets verifies all ready targets before scheduling.
func (a *App) verifyTargets(ctx context.Context, targets []TargetConfig) error {
	for _, target := range targets {
		if !target.Ready() {
			continue
		}

		if _, err := a.TestTarget(ctx, target); err != nil {
			return fmt.Errorf("verify target %s: %w", target.Kind, err)
		}
	}
	return nil
}

// newBackend creates a backend instance from the target config.
func (a *App) newBackend(target TargetConfig) (backend.Backend, error) {
	switch target.Kind {
	case TargetKindGit:
		if target.Git == nil {
			return nil, fmt.Errorf("target %s: git config is nil", target.Kind)
		}
		return git.New(git.Config{
			RepoPath:    target.Git.RepoPath,
			RepoURL:     target.Git.RepoURL,
			Branch:      target.Git.Branch,
			RemoteName:  target.Git.RemoteName,
			AuthorName:  fallbackString(target.Git.AuthorName, defaultAuthorName),
			AuthorEmail: fallbackString(target.Git.AuthorEmail, defaultAuthorEmail),
			Auth: git.AuthConfig{
				Method:         target.Git.Auth.Method,
				Username:       target.Git.Auth.Username,
				Password:       target.Git.Auth.Password,
				Token:          target.Git.Auth.Token,
				SSHKeyPath:     target.Git.Auth.SSHKeyPath,
				SSHKeyPassword: target.Git.Auth.SSHKeyPassword,
			},
		})
	case TargetKindLocalFS:
		if target.LocalFS == nil {
			return nil, fmt.Errorf("target %s: localfs config is nil", target.Kind)
		}
		store, err := localfsblob.New(target.LocalFS.RootPath)
		if err != nil {
			return nil, err
		}
		return snapshotstorebackend.New(snapshotstorebackend.Config{
			Store:     store,
			Namespace: target.LocalFS.Namespace,
			HeadKey:   target.LocalFS.HeadKey,
		})
	default:
		return nil, fmt.Errorf("%w: %s", ErrUnsupportedBackend, target.Kind)
	}
}

// stopSchedulersLocked stops all schedulers while the app lock is held.
func (a *App) stopSchedulersLocked() {
	for targetID, task := range a.schedulers {
		task.Stop()
		delete(a.schedulers, targetID)
	}
}

// fallbackString returns the first non-empty string.
func fallbackString(value string, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
