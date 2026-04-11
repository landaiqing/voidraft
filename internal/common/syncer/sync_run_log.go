package syncer

import (
	"context"
	"errors"
	"net/url"
	"path/filepath"
	"strings"
	"time"
	"voidraft/internal/common/syncer/engine"
	"voidraft/internal/models"
	"voidraft/internal/models/ent/syncrunlog"
)

func (a *App) recordSyncRun(
	cfg models.SyncConfig,
	dataPath string,
	trigger models.SyncRunTriggerType,
	startedAt time.Time,
	finishedAt time.Time,
	result *engine.Result,
	runErr error,
	stage string,
	retryable bool,
) {
	if a.client == nil {
		return
	}

	details := a.buildSyncRunDetails(cfg, dataPath, result, runErr, stage, retryable)
	status := models.SyncRunStatusSuccess
	if runErr != nil {
		status = models.SyncRunStatusFailed
	}

	if err := a.client.SyncRunLog.Create().
		SetTargetType(syncRunLogTargetType(cfg.Target)).
		SetTargetPath(a.syncTargetPath(cfg)).
		SetBranch(a.syncBranch(cfg)).
		SetTriggerType(syncRunLogTriggerType(trigger)).
		SetStatus(syncRunLogStatus(status)).
		SetStartedAt(startedAt.Format(time.RFC3339)).
		SetFinishedAt(finishedAt.Format(time.RFC3339)).
		SetDetails(details).
		Exec(context.Background()); err != nil && a.logger != nil {
		a.logger.Error("record sync run failed: %v", err)
	}
}

func (a *App) buildSyncRunDetails(
	cfg models.SyncConfig,
	dataPath string,
	result *engine.Result,
	runErr error,
	stage string,
	retryable bool,
) models.SyncRunDetails {
	details := models.SyncRunDetails{
		Attempt:     0,
		MaxAttempts: a.maxSyncAttempts,
		Paths: models.SyncRunPaths{
			DataPath: strings.TrimSpace(dataPath),
		},
	}

	if cfg.Target == models.SyncTargetGit && strings.TrimSpace(dataPath) != "" {
		details.Paths.RepoPath = filepath.Join(dataPath, defaultSyncRepoDir)
	}

	if result != nil {
		details.Attempt = result.AttemptCount
		details.MaxAttempts = result.MaxAttempts
		details.Changes = models.SyncRunChanges{
			Added:   result.MergeReport.Added,
			Updated: result.MergeReport.Updated,
			Deleted: result.MergeReport.Deleted,
		}
		details.Flow = models.SyncRunFlow{
			Pulled: result.AppliedToLocal,
			Pushed: result.Published,
		}
	}

	if runErr == nil {
		return details
	}

	var syncErr *engine.SyncError
	if errors.As(runErr, &syncErr) {
		stage = string(syncErr.Stage)
		retryable = syncErr.Retryable
		details.Attempt = syncErr.Attempt
		if syncErr.Err != nil {
			runErr = syncErr.Err
		}
	}

	if details.Attempt == 0 {
		details.Attempt = 1
	}

	details.Error = &models.SyncRunErrorDetail{
		Stage:     stage,
		Message:   runErr.Error(),
		Retryable: retryable,
	}

	return details
}

func (a *App) syncTargetPath(cfg models.SyncConfig) string {
	switch cfg.Target {
	case models.SyncTargetGit:
		return redactRepoURL(cfg.Git.RepoURL)
	case models.SyncTargetLocalFS:
		return strings.TrimSpace(cfg.LocalFS.RootPath)
	default:
		return ""
	}
}

func (a *App) syncBranch(cfg models.SyncConfig) string {
	if cfg.Target != models.SyncTargetGit {
		return ""
	}
	return strings.TrimSpace(cfg.Git.Branch)
}

func (a *App) logSyncSuccess(cfg models.SyncConfig, trigger models.SyncRunTriggerType, result *engine.Result) {
	if a.logger == nil || result == nil {
		return
	}

	a.logger.Info(
		"sync finished trigger=%s target=%s branch=%s pulled=%t pushed=%t added=%d updated=%d deleted=%d attempt=%d/%d",
		trigger,
		cfg.Target,
		a.syncBranch(cfg),
		result.AppliedToLocal,
		result.Published,
		result.MergeReport.Added,
		result.MergeReport.Updated,
		result.MergeReport.Deleted,
		result.AttemptCount,
		result.MaxAttempts,
	)
}

func (a *App) logSyncFailure(cfg models.SyncConfig, trigger models.SyncRunTriggerType, runErr error) {
	if a.logger == nil {
		return
	}

	stage := ""
	attempt := 0
	retryable := false

	var syncErr *engine.SyncError
	if errors.As(runErr, &syncErr) {
		stage = string(syncErr.Stage)
		attempt = syncErr.Attempt
		retryable = syncErr.Retryable
	}

	a.logger.Error(
		"sync failed trigger=%s target=%s branch=%s stage=%s attempt=%d retryable=%t: %v",
		trigger,
		cfg.Target,
		a.syncBranch(cfg),
		stage,
		attempt,
		retryable,
		runErr,
	)
}

func redactRepoURL(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}

	parsed, err := url.Parse(trimmed)
	if err == nil && parsed.User != nil {
		parsed.User = nil
		return parsed.String()
	}

	return trimmed
}

func syncRunLogTargetType(target models.SyncTarget) syncrunlog.TargetType {
	if target == models.SyncTargetLocalFS {
		return syncrunlog.TargetTypeLocalfs
	}
	return syncrunlog.TargetTypeGit
}

func syncRunLogTriggerType(trigger models.SyncRunTriggerType) syncrunlog.TriggerType {
	if trigger == models.SyncRunTriggerAuto {
		return syncrunlog.TriggerTypeAuto
	}
	return syncrunlog.TriggerTypeManual
}

func syncRunLogStatus(status models.SyncRunStatus) syncrunlog.Status {
	if status == models.SyncRunStatusFailed {
		return syncrunlog.StatusFailed
	}
	return syncrunlog.StatusSuccess
}
