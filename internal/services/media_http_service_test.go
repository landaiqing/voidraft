package services

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
	"voidraft/internal/models/ent"
	"voidraft/internal/models/ent/enttest"
	"voidraft/internal/models/ent/mediaasset"

	_ "github.com/mattn/go-sqlite3"
)

func newIndexedMediaHTTPService(t *testing.T) (*MediaHTTPService, string) {
	t.Helper()

	dsnName := strings.NewReplacer("/", "_", "\\", "_", " ", "_").Replace(t.Name())
	client := enttest.Open(t, "sqlite3", fmt.Sprintf("file:%s?mode=memory&cache=shared&_fk=1", dsnName))
	t.Cleanup(func() {
		_ = client.Close()
	})

	dbService := &DatabaseService{Client: client}
	syncService := NewMediaSyncService(nil, nil, dbService)
	service := NewMediaHTTPService(nil, nil, dbService, syncService)
	rootPath := filepath.Join(t.TempDir(), "media")
	if err := service.configureRootPath(rootPath); err != nil {
		t.Fatalf("configure root path: %v", err)
	}
	return service, rootPath
}

func failMediaAssetDeletes(client *ent.Client, err error) {
	client.MediaAsset.Use(func(next ent.Mutator) ent.Mutator {
		return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
			if m.Op().Is(ent.OpDelete | ent.OpDeleteOne) {
				return nil, err
			}
			return next.Mutate(ctx, m)
		})
	})
}

func TestMediaHTTPServiceConfigureRootPathCreatesDirectories(t *testing.T) {
	service := NewMediaHTTPService(nil, nil, nil, NewMediaSyncService(nil, nil, nil))
	rootPath := filepath.Join(t.TempDir(), "data", "media")

	if err := service.configureRootPath(rootPath); err != nil {
		t.Fatalf("configure root path: %v", err)
	}

	for _, dir := range []string{
		rootPath,
		filepath.Join(rootPath, mediaImagesDirName),
	} {
		info, err := os.Stat(dir)
		if err != nil {
			t.Fatalf("stat %s: %v", dir, err)
		}
		if !info.IsDir() {
			t.Fatalf("expected %s to be a directory", dir)
		}
	}
}

func TestMediaHTTPServiceServeHTTPServesExistingFile(t *testing.T) {
	service := NewMediaHTTPService(nil, nil, nil, NewMediaSyncService(nil, nil, nil))
	rootPath := filepath.Join(t.TempDir(), "media")
	if err := service.configureRootPath(rootPath); err != nil {
		t.Fatalf("configure root path: %v", err)
	}

	targetPath := filepath.Join(rootPath, "images", "sample.png")
	const expectedBody = "png-bytes"
	if err := os.WriteFile(targetPath, []byte(expectedBody), 0644); err != nil {
		t.Fatalf("write media file: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/images/sample.png", nil)
	rec := httptest.NewRecorder()

	service.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
	if body := rec.Body.String(); body != expectedBody {
		t.Fatalf("expected body %q, got %q", expectedBody, body)
	}
	if cacheControl := rec.Header().Get(headerCacheControl); cacheControl != mediaCacheControl {
		t.Fatalf("expected cache control %q, got %q", mediaCacheControl, cacheControl)
	}
	if etag := rec.Header().Get(headerETag); etag == "" {
		t.Fatal("expected ETag header to be set")
	}
}

func TestMediaHTTPServiceServeHTTPRejectsUnsafePaths(t *testing.T) {
	service := NewMediaHTTPService(nil, nil, nil, NewMediaSyncService(nil, nil, nil))
	rootPath := filepath.Join(t.TempDir(), "media")
	if err := service.configureRootPath(rootPath); err != nil {
		t.Fatalf("configure root path: %v", err)
	}

	testCases := []string{
		"/",
		"/images/",
		"/../secret.txt",
		`/..\secret.txt`,
	}

	for _, requestPath := range testCases {
		req := httptest.NewRequest(http.MethodGet, requestPath, nil)
		rec := httptest.NewRecorder()

		service.ServeHTTP(rec, req)

		if rec.Code != http.StatusNotFound {
			t.Fatalf("expected status 404 for %q, got %d", requestPath, rec.Code)
		}
	}
}

func TestMediaHTTPServiceServeHTTPReturnsNotModifiedWhenETagMatches(t *testing.T) {
	service := NewMediaHTTPService(nil, nil, nil, NewMediaSyncService(nil, nil, nil))
	rootPath := filepath.Join(t.TempDir(), "media")
	if err := service.configureRootPath(rootPath); err != nil {
		t.Fatalf("configure root path: %v", err)
	}

	targetPath := filepath.Join(rootPath, "images", "etag.png")
	if err := os.WriteFile(targetPath, []byte("etag"), 0644); err != nil {
		t.Fatalf("write media file: %v", err)
	}

	info, err := os.Stat(targetPath)
	if err != nil {
		t.Fatalf("stat media file: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/images/etag.png", nil)
	req.Header.Set(headerIfNoneMatch, buildMediaETag(info))
	rec := httptest.NewRecorder()

	service.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotModified {
		t.Fatalf("expected status 304, got %d", rec.Code)
	}
	if rec.Body.Len() != 0 {
		t.Fatalf("expected empty body, got %q", rec.Body.String())
	}
}

func TestMediaHTTPServiceImportImageStoresByDateFolders(t *testing.T) {
	service, rootPath := newIndexedMediaHTTPService(t)
	service.now = func() time.Time {
		return time.Date(2026, 3, 30, 12, 34, 56, 0, time.UTC)
	}

	imageData := mustEncodePNG(t, 2, 3)
	result, err := service.ImportImage(context.Background(), &ImageImportRequest{
		Filename: "clipboard-image.png",
		Data:     imageData,
	})
	if err != nil {
		t.Fatalf("import image: %v", err)
	}

	expectedRelativePrefix := "images/2026/03/30/"
	if got := result.Path; len(got) <= len(expectedRelativePrefix) || got[:len(expectedRelativePrefix)] != expectedRelativePrefix {
		t.Fatalf("expected relative path to start with %q, got %q", expectedRelativePrefix, got)
	}
	if result.URL != "/media/"+result.Path {
		t.Fatalf("expected url %q, got %q", "/media/"+result.Path, result.URL)
	}
	if result.Width != 2 || result.Height != 3 {
		t.Fatalf("expected dimensions 2x3, got %dx%d", result.Width, result.Height)
	}
	if result.MimeType != "image/png" {
		t.Fatalf("expected mime type image/png, got %q", result.MimeType)
	}
	if result.ID == "" || result.ID != result.SHA256 {
		t.Fatalf("expected stable asset id to match sha256, got id=%q sha256=%q", result.ID, result.SHA256)
	}
	if result.Filename != "clipboard-image.png" {
		t.Fatalf("expected original filename %q, got %q", "clipboard-image.png", result.Filename)
	}

	absImagePath := filepath.Join(rootPath, filepath.FromSlash(result.Path))
	if _, err := os.Stat(absImagePath); err != nil {
		t.Fatalf("stat imported image: %v", err)
	}

	indexed, err := service.dbService.Client.MediaAsset.Query().
		Where(mediaasset.AssetIDEQ(result.ID)).
		Only(context.Background())
	if err != nil {
		t.Fatalf("query indexed asset: %v", err)
	}
	if indexed.Path != result.Path {
		t.Fatalf("expected indexed path %q, got %q", result.Path, indexed.Path)
	}
}

func TestMediaHTTPServiceImportImageSupportsBase64Payload(t *testing.T) {
	service, _ := newIndexedMediaHTTPService(t)

	imageData := mustEncodePNG(t, 1, 1)
	result, err := service.ImportImage(context.Background(), &ImageImportRequest{
		DataBase64: base64.StdEncoding.EncodeToString(imageData),
	})
	if err != nil {
		t.Fatalf("import image from base64: %v", err)
	}
	if result.Width != 1 || result.Height != 1 {
		t.Fatalf("expected dimensions 1x1, got %dx%d", result.Width, result.Height)
	}
}

func TestMediaHTTPServiceImportImageDeduplicatesByContentHash(t *testing.T) {
	service, rootPath := newIndexedMediaHTTPService(t)
	imageData := mustEncodePNG(t, 3, 3)

	first, err := service.ImportImage(context.Background(), &ImageImportRequest{
		Filename: "first.png",
		Data:     imageData,
	})
	if err != nil {
		t.Fatalf("import first image: %v", err)
	}

	second, err := service.ImportImage(context.Background(), &ImageImportRequest{
		Filename: "second-name.png",
		Data:     imageData,
	})
	if err != nil {
		t.Fatalf("import second image: %v", err)
	}

	if first.ID != second.ID {
		t.Fatalf("expected deduplicated asset ids to match, got %q and %q", first.ID, second.ID)
	}
	if first.Path != second.Path {
		t.Fatalf("expected deduplicated path to match, got %q and %q", first.Path, second.Path)
	}

	rows, err := service.dbService.Client.MediaAsset.Query().All(context.Background())
	if err != nil {
		t.Fatalf("list media assets: %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("expected 1 indexed row after duplicate import, got %d", len(rows))
	}

	if _, err := os.Stat(filepath.Join(rootPath, filepath.FromSlash(first.Path))); err != nil {
		t.Fatalf("expected deduplicated image file to exist: %v", err)
	}
}

func TestMediaHTTPServiceReconcileMediaIndexRemovesMissingFiles(t *testing.T) {
	service, rootPath := newIndexedMediaHTTPService(t)

	result, err := service.ImportImage(context.Background(), &ImageImportRequest{
		Filename: "manual-delete.png",
		Data:     mustEncodePNG(t, 2, 1),
	})
	if err != nil {
		t.Fatalf("import image: %v", err)
	}

	absImagePath := filepath.Join(rootPath, filepath.FromSlash(result.Path))
	if err := os.Remove(absImagePath); err != nil {
		t.Fatalf("remove local image file: %v", err)
	}

	if err := service.reconcileMediaIndex(context.Background()); err != nil {
		t.Fatalf("reconcile media index after manual delete: %v", err)
	}
	_, err = service.dbService.Client.MediaAsset.Query().
		Where(mediaasset.AssetIDEQ(result.ID)).
		Only(context.Background())
	if !ent.IsNotFound(err) {
		t.Fatalf("expected manually deleted asset index row to be removed, err=%v", err)
	}
}

func TestMediaHTTPServiceReconcileMediaIndexRestoresStagedFiles(t *testing.T) {
	service, rootPath := newIndexedMediaHTTPService(t)

	result, err := service.ImportImage(context.Background(), &ImageImportRequest{
		Filename: "staged-recover.png",
		Data:     mustEncodePNG(t, 2, 1),
	})
	if err != nil {
		t.Fatalf("import image: %v", err)
	}

	absImagePath := filepath.Join(rootPath, filepath.FromSlash(result.Path))
	stagedPath, err := service.mediaHelper.StageFile(absImagePath, service.now().UTC())
	if err != nil {
		t.Fatalf("stage image file: %v", err)
	}
	if stagedPath == "" {
		t.Fatal("expected staged path")
	}

	if err := service.reconcileMediaIndex(context.Background()); err != nil {
		t.Fatalf("reconcile media index with staged file: %v", err)
	}

	if _, err := os.Stat(absImagePath); err != nil {
		t.Fatalf("expected reconciler to restore staged file: %v", err)
	}
	if _, err := os.Stat(stagedPath); !os.IsNotExist(err) {
		t.Fatalf("expected staged file to be consumed, stat err=%v", err)
	}

	_, err = service.dbService.Client.MediaAsset.Query().
		Where(mediaasset.AssetIDEQ(result.ID)).
		Only(context.Background())
	if err != nil {
		t.Fatalf("reload asset after staged reconcile: %v", err)
	}
}

func TestMediaHTTPServiceDeleteImageRemovesFileAndHardDeletesIndexedRow(t *testing.T) {
	service, rootPath := newIndexedMediaHTTPService(t)

	result, err := service.ImportImage(context.Background(), &ImageImportRequest{
		Filename: "delete-me.png",
		Data:     mustEncodePNG(t, 1, 1),
	})
	if err != nil {
		t.Fatalf("import image: %v", err)
	}

	deleteResult, err := service.DeleteImage(context.Background(), result.ID)
	if err != nil {
		t.Fatalf("delete image: %v", err)
	}
	if !deleteResult.Deleted {
		t.Fatal("expected deleted=true")
	}

	absImagePath := filepath.Join(rootPath, filepath.FromSlash(result.Path))
	if _, err := os.Stat(absImagePath); !os.IsNotExist(err) {
		t.Fatalf("expected image file to be removed, stat err=%v", err)
	}

	reloaded, err := service.dbService.Client.MediaAsset.Query().
		Where(mediaasset.AssetIDEQ(result.ID)).
		Only(context.Background())
	if !ent.IsNotFound(err) {
		t.Fatalf("expected deleted asset row to be removed, err=%v row=%v", err, reloaded)
	}
}

func TestMediaHTTPServiceDeleteImageSkipsReferencedAsset(t *testing.T) {
	service, rootPath := newIndexedMediaHTTPService(t)

	result, err := service.ImportImage(context.Background(), &ImageImportRequest{
		Filename: "referenced.png",
		Data:     mustEncodePNG(t, 1, 1),
	})
	if err != nil {
		t.Fatalf("import image: %v", err)
	}

	if _, err := service.dbService.Client.Document.Create().
		SetTitle("ref-doc").
		SetContent(buildInlineImageDocumentContent(result)).
		Save(context.Background()); err != nil {
		t.Fatalf("create document with image reference: %v", err)
	}

	deleteResult, err := service.DeleteImage(context.Background(), result.ID)
	if err != nil {
		t.Fatalf("delete image: %v", err)
	}
	if deleteResult.Deleted {
		t.Fatal("expected referenced asset to be kept")
	}

	absImagePath := filepath.Join(rootPath, filepath.FromSlash(result.Path))
	if _, err := os.Stat(absImagePath); err != nil {
		t.Fatalf("expected referenced image file to remain: %v", err)
	}

	if _, err := service.dbService.Client.MediaAsset.Query().
		Where(mediaasset.AssetIDEQ(result.ID)).
		Only(context.Background()); err != nil {
		t.Fatalf("expected referenced asset row to remain: %v", err)
	}
}

func TestMediaHTTPServiceCleanupRemovedMediaReferencesDeletesOrphanedAsset(t *testing.T) {
	service, rootPath := newIndexedMediaHTTPService(t)

	result, err := service.ImportImage(context.Background(), &ImageImportRequest{
		Filename: "orphan-cleanup.png",
		Data:     mustEncodePNG(t, 2, 1),
	})
	if err != nil {
		t.Fatalf("import image: %v", err)
	}

	content := buildInlineImageDocumentContent(result)
	doc, err := service.dbService.Client.Document.Create().
		SetTitle("cleanup-doc").
		SetContent(content).
		Save(context.Background())
	if err != nil {
		t.Fatalf("create document: %v", err)
	}

	if _, err := service.dbService.Client.Document.UpdateOneID(doc.ID).
		SetContent("").
		Save(context.Background()); err != nil {
		t.Fatalf("update document content: %v", err)
	}

	if err := service.cleanupRemovedMediaReferences(
		context.Background(),
		service.mediaReferences.DiffRemovedReferences(content, ""),
		service.currentRootVersion(),
	); err != nil {
		t.Fatalf("cleanup removed media references: %v", err)
	}

	absImagePath := filepath.Join(rootPath, filepath.FromSlash(result.Path))
	if _, err := os.Stat(absImagePath); !os.IsNotExist(err) {
		t.Fatalf("expected orphaned image file to be removed, stat err=%v", err)
	}

	_, err = service.dbService.Client.MediaAsset.Query().
		Where(mediaasset.AssetIDEQ(result.ID)).
		Only(context.Background())
	if !ent.IsNotFound(err) {
		t.Fatalf("expected orphaned asset row to be removed, err=%v", err)
	}
}

func TestMediaHTTPServiceCleanupRemovedMediaReferencesKeepsSharedAsset(t *testing.T) {
	service, rootPath := newIndexedMediaHTTPService(t)

	result, err := service.ImportImage(context.Background(), &ImageImportRequest{
		Filename: "shared-cleanup.png",
		Data:     mustEncodePNG(t, 2, 1),
	})
	if err != nil {
		t.Fatalf("import image: %v", err)
	}

	content := buildInlineImageDocumentContent(result)
	firstDoc, err := service.dbService.Client.Document.Create().
		SetTitle("cleanup-doc-1").
		SetContent(content).
		Save(context.Background())
	if err != nil {
		t.Fatalf("create first document: %v", err)
	}
	if _, err := service.dbService.Client.Document.Create().
		SetTitle("cleanup-doc-2").
		SetContent(content).
		Save(context.Background()); err != nil {
		t.Fatalf("create second document: %v", err)
	}

	if _, err := service.dbService.Client.Document.UpdateOneID(firstDoc.ID).
		SetContent("").
		Save(context.Background()); err != nil {
		t.Fatalf("update first document content: %v", err)
	}

	if err := service.cleanupRemovedMediaReferences(
		context.Background(),
		service.mediaReferences.DiffRemovedReferences(content, ""),
		service.currentRootVersion(),
	); err != nil {
		t.Fatalf("cleanup removed media references: %v", err)
	}

	absImagePath := filepath.Join(rootPath, filepath.FromSlash(result.Path))
	if _, err := os.Stat(absImagePath); err != nil {
		t.Fatalf("expected shared image file to remain: %v", err)
	}

	if _, err := service.dbService.Client.MediaAsset.Query().
		Where(mediaasset.AssetIDEQ(result.ID)).
		Only(context.Background()); err != nil {
		t.Fatalf("expected shared asset row to remain: %v", err)
	}
}

func TestMediaHTTPServiceCleanupRemovedMediaReferencesSkipsStaleRootVersion(t *testing.T) {
	service, rootPath := newIndexedMediaHTTPService(t)

	result, err := service.ImportImage(context.Background(), &ImageImportRequest{
		Filename: "stale-root.png",
		Data:     mustEncodePNG(t, 1, 2),
	})
	if err != nil {
		t.Fatalf("import image: %v", err)
	}

	content := buildInlineImageDocumentContent(result)
	doc, err := service.dbService.Client.Document.Create().
		SetTitle("stale-root-doc").
		SetContent(content).
		Save(context.Background())
	if err != nil {
		t.Fatalf("create document: %v", err)
	}
	if _, err := service.dbService.Client.Document.UpdateOneID(doc.ID).
		SetContent("").
		Save(context.Background()); err != nil {
		t.Fatalf("update document content: %v", err)
	}

	staleVersion := service.currentRootVersion()
	newRootPath := filepath.Join(t.TempDir(), "other-media-root")
	if err := service.configureRootPath(newRootPath); err != nil {
		t.Fatalf("reconfigure media root: %v", err)
	}

	if err := service.cleanupRemovedMediaReferences(
		context.Background(),
		service.mediaReferences.DiffRemovedReferences(content, ""),
		staleVersion,
	); err != nil {
		t.Fatalf("cleanup removed media references: %v", err)
	}

	oldAbsImagePath := filepath.Join(rootPath, filepath.FromSlash(result.Path))
	if _, err := os.Stat(oldAbsImagePath); err != nil {
		t.Fatalf("expected old-root image file to remain after stale cleanup: %v", err)
	}

	if _, err := service.dbService.Client.MediaAsset.Query().
		Where(mediaasset.AssetIDEQ(result.ID)).
		Only(context.Background()); err != nil {
		t.Fatalf("expected asset row to remain after stale cleanup: %v", err)
	}
}

func TestMediaHTTPServiceSweepOrphanedAssetsDeletesUnindexedFilesFromImagesDir(t *testing.T) {
	service, rootPath := newIndexedMediaHTTPService(t)

	strayDir := filepath.Join(rootPath, "images", "2024", "12", "31")
	strayPath := filepath.Join(strayDir, "orphan.png")
	if err := os.MkdirAll(strayDir, 0755); err != nil {
		t.Fatalf("create stray image dir: %v", err)
	}
	if err := os.WriteFile(strayPath, mustEncodePNG(t, 1, 1), 0644); err != nil {
		t.Fatalf("write stray image file: %v", err)
	}

	emptyDir := filepath.Join(rootPath, "images", "2024", "11", "01")
	if err := os.MkdirAll(emptyDir, 0755); err != nil {
		t.Fatalf("create empty image dir: %v", err)
	}

	if err := service.sweepOrphanedAssets(context.Background(), service.currentRootVersion()); err != nil {
		t.Fatalf("sweep orphaned assets: %v", err)
	}

	if _, err := os.Stat(strayPath); !os.IsNotExist(err) {
		t.Fatalf("expected unindexed image file to be deleted, stat err=%v", err)
	}
	if _, err := os.Stat(strayDir); !os.IsNotExist(err) {
		t.Fatalf("expected stray image dir to be trimmed, stat err=%v", err)
	}
	if _, err := os.Stat(emptyDir); !os.IsNotExist(err) {
		t.Fatalf("expected empty image dir to be removed, stat err=%v", err)
	}
}

func TestMediaHTTPServiceSweepOrphanedAssetsKeepsReferencedIndexedFiles(t *testing.T) {
	service, rootPath := newIndexedMediaHTTPService(t)

	result, err := service.ImportImage(context.Background(), &ImageImportRequest{
		Filename: "kept.png",
		Data:     mustEncodePNG(t, 2, 2),
	})
	if err != nil {
		t.Fatalf("import image: %v", err)
	}
	if _, err := service.dbService.Client.Document.Create().
		SetTitle("kept-doc").
		SetContent(buildInlineImageDocumentContent(result)).
		Save(context.Background()); err != nil {
		t.Fatalf("create referencing document: %v", err)
	}

	if err := service.sweepOrphanedAssets(context.Background(), service.currentRootVersion()); err != nil {
		t.Fatalf("sweep orphaned assets: %v", err)
	}

	absImagePath := filepath.Join(rootPath, filepath.FromSlash(result.Path))
	if _, err := os.Stat(absImagePath); err != nil {
		t.Fatalf("expected indexed image file to remain: %v", err)
	}
	if _, err := service.dbService.Client.MediaAsset.Query().
		Where(mediaasset.AssetIDEQ(result.ID)).
		Only(context.Background()); err != nil {
		t.Fatalf("expected indexed asset row to remain: %v", err)
	}
}

func TestMediaHTTPServiceSweepOrphanedAssetsSkipsUnindexedFileDeletionOnStaleRootVersion(t *testing.T) {
	service, rootPath := newIndexedMediaHTTPService(t)

	strayDir := filepath.Join(rootPath, "images", "2025", "01", "15")
	strayPath := filepath.Join(strayDir, "stale-orphan.png")
	if err := os.MkdirAll(strayDir, 0755); err != nil {
		t.Fatalf("create stale stray dir: %v", err)
	}
	if err := os.WriteFile(strayPath, mustEncodePNG(t, 1, 1), 0644); err != nil {
		t.Fatalf("write stale stray file: %v", err)
	}

	staleVersion := service.currentRootVersion()
	newRootPath := filepath.Join(t.TempDir(), "other-media-root")
	if err := service.configureRootPath(newRootPath); err != nil {
		t.Fatalf("reconfigure media root: %v", err)
	}

	if err := service.sweepOrphanedAssets(context.Background(), staleVersion); err != nil {
		t.Fatalf("sweep orphaned assets with stale root version: %v", err)
	}

	if _, err := os.Stat(strayPath); err != nil {
		t.Fatalf("expected old-root unindexed file to remain after stale sweep: %v", err)
	}
}

func TestMediaHTTPServiceDeleteImageRestoresFileWhenIndexUpdateFails(t *testing.T) {
	service, rootPath := newIndexedMediaHTTPService(t)
	imageData := mustEncodePNG(t, 2, 2)

	result, err := service.ImportImage(context.Background(), &ImageImportRequest{
		Filename: "delete-rollback.png",
		Data:     imageData,
	})
	if err != nil {
		t.Fatalf("import image: %v", err)
	}

	failMediaAssetDeletes(service.dbService.Client, fmt.Errorf("forced delete failure"))

	if _, err := service.DeleteImage(context.Background(), result.ID); err == nil {
		t.Fatal("expected delete image to fail")
	}

	absImagePath := filepath.Join(rootPath, filepath.FromSlash(result.Path))
	restoredData, err := os.ReadFile(absImagePath)
	if err != nil {
		t.Fatalf("expected image file to be restored: %v", err)
	}
	if !bytes.Equal(restoredData, imageData) {
		t.Fatal("expected restored image file to keep original bytes")
	}

	reloaded, err := service.dbService.Client.MediaAsset.Query().
		Where(mediaasset.AssetIDEQ(result.ID)).
		Only(context.Background())
	if err != nil {
		t.Fatalf("reload asset after failed delete: %v", err)
	}
	if reloaded.Path != result.Path {
		t.Fatalf("expected asset path %q after failed delete, got %q", result.Path, reloaded.Path)
	}
}

func TestMediaHTTPServiceDeleteImageAllowsCleanReimport(t *testing.T) {
	service, rootPath := newIndexedMediaHTTPService(t)
	imageData := mustEncodePNG(t, 2, 2)

	result, err := service.ImportImage(context.Background(), &ImageImportRequest{
		Filename: "restore-rollback.png",
		Data:     imageData,
	})
	if err != nil {
		t.Fatalf("import image: %v", err)
	}

	if _, err := service.DeleteImage(context.Background(), result.ID); err != nil {
		t.Fatalf("delete image before reimport test: %v", err)
	}

	reimported, err := service.ImportImage(context.Background(), &ImageImportRequest{
		Filename: "restore-rollback.png",
		Data:     imageData,
	})
	if err != nil {
		t.Fatalf("reimport image after delete: %v", err)
	}

	absImagePath := filepath.Join(rootPath, filepath.FromSlash(result.Path))
	if _, err := os.Stat(absImagePath); err != nil {
		t.Fatalf("expected reimported image file to exist, stat err=%v", err)
	}

	reloaded, err := service.dbService.Client.MediaAsset.Query().
		Where(mediaasset.AssetIDEQ(reimported.ID)).
		Only(context.Background())
	if err != nil {
		t.Fatalf("reload asset after reimport: %v", err)
	}
	if reloaded.Path != result.Path {
		t.Fatalf("expected reimported image path %q to match deleted path %q", reloaded.Path, result.Path)
	}
}

func mustEncodePNG(t *testing.T, width int, height int) []byte {
	t.Helper()

	img := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			img.Set(x, y, color.RGBA{R: 100, G: 150, B: 200, A: 255})
		}
	}

	var buffer bytes.Buffer
	if err := png.Encode(&buffer, img); err != nil {
		t.Fatalf("encode png: %v", err)
	}
	return buffer.Bytes()
}

func buildInlineImageDocumentContent(asset *ImageAsset) string {
	return fmt.Sprintf(
		"before <∞img;id=tag-%s;asset=%s;file=%s;w=%d;h=%d∞> after",
		asset.ID[:8],
		asset.ID,
		asset.URL,
		asset.Width,
		asset.Height,
	)
}
