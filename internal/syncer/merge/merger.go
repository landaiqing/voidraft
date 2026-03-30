package merge

import (
	"context"
	"voidraft/internal/syncer/snapshot"
)

// Report describes the outcome of one merge.
type Report struct {
	Added   int
	Updated int
	Deleted int
}

// Merger describes a snapshot merge strategy.
type Merger interface {
	Merge(ctx context.Context, local *snapshot.Snapshot, remote *snapshot.Snapshot) (*snapshot.Snapshot, Report, error)
}
