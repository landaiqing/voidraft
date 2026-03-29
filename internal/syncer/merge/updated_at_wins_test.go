package merge

import (
	"context"
	"testing"
	"time"
	"voidraft/internal/syncer/snapshot"
)

// TestUpdatedAtWinsMergerMerge 验证较新的记录会覆盖较旧记录。
func TestUpdatedAtWinsMergerMerge(t *testing.T) {
	localRecord, err := snapshot.NewRecord("documents", "doc-1", map[string]interface{}{
		"uuid":       "doc-1",
		"updated_at": time.Date(2026, 3, 29, 9, 0, 0, 0, time.UTC).Format(time.RFC3339),
		"title":      "local",
	}, nil)
	if err != nil {
		t.Fatalf("build local record: %v", err)
	}

	remoteRecord, err := snapshot.NewRecord("documents", "doc-1", map[string]interface{}{
		"uuid":       "doc-1",
		"updated_at": time.Date(2026, 3, 29, 10, 0, 0, 0, time.UTC).Format(time.RFC3339),
		"title":      "remote",
	}, nil)
	if err != nil {
		t.Fatalf("build remote record: %v", err)
	}

	localSnapshot := snapshot.New()
	localSnapshot.Resources["documents"] = []snapshot.Record{localRecord}

	remoteSnapshot := snapshot.New()
	remoteSnapshot.Resources["documents"] = []snapshot.Record{remoteRecord}

	merger := NewUpdatedAtWinsMerger()
	merged, report, err := merger.Merge(context.Background(), localSnapshot, remoteSnapshot)
	if err != nil {
		t.Fatalf("merge snapshot: %v", err)
	}

	if report.Updated != 1 {
		t.Fatalf("expected updated report to be 1, got %d", report.Updated)
	}

	record := merged.Resources["documents"][0]
	if got := record.Values["title"]; got != "remote" {
		t.Fatalf("expected remote title, got %v", got)
	}
}
