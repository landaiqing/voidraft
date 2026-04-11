package snapshot

import (
	"context"
	"testing"
	"time"
)

// TestFileStoreReadWrite 验证目录树快照可以稳定往返。
func TestFileStoreReadWrite(t *testing.T) {
	root := t.TempDir()

	documentRecord, err := NewRecord("documents", "doc-1", map[string]interface{}{
		"uuid":       "doc-1",
		"updated_at": time.Date(2026, 3, 29, 10, 0, 0, 0, time.UTC).Format(time.RFC3339),
		"title":      "hello",
	}, map[string][]byte{
		"content.md": []byte("world"),
	})
	if err != nil {
		t.Fatalf("build document record: %v", err)
	}

	themeRecord, err := NewRecord("themes", "theme-1", map[string]interface{}{
		"uuid":       "theme-1",
		"updated_at": time.Date(2026, 3, 29, 10, 1, 0, 0, time.UTC).Format(time.RFC3339),
		"name":       "dark",
	}, nil)
	if err != nil {
		t.Fatalf("build theme record: %v", err)
	}

	snap := New()
	snap.Resources["documents"] = []Record{documentRecord}
	snap.Resources["themes"] = []Record{themeRecord}

	store := NewFileStore()
	if err := store.Write(context.Background(), root, snap); err != nil {
		t.Fatalf("write snapshot: %v", err)
	}

	loaded, err := store.Read(context.Background(), root)
	if err != nil {
		t.Fatalf("read snapshot: %v", err)
	}

	originalDigest, err := Digest(snap)
	if err != nil {
		t.Fatalf("digest original snapshot: %v", err)
	}
	loadedDigest, err := Digest(loaded)
	if err != nil {
		t.Fatalf("digest loaded snapshot: %v", err)
	}

	if originalDigest != loadedDigest {
		t.Fatalf("expected digests to match, got %s != %s", originalDigest, loadedDigest)
	}
}
