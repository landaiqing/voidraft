package merge

import (
	"context"
	"sort"
	"voidraft/internal/syncer/snapshot"
)

// Report describes the outcome of one merge.
type Report struct {
	Added       int
	Updated     int
	Deleted     int
	Conflicts   int
	ConflictIDs []string
}

// Normalize sorts and deduplicates report fields for stable output.
func (r Report) Normalize() Report {
	if len(r.ConflictIDs) == 0 {
		return r
	}

	ids := append([]string(nil), r.ConflictIDs...)
	sort.Strings(ids)

	deduped := ids[:0]
	for _, id := range ids {
		if len(deduped) == 0 || deduped[len(deduped)-1] != id {
			deduped = append(deduped, id)
		}
	}
	r.ConflictIDs = deduped
	return r
}

// Merger describes a snapshot merge strategy.
type Merger interface {
	Merge(ctx context.Context, local *snapshot.Snapshot, remote *snapshot.Snapshot) (*snapshot.Snapshot, Report, error)
}
