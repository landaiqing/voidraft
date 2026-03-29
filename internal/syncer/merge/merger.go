package merge

import (
	"context"
	"voidraft/internal/syncer/snapshot"
)

// Report 描述一次合并中的统计信息。
type Report struct {
	Added     int
	Updated   int
	Deleted   int
	Conflicts int
}

// Merger 描述快照合并策略。
type Merger interface {
	Merge(ctx context.Context, local *snapshot.Snapshot, remote *snapshot.Snapshot) (*snapshot.Snapshot, Report, error)
}
