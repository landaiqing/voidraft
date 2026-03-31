package resource

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"testing"
	"voidraft/internal/models/ent"
	"voidraft/internal/models/ent/enttest"
	"voidraft/internal/models/ent/mediaasset"
	schemamixin "voidraft/internal/models/schema/mixin"
	"voidraft/internal/syncer/snapshot"

	_ "github.com/mattn/go-sqlite3"
)

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

func TestMediaAssetAdapterExportSkipsMissingActiveFile(t *testing.T) {
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
	records, err := adapter.Export(context.Background())
	if err != nil {
		t.Fatalf("export records: %v", err)
	}
	if len(records) != 0 {
		t.Fatalf("expected missing file to be skipped, got %d records", len(records))
	}

	_, err = client.MediaAsset.Query().
		Where(mediaasset.AssetIDEQ(assetID)).
		Only(schemamixin.SkipSoftDelete(context.Background()))
	if !ent.IsNotFound(err) {
		t.Fatalf("expected missing-file media asset index row to be removed, err=%v", err)
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
