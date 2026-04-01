package resource

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"testing"
	"time"
	"voidraft/internal/common/syncer/snapshot"
	"voidraft/internal/models/ent"
	"voidraft/internal/models/ent/enttest"
	"voidraft/internal/models/ent/mediaasset"
	schemamixin "voidraft/internal/models/schema/mixin"

	_ "github.com/mattn/go-sqlite3"
)

func failMediaAssetMutations(client *ent.Client, op ent.Op, err error) {
	client.MediaAsset.Use(func(next ent.Mutator) ent.Mutator {
		return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
			if m.Op().Is(op) {
				return nil, err
			}
			return next.Mutate(ctx, m)
		})
	})
}

func TestMediaAssetAdapterExportAndApply(t *testing.T) {
	sourceClient := enttest.Open(t, "sqlite3", "file:mediaasset_export?mode=memory&_fk=1")
	defer sourceClient.Close()

	sourceRoot := filepath.Join(t.TempDir(), "media")
	const relativePath = "images/2026/03/31/example.png"
	sourceBytes := mustEncodePNG(t, 3, 2)
	assetID := sha256Hex(sourceBytes)
	writeBlob(t, sourceRoot, relativePath, sourceBytes)

	_, err := sourceClient.MediaAsset.Create().
		SetAssetID(assetID).
		SetOriginalFilename("example.png").
		SetRelativePath(relativePath).
		SetMimeType("image/png").
		SetSize(int64(len(sourceBytes))).
		SetWidth(3).
		SetHeight(2).
		SetCreatedAt("2026-03-31T10:00:00Z").
		SetUpdatedAt("2026-03-31T10:00:00Z").
		Save(context.Background())
	if err != nil {
		t.Fatalf("create source media asset: %v", err)
	}

	exportAdapter := NewMediaAssetAdapter(sourceClient, func() string { return sourceRoot })
	records, err := exportAdapter.Export(context.Background())
	if err != nil {
		t.Fatalf("export records: %v", err)
	}
	if len(records) != 1 {
		t.Fatalf("expected 1 exported record, got %d", len(records))
	}
	got, ok, err := records[0].BlobBytes(mediaAssetBlobName)
	if err != nil {
		t.Fatalf("read exported blob: %v", err)
	}
	if !ok || !bytes.Equal(got, sourceBytes) {
		t.Fatal("expected exported blob bytes to match original image")
	}

	targetClient := enttest.Open(t, "sqlite3", "file:mediaasset_apply?mode=memory&_fk=1")
	defer targetClient.Close()

	targetRoot := filepath.Join(t.TempDir(), "media")
	applyAdapter := NewMediaAssetAdapter(targetClient, func() string { return targetRoot })
	if err := applyAdapter.Apply(context.Background(), records); err != nil {
		t.Fatalf("apply records: %v", err)
	}

	saved, err := targetClient.MediaAsset.Query().
		Where(mediaasset.AssetIDEQ(assetID)).
		Only(context.Background())
	if err != nil {
		t.Fatalf("query applied media asset: %v", err)
	}
	if saved.RelativePath != relativePath {
		t.Fatalf("expected relative path %q, got %q", relativePath, saved.RelativePath)
	}

	targetBytes, err := os.ReadFile(filepath.Join(targetRoot, filepath.FromSlash(relativePath)))
	if err != nil {
		t.Fatalf("read applied blob: %v", err)
	}
	if !bytes.Equal(targetBytes, sourceBytes) {
		t.Fatal("expected applied blob bytes to match original image")
	}
}

func TestMediaAssetAdapterExportFailsWhenActiveFileMissing(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:mediaasset_missing?mode=memory&_fk=1")
	defer client.Close()

	root := filepath.Join(t.TempDir(), "media")
	sourceBytes := mustEncodePNG(t, 1, 1)
	assetID := sha256Hex(sourceBytes)

	_, err := client.MediaAsset.Create().
		SetAssetID(assetID).
		SetOriginalFilename("missing.png").
		SetRelativePath("images/2026/03/31/missing.png").
		SetMimeType("image/png").
		SetSize(int64(len(sourceBytes))).
		SetWidth(1).
		SetHeight(1).
		SetCreatedAt("2026-03-31T10:00:00Z").
		SetUpdatedAt("2026-03-31T10:00:00Z").
		Save(context.Background())
	if err != nil {
		t.Fatalf("create media asset: %v", err)
	}

	adapter := NewMediaAssetAdapter(client, func() string { return root })
	if _, err := adapter.Export(context.Background()); err == nil {
		t.Fatal("expected export to fail when active blob is missing")
	}

	_, err = client.MediaAsset.Query().
		Where(mediaasset.AssetIDEQ(assetID)).
		Only(schemamixin.SkipSoftDelete(context.Background()))
	if err != nil {
		t.Fatalf("expected missing-file media asset index row to remain, err=%v", err)
	}
}

func TestMediaAssetAdapterExportRestoresStagedBlob(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:mediaasset_staged_export?mode=memory&_fk=1")
	defer client.Close()

	root := filepath.Join(t.TempDir(), "media")
	const relativePath = "images/2026/03/31/staged.png"
	sourceBytes := mustEncodePNG(t, 2, 2)
	assetID := sha256Hex(sourceBytes)
	writeBlob(t, root, relativePath, sourceBytes)

	_, err := client.MediaAsset.Create().
		SetAssetID(assetID).
		SetOriginalFilename("staged.png").
		SetRelativePath(relativePath).
		SetMimeType("image/png").
		SetSize(int64(len(sourceBytes))).
		SetWidth(2).
		SetHeight(2).
		SetCreatedAt("2026-03-31T10:00:00Z").
		SetUpdatedAt("2026-03-31T10:00:00Z").
		Save(context.Background())
	if err != nil {
		t.Fatalf("create media asset: %v", err)
	}

	adapter := NewMediaAssetAdapter(client, func() string { return root })
	absPath := filepath.Join(root, filepath.FromSlash(relativePath))
	stagedPath, err := adapter.mediaHelper.StageFile(absPath, time.Date(2026, 3, 31, 12, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatalf("stage blob: %v", err)
	}
	if stagedPath == "" {
		t.Fatal("expected staged blob path")
	}

	records, err := adapter.Export(context.Background())
	if err != nil {
		t.Fatalf("export staged blob: %v", err)
	}
	if len(records) != 1 {
		t.Fatalf("expected 1 record after staged restore, got %d", len(records))
	}
	if _, err := os.Stat(absPath); err != nil {
		t.Fatalf("expected staged blob to be restored: %v", err)
	}
	if _, err := os.Stat(stagedPath); !os.IsNotExist(err) {
		t.Fatalf("expected staged blob to be consumed, stat err=%v", err)
	}
}

func TestMediaAssetAdapterApplyDeletesLocalFile(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:mediaasset_delete?mode=memory&_fk=1")
	defer client.Close()

	root := filepath.Join(t.TempDir(), "media")
	const relativePath = "images/2026/03/31/deleted.png"
	sourceBytes := mustEncodePNG(t, 2, 2)
	assetID := sha256Hex(sourceBytes)
	writeBlob(t, root, relativePath, sourceBytes)
	sidecarPath := filepath.Join(root, "images", "2026", "03", "31", "deleted.json")
	if err := os.WriteFile(sidecarPath, []byte(`{"keep":true}`), 0644); err != nil {
		t.Fatalf("write sidecar: %v", err)
	}

	_, err := client.MediaAsset.Create().
		SetAssetID(assetID).
		SetOriginalFilename("deleted.png").
		SetRelativePath(relativePath).
		SetMimeType("image/png").
		SetSize(int64(len(sourceBytes))).
		SetWidth(2).
		SetHeight(2).
		SetCreatedAt("2026-03-31T10:00:00Z").
		SetUpdatedAt("2026-03-31T10:00:00Z").
		Save(context.Background())
	if err != nil {
		t.Fatalf("create media asset: %v", err)
	}

	record, err := snapshot.NewRecord("media_assets", assetID, map[string]interface{}{
		mediaasset.FieldCreatedAt:        "2026-03-31T10:00:00Z",
		mediaasset.FieldUpdatedAt:        "2026-03-31T10:05:00Z",
		mediaasset.FieldDeletedAt:        "2026-03-31T10:06:00Z",
		mediaasset.FieldAssetID:          assetID,
		mediaasset.FieldOriginalFilename: "deleted.png",
		mediaasset.FieldRelativePath:     relativePath,
		mediaasset.FieldMimeType:         "image/png",
		mediaasset.FieldSize:             int64(len(sourceBytes)),
		mediaasset.FieldWidth:            2,
		mediaasset.FieldHeight:           2,
	}, nil)
	if err != nil {
		t.Fatalf("build delete record: %v", err)
	}

	adapter := NewMediaAssetAdapter(client, func() string { return root })
	if err := adapter.Apply(context.Background(), []snapshot.Record{record}); err != nil {
		t.Fatalf("apply delete record: %v", err)
	}

	reloaded, err := client.MediaAsset.Query().
		Where(mediaasset.AssetIDEQ(assetID)).
		Only(schemamixin.SkipSoftDelete(context.Background()))
	if err != nil {
		t.Fatalf("reload deleted media asset: %v", err)
	}
	if reloaded.DeletedAt == nil {
		t.Fatal("expected deleted_at to be set after applying delete record")
	}
	if _, err := os.Stat(filepath.Join(root, filepath.FromSlash(relativePath))); !os.IsNotExist(err) {
		t.Fatalf("expected blob to be removed, stat err=%v", err)
	}
	if _, err := os.Stat(sidecarPath); err != nil {
		t.Fatalf("expected sidecar to remain untouched, stat err=%v", err)
	}
}

func TestMediaAssetAdapterApplyRejectsUnsafeRelativePath(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:mediaasset_unsafe_path?mode=memory&_fk=1")
	defer client.Close()

	root := filepath.Join(t.TempDir(), "media")
	sourceBytes := mustEncodePNG(t, 2, 2)
	assetID := sha256Hex(sourceBytes)
	record, err := snapshot.NewRecord("media_assets", assetID, map[string]interface{}{
		mediaasset.FieldCreatedAt:        "2026-03-31T10:00:00Z",
		mediaasset.FieldUpdatedAt:        "2026-03-31T10:05:00Z",
		mediaasset.FieldDeletedAt:        "",
		mediaasset.FieldAssetID:          assetID,
		mediaasset.FieldOriginalFilename: "escape.png",
		mediaasset.FieldRelativePath:     "images/../../escape.png",
		mediaasset.FieldMimeType:         "image/png",
		mediaasset.FieldSize:             int64(len(sourceBytes)),
		mediaasset.FieldWidth:            2,
		mediaasset.FieldHeight:           2,
	}, map[string][]byte{
		mediaAssetBlobName: sourceBytes,
	})
	if err != nil {
		t.Fatalf("build unsafe record: %v", err)
	}

	adapter := NewMediaAssetAdapter(client, func() string { return root })
	if err := adapter.Apply(context.Background(), []snapshot.Record{record}); err == nil {
		t.Fatal("expected apply to reject unsafe relative path")
	}
	if _, err := os.Stat(filepath.Join(filepath.Dir(root), "escape.png")); !os.IsNotExist(err) {
		t.Fatalf("expected no file to be written outside media root, stat err=%v", err)
	}
}

func TestMediaAssetAdapterApplyRejectsBlobDigestMismatch(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:mediaasset_digest_mismatch?mode=memory&_fk=1")
	defer client.Close()

	root := filepath.Join(t.TempDir(), "media")
	sourceBytes := mustEncodePNG(t, 2, 2)
	record, err := snapshot.NewRecord("media_assets", "deadbeef", map[string]interface{}{
		mediaasset.FieldCreatedAt:        "2026-03-31T10:00:00Z",
		mediaasset.FieldUpdatedAt:        "2026-03-31T10:05:00Z",
		mediaasset.FieldDeletedAt:        "",
		mediaasset.FieldAssetID:          "deadbeef",
		mediaasset.FieldOriginalFilename: "mismatch.png",
		mediaasset.FieldRelativePath:     "images/2026/03/31/mismatch.png",
		mediaasset.FieldMimeType:         "image/png",
		mediaasset.FieldSize:             int64(len(sourceBytes)),
		mediaasset.FieldWidth:            2,
		mediaasset.FieldHeight:           2,
	}, map[string][]byte{
		mediaAssetBlobName: sourceBytes,
	})
	if err != nil {
		t.Fatalf("build mismatch record: %v", err)
	}

	adapter := NewMediaAssetAdapter(client, func() string { return root })
	if err := adapter.Apply(context.Background(), []snapshot.Record{record}); err == nil {
		t.Fatal("expected apply to reject blob digest mismatch")
	}
	if _, err := client.MediaAsset.Query().Where(mediaasset.RelativePathEQ("images/2026/03/31/mismatch.png")).Only(schemamixin.SkipSoftDelete(context.Background())); !ent.IsNotFound(err) {
		t.Fatalf("expected no index row to be created, err=%v", err)
	}
}

func TestMediaAssetAdapterApplyCreateRollsBackFileWhenInsertFails(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:mediaasset_create_rollback?mode=memory&_fk=1")
	defer client.Close()

	root := filepath.Join(t.TempDir(), "media")
	sourceBytes := mustEncodePNG(t, 2, 2)
	assetID := sha256Hex(sourceBytes)
	record, err := snapshot.NewRecord("media_assets", assetID, map[string]interface{}{
		mediaasset.FieldCreatedAt:        "2026-03-31T10:00:00Z",
		mediaasset.FieldUpdatedAt:        "2026-03-31T10:05:00Z",
		mediaasset.FieldDeletedAt:        "",
		mediaasset.FieldAssetID:          assetID,
		mediaasset.FieldOriginalFilename: "create-rollback.png",
		mediaasset.FieldRelativePath:     "images/2026/03/31/create-rollback.png",
		mediaasset.FieldMimeType:         "image/png",
		mediaasset.FieldSize:             int64(len(sourceBytes)),
		mediaasset.FieldWidth:            2,
		mediaasset.FieldHeight:           2,
	}, map[string][]byte{
		mediaAssetBlobName: sourceBytes,
	})
	if err != nil {
		t.Fatalf("build create record: %v", err)
	}

	failMediaAssetMutations(client, ent.OpCreate, fmt.Errorf("forced create failure"))

	adapter := NewMediaAssetAdapter(client, func() string { return root })
	if err := adapter.Apply(context.Background(), []snapshot.Record{record}); err == nil {
		t.Fatal("expected create apply to fail")
	}

	absPath := filepath.Join(root, "images", "2026", "03", "31", "create-rollback.png")
	if _, err := os.Stat(absPath); !os.IsNotExist(err) {
		t.Fatalf("expected created blob to be rolled back, stat err=%v", err)
	}
	_, err = client.MediaAsset.Query().
		Where(mediaasset.AssetIDEQ(assetID)).
		Only(schemamixin.SkipSoftDelete(context.Background()))
	if !ent.IsNotFound(err) {
		t.Fatalf("expected index row creation to be rolled back, err=%v", err)
	}
}

func TestMediaAssetAdapterApplyUpdateRollsBackStagedPathWhenUpdateFails(t *testing.T) {
	client := enttest.Open(t, "sqlite3", "file:mediaasset_update_rollback?mode=memory&_fk=1")
	defer client.Close()

	root := filepath.Join(t.TempDir(), "media")
	sourceBytes := mustEncodePNG(t, 2, 2)
	assetID := sha256Hex(sourceBytes)
	const oldRelativePath = "images/2026/03/31/original.png"
	const nextRelativePath = "images/2026/03/31/updated.png"
	writeBlob(t, root, oldRelativePath, sourceBytes)

	_, err := client.MediaAsset.Create().
		SetAssetID(assetID).
		SetOriginalFilename("original.png").
		SetRelativePath(oldRelativePath).
		SetMimeType("image/png").
		SetSize(int64(len(sourceBytes))).
		SetWidth(2).
		SetHeight(2).
		SetCreatedAt("2026-03-31T10:00:00Z").
		SetUpdatedAt("2026-03-31T10:00:00Z").
		Save(context.Background())
	if err != nil {
		t.Fatalf("create original media asset: %v", err)
	}

	record, err := snapshot.NewRecord("media_assets", assetID, map[string]interface{}{
		mediaasset.FieldCreatedAt:        "2026-03-31T10:00:00Z",
		mediaasset.FieldUpdatedAt:        "2026-03-31T10:05:00Z",
		mediaasset.FieldDeletedAt:        "",
		mediaasset.FieldAssetID:          assetID,
		mediaasset.FieldOriginalFilename: "updated.png",
		mediaasset.FieldRelativePath:     nextRelativePath,
		mediaasset.FieldMimeType:         "image/png",
		mediaasset.FieldSize:             int64(len(sourceBytes)),
		mediaasset.FieldWidth:            2,
		mediaasset.FieldHeight:           2,
	}, map[string][]byte{
		mediaAssetBlobName: sourceBytes,
	})
	if err != nil {
		t.Fatalf("build update record: %v", err)
	}

	failMediaAssetMutations(client, ent.OpUpdate|ent.OpUpdateOne, fmt.Errorf("forced update failure"))

	adapter := NewMediaAssetAdapter(client, func() string { return root })
	if err := adapter.Apply(context.Background(), []snapshot.Record{record}); err == nil {
		t.Fatal("expected update apply to fail")
	}

	oldPath := filepath.Join(root, filepath.FromSlash(oldRelativePath))
	oldBytes, err := os.ReadFile(oldPath)
	if err != nil {
		t.Fatalf("expected original blob to remain: %v", err)
	}
	if !bytes.Equal(oldBytes, sourceBytes) {
		t.Fatal("expected original blob bytes to remain unchanged")
	}

	nextPath := filepath.Join(root, filepath.FromSlash(nextRelativePath))
	if _, err := os.Stat(nextPath); !os.IsNotExist(err) {
		t.Fatalf("expected staged target blob to be rolled back, stat err=%v", err)
	}

	reloaded, err := client.MediaAsset.Query().
		Where(mediaasset.AssetIDEQ(assetID)).
		Only(schemamixin.SkipSoftDelete(context.Background()))
	if err != nil {
		t.Fatalf("reload asset after failed update: %v", err)
	}
	if reloaded.RelativePath != oldRelativePath {
		t.Fatalf("expected relative path to remain %q, got %q", oldRelativePath, reloaded.RelativePath)
	}
}

func mustEncodePNG(t *testing.T, width int, height int) []byte {
	t.Helper()

	img := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			img.Set(x, y, color.RGBA{R: 90, G: 140, B: 220, A: 255})
		}
	}

	var buffer bytes.Buffer
	if err := png.Encode(&buffer, img); err != nil {
		t.Fatalf("encode png: %v", err)
	}
	return buffer.Bytes()
}

func sha256Hex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func writeBlob(t *testing.T, root string, relativePath string, data []byte) {
	t.Helper()

	absPath := filepath.Join(root, filepath.FromSlash(relativePath))
	if err := os.MkdirAll(filepath.Dir(absPath), 0755); err != nil {
		t.Fatalf("mkdir blob dir: %v", err)
	}
	if err := os.WriteFile(absPath, data, 0644); err != nil {
		t.Fatalf("write blob: %v", err)
	}
}
