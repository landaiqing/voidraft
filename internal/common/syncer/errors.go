package syncer

import "errors"

var (
	// ErrSyncDisabled 表示同步未启用。
	ErrSyncDisabled = errors.New("sync is disabled")
	// ErrSyncNotConfigured 表示同步缺少必要配置。
	ErrSyncNotConfigured = errors.New("sync is not configured")
	// ErrUnsupportedTarget 表示同步目标未实现。
	ErrUnsupportedTarget = errors.New("sync target is not supported")
)
