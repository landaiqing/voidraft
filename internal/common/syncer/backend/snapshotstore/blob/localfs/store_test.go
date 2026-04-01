package localfs

import (
	"bytes"
	"context"
	"errors"
	"io"
	"testing"
	"voidraft/internal/common/syncer/backend/snapshotstore/blob"
)

// TestStorePutGetStat 验证 localfs blob 存储的基本读写流程。
func TestStorePutGetStat(t *testing.T) {
	store, err := New(t.TempDir())
	if err != nil {
		t.Fatalf("create store: %v", err)
	}

	info, err := store.Put(context.Background(), "nested/file.txt", bytes.NewReader([]byte("hello")), blob.PutOptions{})
	if err != nil {
		t.Fatalf("put object: %v", err)
	}
	if info.Revision == "" {
		t.Fatalf("expected revision to be generated")
	}

	stat, err := store.Stat(context.Background(), "nested/file.txt")
	if err != nil {
		t.Fatalf("stat object: %v", err)
	}
	if stat.Revision != info.Revision {
		t.Fatalf("expected stat revision %s, got %s", info.Revision, stat.Revision)
	}

	reader, _, err := store.Get(context.Background(), "nested/file.txt")
	if err != nil {
		t.Fatalf("get object: %v", err)
	}
	defer reader.Close()

	data, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("read object: %v", err)
	}
	if string(data) != "hello" {
		t.Fatalf("expected object content hello, got %s", string(data))
	}
}

// TestStorePutIfMatch 验证 localfs blob 存储的条件写入。
func TestStorePutIfMatch(t *testing.T) {
	store, err := New(t.TempDir())
	if err != nil {
		t.Fatalf("create store: %v", err)
	}

	info, err := store.Put(context.Background(), "file.txt", bytes.NewReader([]byte("v1")), blob.PutOptions{})
	if err != nil {
		t.Fatalf("put initial object: %v", err)
	}

	if _, err := store.Put(context.Background(), "file.txt", bytes.NewReader([]byte("v2")), blob.PutOptions{IfMatch: "stale"}); !errors.Is(err, blob.ErrConditionNotMet) {
		t.Fatalf("expected ErrConditionNotMet, got %v", err)
	}

	nextInfo, err := store.Put(context.Background(), "file.txt", bytes.NewReader([]byte("v2")), blob.PutOptions{IfMatch: info.Revision})
	if err != nil {
		t.Fatalf("put with correct if-match: %v", err)
	}
	if nextInfo.Revision == info.Revision {
		t.Fatalf("expected revision to change after overwrite")
	}
}
