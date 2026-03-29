package syncer

import (
	"context"
	"fmt"
	"sync"
	"time"
	"voidraft/internal/models/ent"
	"voidraft/internal/syncer/backend"
	gitbackend "voidraft/internal/syncer/backend/git"
	snapshotstorebackend "voidraft/internal/syncer/backend/snapshotstore"
	localfsblob "voidraft/internal/syncer/backend/snapshotstore/blob/localfs"
	"voidraft/internal/syncer/engine"
	"voidraft/internal/syncer/merge"
	"voidraft/internal/syncer/resource"
	"voidraft/internal/syncer/scheduler"
	"voidraft/internal/syncer/snapshot"
)

const (
	defaultAuthorName   = "voidraft"
	defaultAuthorEmail  = "sync@voidraft.app"
	defaultSyncAttempts = 3
)

// Options 描述同步应用的构造选项。
type Options struct {
	Logger          Logger
	MaxSyncAttempts int
}

// App 是同步系统的编排入口。
type App struct {
	logger          Logger
	snapshotter     snapshot.Snapshotter
	store           snapshot.Store
	merger          merge.Merger
	maxSyncAttempts int

	mu         sync.RWMutex
	syncMu     sync.Mutex
	config     Config
	schedulers map[string]*scheduler.Ticker
}

// NewApp 创建新的同步应用实例。
func NewApp(client *ent.Client, options Options) *App {
	maxSyncAttempts := options.MaxSyncAttempts
	if maxSyncAttempts <= 0 {
		maxSyncAttempts = defaultSyncAttempts
	}

	return &App{
		logger: options.Logger,
		snapshotter: resource.NewRegistry(
			resource.NewDocumentAdapter(client),
			resource.NewExtensionAdapter(client),
			resource.NewKeyBindingAdapter(client),
			resource.NewThemeAdapter(client),
		),
		store:           snapshot.NewFileStore(),
		merger:          merge.NewUpdatedAtWinsMerger(),
		maxSyncAttempts: maxSyncAttempts,
		schedulers:      make(map[string]*scheduler.Ticker),
	}
}

// Reconfigure 更新同步系统配置。
func (a *App) Reconfigure(ctx context.Context, cfg Config) error {
	_ = ctx

	normalized := cfg.Normalize()
	for _, target := range normalized.Targets {
		if err := target.Validate(); err != nil {
			return fmt.Errorf("validate target %s: %w", target.Kind, err)
		}
	}

	a.mu.Lock()
	a.config = normalized
	a.mu.Unlock()

	return nil
}

// Start 按当前配置启动自动同步调度。
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

		currentTargetID := target.Kind
		task := scheduler.NewTicker()
		task.Start(target.Schedule.Interval, func(runCtx context.Context) error {
			_, err := a.Sync(runCtx, currentTargetID)
			if err != nil && a.logger != nil {
				a.logger.Error("sync auto run failed for target %s: %v", currentTargetID, err)
			}
			return err
		})
		a.schedulers[currentTargetID] = task
	}

	return nil
}

// Stop 停止所有自动同步调度。
func (a *App) Stop(ctx context.Context) error {
	_ = ctx

	a.mu.Lock()
	defer a.mu.Unlock()

	a.stopSchedulersLocked()
	return nil
}

// Sync 执行指定目标的一次完整同步。
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
		ConflictCount:  result.ConflictCount,
		Revision:       result.Revision,
	}, nil
}

// commitMessage 生成提交信息。
func (a *App) commitMessage(target TargetConfig) string {
	return fmt.Sprintf("Sync %s %s", target.Kind, time.Now().Format(time.RFC3339))
}

// currentTarget 返回当前内存中的目标配置。
func (a *App) currentTarget(targetID string) (TargetConfig, error) {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.config.Target(targetID)
}

// targetsSnapshot 返回当前所有目标的快照。
func (a *App) targetsSnapshot() []TargetConfig {
	a.mu.RLock()
	defer a.mu.RUnlock()

	targets := make([]TargetConfig, len(a.config.Targets))
	copy(targets, a.config.Targets)
	return targets
}

// verifyTargets 预先校验所有已就绪目标。
func (a *App) verifyTargets(ctx context.Context, targets []TargetConfig) error {
	for _, target := range targets {
		if !target.Ready() {
			continue
		}

		backendInstance, err := a.newBackend(target)
		if err != nil {
			return err
		}

		verifyErr := backendInstance.Verify(ctx)
		closeErr := backendInstance.Close()
		if verifyErr != nil {
			return fmt.Errorf("verify target %s: %w", target.Kind, verifyErr)
		}
		if closeErr != nil {
			return fmt.Errorf("close target %s backend: %w", target.Kind, closeErr)
		}
	}
	return nil
}

// newBackend 根据目标配置构造后端实例。
func (a *App) newBackend(target TargetConfig) (backend.Backend, error) {
	switch target.Kind {
	case TargetKindGit:
		if target.Git == nil {
			return nil, fmt.Errorf("target %s: git config is nil", target.Kind)
		}
		return gitbackend.New(gitbackend.Config{
			RepoPath:    target.Git.RepoPath,
			RepoURL:     target.Git.RepoURL,
			Branch:      target.Git.Branch,
			RemoteName:  target.Git.RemoteName,
			AuthorName:  fallbackString(target.Git.AuthorName, defaultAuthorName),
			AuthorEmail: fallbackString(target.Git.AuthorEmail, defaultAuthorEmail),
			Auth: gitbackend.AuthConfig{
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

// stopSchedulersLocked 停止所有调度器。
func (a *App) stopSchedulersLocked() {
	for targetID, task := range a.schedulers {
		task.Stop()
		delete(a.schedulers, targetID)
	}
}

// fallbackString 返回第一个非空字符串。
func fallbackString(value string, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
