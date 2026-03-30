package engine

import (
	"context"
	"errors"
	"fmt"
	"os"
	"voidraft/internal/syncer/backend"
	"voidraft/internal/syncer/merge"
	"voidraft/internal/syncer/snapshot"
)

const defaultMaxAttempts = 3

// Logger describes the minimal logger used by the sync engine.
type Logger interface {
	Debug(message string, args ...interface{})
	Info(message string, args ...interface{})
	Warning(message string, args ...interface{})
	Error(message string, args ...interface{})
}

// Options describes sync engine construction options.
type Options struct {
	Logger      Logger
	MaxAttempts int
}

// SyncOptions describes one sync execution request.
type SyncOptions struct {
	CommitMessage string
}

// Result describes one sync engine result.
type Result struct {
	LocalChanged   bool
	RemoteChanged  bool
	AppliedToLocal bool
	Published      bool
}

// SyncEngine runs the full local/remote sync flow.
type SyncEngine struct {
	backend     backend.Backend
	store       snapshot.Store
	snapshotter snapshot.Snapshotter
	merger      merge.Merger
	logger      Logger
	maxAttempts int
}

// NewSyncEngine creates a new sync engine.
func NewSyncEngine(
	backendInstance backend.Backend,
	store snapshot.Store,
	snapshotter snapshot.Snapshotter,
	merger merge.Merger,
	options Options,
) *SyncEngine {
	maxAttempts := options.MaxAttempts
	if maxAttempts <= 0 {
		maxAttempts = defaultMaxAttempts
	}

	return &SyncEngine{
		backend:     backendInstance,
		store:       store,
		snapshotter: snapshotter,
		merger:      merger,
		logger:      options.Logger,
		maxAttempts: maxAttempts,
	}
}

// Sync runs one sync and retries on revision conflicts.
func (e *SyncEngine) Sync(ctx context.Context, options SyncOptions) (*Result, error) {
	var lastErr error

	for attempt := 1; attempt <= e.maxAttempts; attempt++ {
		result, retry, err := e.syncOnce(ctx, options)
		if err == nil {
			return result, nil
		}
		if retry && errors.Is(err, backend.ErrRevisionConflict) {
			lastErr = err
			if e.logger != nil {
				e.logger.Warning("sync retry after revision conflict, attempt %d/%d", attempt, e.maxAttempts)
			}
			continue
		}
		return nil, err
	}

	if lastErr == nil {
		lastErr = backend.ErrRevisionConflict
	}
	return nil, lastErr
}

// syncOnce performs one sync attempt.
func (e *SyncEngine) syncOnce(ctx context.Context, options SyncOptions) (*Result, bool, error) {
	localSnapshot, err := e.snapshotter.Export(ctx)
	if err != nil {
		return nil, false, fmt.Errorf("export local snapshot: %w", err)
	}

	localDigest, err := snapshot.Digest(localSnapshot)
	if err != nil {
		return nil, false, fmt.Errorf("digest local snapshot: %w", err)
	}

	remoteDir, err := os.MkdirTemp("", "voidraft-sync-remote-*")
	if err != nil {
		return nil, false, err
	}
	defer os.RemoveAll(remoteDir)

	remoteState, err := e.backend.DownloadLatest(ctx, remoteDir)
	if err != nil {
		return nil, false, fmt.Errorf("download remote snapshot: %w", err)
	}

	remoteSnapshot := snapshot.New()
	if remoteState.Exists {
		remoteSnapshot, err = e.store.Read(ctx, remoteDir)
		if err != nil {
			return nil, false, fmt.Errorf("read remote snapshot: %w", err)
		}
	}

	remoteDigest, err := snapshot.Digest(remoteSnapshot)
	if err != nil {
		return nil, false, fmt.Errorf("digest remote snapshot: %w", err)
	}

	mergedSnapshot, _, err := e.merger.Merge(ctx, localSnapshot, remoteSnapshot)
	if err != nil {
		return nil, false, fmt.Errorf("merge snapshot: %w", err)
	}

	mergedDigest, err := snapshot.Digest(mergedSnapshot)
	if err != nil {
		return nil, false, fmt.Errorf("digest merged snapshot: %w", err)
	}

	appliedToLocal := localDigest != mergedDigest
	if appliedToLocal {
		if err := e.snapshotter.Apply(ctx, mergedSnapshot); err != nil {
			return nil, false, fmt.Errorf("apply merged snapshot: %w", err)
		}
	}

	stageDir, err := os.MkdirTemp("", "voidraft-sync-stage-*")
	if err != nil {
		return nil, false, err
	}
	defer os.RemoveAll(stageDir)

	if err := e.store.Write(ctx, stageDir, mergedSnapshot); err != nil {
		return nil, false, fmt.Errorf("write merged snapshot: %w", err)
	}

	publishedState, err := e.backend.Upload(ctx, stageDir, backend.PublishOptions{
		ExpectedRevision: remoteState.Revision,
		Message:          options.CommitMessage,
	})
	if err != nil {
		if errors.Is(err, backend.ErrRevisionConflict) {
			return nil, true, err
		}
		return nil, false, fmt.Errorf("upload merged snapshot: %w", err)
	}

	return &Result{
		LocalChanged:   appliedToLocal,
		RemoteChanged:  remoteDigest != mergedDigest,
		AppliedToLocal: appliedToLocal,
		Published:      remoteState != publishedState,
	}, false, nil
}
