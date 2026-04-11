package engine

import (
	"context"
	"errors"
	"fmt"
	"os"
	"voidraft/internal/common/syncer/backend"
	"voidraft/internal/common/syncer/merge"
	"voidraft/internal/common/syncer/snapshot"

	"github.com/wailsapp/wails/v3/pkg/services/log"
)

const defaultMaxAttempts = 3

// Options describes sync engine construction options.
type Options struct {
	Logger      *log.LogService
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
	AttemptCount   int
	MaxAttempts    int
	MergeReport    merge.Report
}

// Stage describes the failing step of one sync run.
type Stage string

const (
	StageExportLocal     Stage = "export_local"
	StageDigestLocal     Stage = "digest_local"
	StagePrepareRemote   Stage = "prepare_remote_dir"
	StageDownloadRemote  Stage = "download_remote"
	StageReadRemote      Stage = "read_remote"
	StageDigestRemote    Stage = "digest_remote"
	StageMergeSnapshot   Stage = "merge_snapshot"
	StageDigestMerged    Stage = "digest_merged"
	StageApplyLocal      Stage = "apply_local"
	StagePrepareStageDir Stage = "prepare_stage_dir"
	StageWriteStage      Stage = "write_stage"
	StageUploadRemote    Stage = "upload_remote"
)

// SyncError describes one sync execution failure.
type SyncError struct {
	Stage     Stage
	Attempt   int
	Retryable bool
	Err       error
}

// Error implements error.
func (e *SyncError) Error() string {
	return fmt.Sprintf("%s: %v", e.Stage, e.Err)
}

// Unwrap returns the wrapped error.
func (e *SyncError) Unwrap() error {
	return e.Err
}

// SyncEngine runs the full local/remote sync flow.
type SyncEngine struct {
	backend     backend.Backend
	store       snapshot.Store
	snapshotter snapshot.Snapshotter
	merger      merge.Merger
	logger      *log.LogService
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
		result, retry, err := e.syncOnce(ctx, options, attempt)
		if err == nil {
			result.AttemptCount = attempt
			result.MaxAttempts = e.maxAttempts
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
		lastErr = &SyncError{
			Stage:     StageUploadRemote,
			Attempt:   e.maxAttempts,
			Retryable: true,
			Err:       backend.ErrRevisionConflict,
		}
	}
	return nil, lastErr
}

// syncOnce performs one sync attempt.
func (e *SyncEngine) syncOnce(ctx context.Context, options SyncOptions, attempt int) (*Result, bool, error) {
	localSnapshot, err := e.snapshotter.Export(ctx)
	if err != nil {
		return nil, false, newSyncError(StageExportLocal, attempt, false, fmt.Errorf("export local snapshot: %w", err))
	}

	localDigest, err := snapshot.Digest(localSnapshot)
	if err != nil {
		return nil, false, newSyncError(StageDigestLocal, attempt, false, fmt.Errorf("digest local snapshot: %w", err))
	}

	remoteDir, err := os.MkdirTemp("", "voidraft-sync-remote-*")
	if err != nil {
		return nil, false, newSyncError(StagePrepareRemote, attempt, false, err)
	}
	defer os.RemoveAll(remoteDir)

	remoteState, err := e.backend.DownloadLatest(ctx, remoteDir)
	if err != nil {
		return nil, false, newSyncError(StageDownloadRemote, attempt, false, fmt.Errorf("download remote snapshot: %w", err))
	}

	remoteSnapshot := snapshot.New()
	if remoteState.Exists {
		remoteSnapshot, err = e.store.Read(ctx, remoteDir)
		if err != nil {
			return nil, false, newSyncError(StageReadRemote, attempt, false, fmt.Errorf("read remote snapshot: %w", err))
		}
	}

	remoteDigest, err := snapshot.Digest(remoteSnapshot)
	if err != nil {
		return nil, false, newSyncError(StageDigestRemote, attempt, false, fmt.Errorf("digest remote snapshot: %w", err))
	}

	mergedSnapshot, report, err := e.merger.Merge(ctx, localSnapshot, remoteSnapshot)
	if err != nil {
		return nil, false, newSyncError(StageMergeSnapshot, attempt, false, fmt.Errorf("merge snapshot: %w", err))
	}

	mergedDigest, err := snapshot.Digest(mergedSnapshot)
	if err != nil {
		return nil, false, newSyncError(StageDigestMerged, attempt, false, fmt.Errorf("digest merged snapshot: %w", err))
	}

	appliedToLocal := localDigest != mergedDigest
	if appliedToLocal {
		if err := e.snapshotter.Apply(ctx, mergedSnapshot); err != nil {
			return nil, false, newSyncError(StageApplyLocal, attempt, false, fmt.Errorf("apply merged snapshot: %w", err))
		}
	}

	stageDir, err := os.MkdirTemp("", "voidraft-sync-stage-*")
	if err != nil {
		return nil, false, newSyncError(StagePrepareStageDir, attempt, false, err)
	}
	defer os.RemoveAll(stageDir)

	if err := e.store.Write(ctx, stageDir, mergedSnapshot); err != nil {
		return nil, false, newSyncError(StageWriteStage, attempt, false, fmt.Errorf("write merged snapshot: %w", err))
	}

	publishedState, err := e.backend.Upload(ctx, stageDir, backend.PublishOptions{
		ExpectedRevision: remoteState.Revision,
		Message:          options.CommitMessage,
	})
	if err != nil {
		if errors.Is(err, backend.ErrRevisionConflict) {
			return nil, true, newSyncError(StageUploadRemote, attempt, true, fmt.Errorf("upload merged snapshot: %w", err))
		}
		return nil, false, newSyncError(StageUploadRemote, attempt, false, fmt.Errorf("upload merged snapshot: %w", err))
	}

	return &Result{
		LocalChanged:   appliedToLocal,
		RemoteChanged:  remoteDigest != mergedDigest,
		AppliedToLocal: appliedToLocal,
		Published:      remoteState != publishedState,
		MergeReport:    report,
	}, false, nil
}

func newSyncError(stage Stage, attempt int, retryable bool, err error) *SyncError {
	return &SyncError{
		Stage:     stage,
		Attempt:   attempt,
		Retryable: retryable,
		Err:       err,
	}
}
