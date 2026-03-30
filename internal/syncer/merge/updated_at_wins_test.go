package merge

import (
	"context"
	"strings"
	"testing"
	"time"
	"voidraft/internal/syncer/snapshot"
)

// TestUpdatedAtWinsMergerMerge verifies newer remote records still win.
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

// TestUpdatedAtWinsMergerDocumentConflict verifies document conflicts keep a copy.
func TestUpdatedAtWinsMergerDocumentConflict(t *testing.T) {
	updatedAt := time.Date(2026, 3, 29, 10, 0, 0, 0, time.UTC).Format(time.RFC3339)

	localRecord, err := snapshot.NewRecord("documents", "doc-1", map[string]interface{}{
		"uuid":       "doc-1",
		"created_at": updatedAt,
		"updated_at": updatedAt,
		"title":      "local",
	}, map[string][]byte{"content.md": []byte("local")})
	if err != nil {
		t.Fatalf("build local record: %v", err)
	}

	remoteRecord, err := snapshot.NewRecord("documents", "doc-1", map[string]interface{}{
		"uuid":       "doc-1",
		"created_at": updatedAt,
		"updated_at": updatedAt,
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

	if report.Conflicts != 1 {
		t.Fatalf("expected 1 conflict, got %d", report.Conflicts)
	}
	if len(report.ConflictIDs) != 1 || report.ConflictIDs[0] != "doc-1" {
		t.Fatalf("expected conflict id doc-1, got %v", report.ConflictIDs)
	}

	records := merged.Resources["documents"]
	if len(records) != 2 {
		t.Fatalf("expected 2 document records, got %d", len(records))
	}

	if records[0].ID != "doc-1" {
		t.Fatalf("expected original record to remain, got %s", records[0].ID)
	}
	if got := string(records[0].Blobs["content.md"]); got != "local" {
		t.Fatalf("expected local content to remain, got %s", got)
	}
	if records[1].ID == "doc-1" {
		t.Fatalf("expected conflict copy to have a new id")
	}
	if !strings.Contains(records[1].Values["title"].(string), "Conflict") {
		t.Fatalf("expected conflict title suffix, got %v", records[1].Values["title"])
	}
	if got := string(records[1].Blobs["content.md"]); got != "remote" {
		t.Fatalf("expected remote content in conflict copy, got %s", got)
	}
}

// TestUpdatedAtWinsMergerSettingsConflict verifies non-document conflicts merge by field.
func TestUpdatedAtWinsMergerSettingsConflict(t *testing.T) {
	updatedAt := time.Date(2026, 3, 29, 10, 0, 0, 0, time.UTC).Format(time.RFC3339)

	localRecord, err := snapshot.NewRecord("extensions", "ext-1", map[string]interface{}{
		"uuid":       "ext-1",
		"updated_at": updatedAt,
		"name":       "demo",
		"enabled":    true,
		"config": map[string]interface{}{
			"local_only": true,
			"shared":     "local",
			"nested": map[string]interface{}{
				"a": 1,
			},
		},
	}, nil)
	if err != nil {
		t.Fatalf("build local record: %v", err)
	}

	remoteRecord, err := snapshot.NewRecord("extensions", "ext-1", map[string]interface{}{
		"uuid":       "ext-1",
		"updated_at": updatedAt,
		"name":       "demo",
		"enabled":    false,
		"config": map[string]interface{}{
			"remote_only": true,
			"shared":      "remote",
			"nested": map[string]interface{}{
				"b": 2,
			},
		},
	}, nil)
	if err != nil {
		t.Fatalf("build remote record: %v", err)
	}

	localSnapshot := snapshot.New()
	localSnapshot.Resources["extensions"] = []snapshot.Record{localRecord}

	remoteSnapshot := snapshot.New()
	remoteSnapshot.Resources["extensions"] = []snapshot.Record{remoteRecord}

	merged, report, err := NewUpdatedAtWinsMerger().Merge(context.Background(), localSnapshot, remoteSnapshot)
	if err != nil {
		t.Fatalf("merge snapshot: %v", err)
	}

	if report.Conflicts != 1 {
		t.Fatalf("expected 1 conflict, got %d", report.Conflicts)
	}
	if len(report.ConflictIDs) != 1 || report.ConflictIDs[0] != "ext-1" {
		t.Fatalf("expected conflict id ext-1, got %v", report.ConflictIDs)
	}

	record := merged.Resources["extensions"][0]
	if got := record.Values["enabled"]; got != true {
		t.Fatalf("expected local scalar value to remain, got %v", got)
	}

	config := record.Values["config"].(map[string]interface{})
	if got := config["local_only"]; got != true {
		t.Fatalf("expected local_only to remain, got %v", got)
	}
	if got := config["remote_only"]; got != true {
		t.Fatalf("expected remote_only to be merged, got %v", got)
	}
	if got := config["shared"]; got != "local" {
		t.Fatalf("expected local shared value to remain, got %v", got)
	}

	nested := config["nested"].(map[string]interface{})
	if got := nested["a"]; got != 1 {
		t.Fatalf("expected nested a=1, got %v", got)
	}
	if got := nested["b"]; got != 2 {
		t.Fatalf("expected nested b=2, got %v", got)
	}
}

// TestUpdatedAtWinsMergerDeleteWinsOnEqualTimestamp verifies tombstones win ties.
func TestUpdatedAtWinsMergerDeleteWinsOnEqualTimestamp(t *testing.T) {
	eventAt := time.Date(2026, 3, 29, 10, 0, 0, 0, time.UTC).Format(time.RFC3339)

	localRecord, err := snapshot.NewRecord("themes", "theme-1", map[string]interface{}{
		"uuid":       "theme-1",
		"updated_at": eventAt,
		"name":       "demo",
	}, nil)
	if err != nil {
		t.Fatalf("build local record: %v", err)
	}

	remoteRecord, err := snapshot.NewRecord("themes", "theme-1", map[string]interface{}{
		"uuid":       "theme-1",
		"updated_at": eventAt,
		"deleted_at": eventAt,
		"name":       "demo",
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

	if report.Deleted != 1 {
		t.Fatalf("expected deleted report to be 1, got %d", report.Deleted)
	}
	if merged.Resources["themes"][0].DeletedAt == nil {
		t.Fatalf("expected delete tombstone to win")
	}
}
