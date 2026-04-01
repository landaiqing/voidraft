package snapshot

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestRecordDigestChangesWhenBlobFileChanges(t *testing.T) {
	root := t.TempDir()
	blobPath := filepath.Join(root, "content.md")

	writeBlob := func(data string, modTime time.Time) {
		t.Helper()
		if err := os.WriteFile(blobPath, []byte(data), 0644); err != nil {
			t.Fatalf("write blob file: %v", err)
		}
		if err := os.Chtimes(blobPath, modTime, modTime); err != nil {
			t.Fatalf("set blob mtime: %v", err)
		}
	}

	record, err := NewRecordWithBlobFiles("documents", "doc-1", map[string]interface{}{
		"uuid":       "doc-1",
		"updated_at": "2026-03-31T10:00:00Z",
	}, map[string]string{
		"content.md": blobPath,
	})
	if err != nil {
		t.Fatalf("build record: %v", err)
	}

	writeBlob("a", time.Date(2026, 3, 31, 10, 0, 1, 0, time.UTC))
	firstDigest, err := RecordDigest(record)
	if err != nil {
		t.Fatalf("digest first blob state: %v", err)
	}

	writeBlob("b", time.Date(2026, 3, 31, 10, 0, 3, 0, time.UTC))
	secondDigest, err := RecordDigest(record)
	if err != nil {
		t.Fatalf("digest second blob state: %v", err)
	}

	if firstDigest == secondDigest {
		t.Fatalf("expected digest to change after blob update, got %s", firstDigest)
	}
}
