package backend

import (
	"context"
	"errors"
)

var (
	// ErrRevisionConflict 表示远端版本已变化，需要重新拉取合并。
	ErrRevisionConflict = errors.New("sync revision conflict")
)

// RemoteState 描述远端最新状态。
type RemoteState struct {
	Revision string
	Exists   bool
}

// PublishOptions 描述一次发布操作的参数。
type PublishOptions struct {
	ExpectedRevision string
	Message          string
}

// Backend 描述统一同步后端接口。
type Backend interface {
	Verify(ctx context.Context) error
	DownloadLatest(ctx context.Context, dst string) (RemoteState, error)
	Upload(ctx context.Context, src string, options PublishOptions) (RemoteState, error)
	Close() error
}
