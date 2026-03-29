package snapshotstore

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"voidraft/internal/syncer/backend"
	localfsblob "voidraft/internal/syncer/backend/snapshotstore/blob/localfs"
)

// TestBackendUploadDownload 验证 snapshot_store 后端可以发布并回放快照包。
func TestBackendUploadDownload(t *testing.T) {
	store, err := localfsblob.New(t.TempDir())
	if err != nil {
		t.Fatalf("create blob store: %v", err)
	}

	backendInstance, err := New(Config{
		Store:     store,
		Namespace: "tests",
	})
	if err != nil {
		t.Fatalf("create backend: %v", err)
	}

	sourceDir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(sourceDir, "documents"), 0755); err != nil {
		t.Fatalf("mkdir source dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(sourceDir, "documents", "doc-1.json"), []byte("{\"title\":\"v1\"}\n"), 0644); err != nil {
		t.Fatalf("write source file: %v", err)
	}

	firstState, err := backendInstance.Upload(context.Background(), sourceDir, backend.PublishOptions{})
	if err != nil {
		t.Fatalf("upload snapshot: %v", err)
	}
	if !firstState.Exists || firstState.Revision == "" {
		t.Fatalf("expected remote state after first upload")
	}

	downloadDir := t.TempDir()
	downloadState, err := backendInstance.DownloadLatest(context.Background(), downloadDir)
	if err != nil {
		t.Fatalf("download latest snapshot: %v", err)
	}
	if downloadState.Revision != firstState.Revision {
		t.Fatalf("expected revision %s, got %s", firstState.Revision, downloadState.Revision)
	}

	data, err := os.ReadFile(filepath.Join(downloadDir, "documents", "doc-1.json"))
	if err != nil {
		t.Fatalf("read downloaded file: %v", err)
	}
	if string(data) != "{\"title\":\"v1\"}\n" {
		t.Fatalf("unexpected downloaded content: %s", string(data))
	}
}

// TestBackendRevisionConflict 验证 snapshot_store 后端会在版本过期时返回冲突。
func TestBackendRevisionConflict(t *testing.T) {
	store, err := localfsblob.New(t.TempDir())
	if err != nil {
		t.Fatalf("create blob store: %v", err)
	}

	backendInstance, err := New(Config{
		Store:     store,
		Namespace: "tests",
	})
	if err != nil {
		t.Fatalf("create backend: %v", err)
	}

	sourceDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(sourceDir, "state.json"), []byte("{\"value\":1}\n"), 0644); err != nil {
		t.Fatalf("write source file: %v", err)
	}

	firstState, err := backendInstance.Upload(context.Background(), sourceDir, backend.PublishOptions{})
	if err != nil {
		t.Fatalf("upload first snapshot: %v", err)
	}

	if err := os.WriteFile(filepath.Join(sourceDir, "state.json"), []byte("{\"value\":2}\n"), 0644); err != nil {
		t.Fatalf("rewrite source file: %v", err)
	}
	secondState, err := backendInstance.Upload(context.Background(), sourceDir, backend.PublishOptions{
		ExpectedRevision: firstState.Revision,
	})
	if err != nil {
		t.Fatalf("upload second snapshot: %v", err)
	}

	if err := os.WriteFile(filepath.Join(sourceDir, "state.json"), []byte("{\"value\":3}\n"), 0644); err != nil {
		t.Fatalf("rewrite source file again: %v", err)
	}
	_, err = backendInstance.Upload(context.Background(), sourceDir, backend.PublishOptions{
		ExpectedRevision: firstState.Revision,
	})
	if !errors.Is(err, backend.ErrRevisionConflict) {
		t.Fatalf("expected ErrRevisionConflict, got %v", err)
	}
	if secondState.Revision == firstState.Revision {
		t.Fatalf("expected revision to change after second upload")
	}
}
