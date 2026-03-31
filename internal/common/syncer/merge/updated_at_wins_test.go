package merge

import (
	"context"
	"testing"
	"time"
	"voidraft/internal/common/syncer/snapshot"
)

// TestUpdatedAtWinsMergerMerge verifies newer remote records win.
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

	merged, report, err := NewUpdatedAtWinsMerger().Merge(context.Background(), localSnapshot, remoteSnapshot)
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

// TestUpdatedAtWinsMergerTieUsesRemote verifies equal event times use the remote record.
func TestUpdatedAtWinsMergerTieUsesRemote(t *testing.T) {
	eventAt := time.Date(2026, 3, 29, 10, 0, 0, 0, time.UTC).Format(time.RFC3339)

	localRecord, err := snapshot.NewRecord("documents", "doc-1", map[string]interface{}{
		"uuid":       "doc-1",
		"updated_at": eventAt,
		"title":      "local",
	}, map[string][]byte{"content.md": []byte("local")})
	if err != nil {
		t.Fatalf("build local record: %v", err)
	}

	remoteRecord, err := snapshot.NewRecord("documents", "doc-1", map[string]interface{}{
		"uuid":       "doc-1",
		"updated_at": eventAt,
		"title":      "remote",
	}, map[string][]byte{"content.md": []byte("remote")})
	if err != nil {
		t.Fatalf("build remote record: %v", err)
	}

	localSnapshot := snapshot.New()
	localSnapshot.Resources["documents"] = []snapshot.Record{localRecord}

	remoteSnapshot := snapshot.New()
	remoteSnapshot.Resources["documents"] = []snapshot.Record{remoteRecord}

	merged, report, err := NewUpdatedAtWinsMerger().Merge(context.Background(), localSnapshot, remoteSnapshot)
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
	if got := string(record.Blobs["content.md"]); got != "remote" {
		t.Fatalf("expected remote content, got %s", got)
	}
}

// TestUpdatedAtWinsMergerDeleteUsesLatestEvent verifies delete is treated as an event.
func TestUpdatedAtWinsMergerDeleteUsesLatestEvent(t *testing.T) {
	localRecord, err := snapshot.NewRecord("themes", "theme-1", map[string]interface{}{
		"uuid":       "theme-1",
		"updated_at": time.Date(2026, 3, 29, 10, 0, 0, 0, time.UTC).Format(time.RFC3339),
		"name":       "local",
	}, nil)
	if err != nil {
		t.Fatalf("build local record: %v", err)
	}

	remoteRecord, err := snapshot.NewRecord("themes", "theme-1", map[string]interface{}{
		"uuid":       "theme-1",
		"updated_at": time.Date(2026, 3, 29, 9, 0, 0, 0, time.UTC).Format(time.RFC3339),
		"deleted_at": time.Date(2026, 3, 29, 11, 0, 0, 0, time.UTC).Format(time.RFC3339),
		"name":       "remote",
	}, nil)
	if err != nil {
		t.Fatalf("build remote record: %v", err)
	}

	localSnapshot := snapshot.New()
	localSnapshot.Resources["themes"] = []snapshot.Record{localRecord}

	remoteSnapshot := snapshot.New()
	remoteSnapshot.Resources["themes"] = []snapshot.Record{remoteRecord}

	merged, report, err := NewUpdatedAtWinsMerger().Merge(context.Background(), localSnapshot, remoteSnapshot)
	if err != nil {
		t.Fatalf("merge snapshot: %v", err)
	}

	if report.Updated != 1 || report.Deleted != 1 {
		t.Fatalf("expected one delete update, got updated=%d deleted=%d", report.Updated, report.Deleted)
	}
	if merged.Resources["themes"][0].DeletedAt == nil {
		t.Fatalf("expected remote tombstone to win")
	}
}
