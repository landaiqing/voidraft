package services

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
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
	commonhelper "voidraft/internal/common/helper"
	"voidraft/internal/models/ent"
	"voidraft/internal/models/ent/enttest"
	"voidraft/internal/models/ent/mediaasset"
	schemamixin "voidraft/internal/models/schema/mixin"

	_ "github.com/mattn/go-sqlite3"
)

func newIndexedMediaHTTPService(t *testing.T) (*MediaHTTPService, string) {
	t.Helper()

	dsnName := strings.NewReplacer("/", "_", "\\", "_", " ", "_").Replace(t.Name())
	client := enttest.Open(t, "sqlite3", fmt.Sprintf("file:%s?mode=memory&cache=shared&_fk=1", dsnName))
	t.Cleanup(func() {
		_ = client.Close()
	})

	service := NewMediaHTTPService(nil, nil, &DatabaseService{Client: client})
	rootPath := filepath.Join(t.TempDir(), "media")
	if err := service.configureRootPath(rootPath); err != nil {
		t.Fatalf("configure root path: %v", err)
	}
	return service, rootPath
}

func TestMediaHTTPServiceConfigureRootPathCreatesDirectories(t *testing.T) {
	service := NewMediaHTTPService(nil, nil)
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
	service := NewMediaHTTPService(nil, nil)
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
	service := NewMediaHTTPService(nil, nil)
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
	service := NewMediaHTTPService(nil, nil)
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
	mediaHelper := commonhelper.NewMediaHelper()
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
	if got := result.RelativePath; len(got) <= len(expectedRelativePrefix) || got[:len(expectedRelativePrefix)] != expectedRelativePrefix {
		t.Fatalf("expected relative path to start with %q, got %q", expectedRelativePrefix, got)
	}
	if result.URL != "/media/"+result.RelativePath {
		t.Fatalf("expected url %q, got %q", "/media/"+result.RelativePath, result.URL)
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
	expectedFilename := mediaHelper.BuildStoredImageFilename(result.SHA256, ".png")
	if result.Filename != expectedFilename {
		t.Fatalf("expected managed filename %q, got %q", expectedFilename, result.Filename)
	}

	absImagePath := filepath.Join(rootPath, filepath.FromSlash(result.RelativePath))
	if _, err := os.Stat(absImagePath); err != nil {
		t.Fatalf("stat imported image: %v", err)
	}

	indexed, err := service.dbService.Client.MediaAsset.Query().
		Where(mediaasset.AssetIDEQ(result.ID)).
		Only(context.Background())
	if err != nil {
		t.Fatalf("query indexed asset: %v", err)
	}
	if indexed.RelativePath != result.RelativePath {
		t.Fatalf("expected indexed path %q, got %q", result.RelativePath, indexed.RelativePath)
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
	if first.RelativePath != second.RelativePath {
		t.Fatalf("expected deduplicated path to match, got %q and %q", first.RelativePath, second.RelativePath)
	}

	rows, err := service.dbService.Client.MediaAsset.Query().All(context.Background())
	if err != nil {
		t.Fatalf("list media assets: %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("expected 1 indexed row after duplicate import, got %d", len(rows))
	}

	if _, err := os.Stat(filepath.Join(rootPath, filepath.FromSlash(first.RelativePath))); err != nil {
		t.Fatalf("expected deduplicated image file to exist: %v", err)
	}
}

func TestMediaHTTPServiceFullReconcileIndexesManagedFilesOnly(t *testing.T) {
	service, rootPath := newIndexedMediaHTTPService(t)
	mediaHelper := commonhelper.NewMediaHelper()
	importedAt := time.Date(2026, 3, 31, 9, 8, 7, 0, time.UTC)
	imageData := mustEncodePNG(t, 2, 2)
	digest := sha256.Sum256(imageData)
	assetID := hex.EncodeToString(digest[:])

	validFilename := mediaHelper.BuildStoredImageFilename(assetID, ".png")
	validRelativePath := filepath.ToSlash(filepath.Join(mediaHelper.ImageRelativeDir(importedAt), validFilename))
	validAbsPath := filepath.Join(rootPath, filepath.FromSlash(validRelativePath))
	if err := os.MkdirAll(filepath.Dir(validAbsPath), 0755); err != nil {
		t.Fatalf("mkdir valid image dir: %v", err)
	}
	if err := os.WriteFile(validAbsPath, imageData, 0644); err != nil {
		t.Fatalf("write valid managed image: %v", err)
	}

	invalidAbsPath := filepath.Join(rootPath, "images", "2026", "03", "31", "random.png")
	if err := os.WriteFile(invalidAbsPath, imageData, 0644); err != nil {
		t.Fatalf("write invalid image: %v", err)
	}

	if err := service.reconcileMediaIndex(context.Background(), true); err != nil {
		t.Fatalf("full reconcile: %v", err)
	}

	rows, err := service.dbService.Client.MediaAsset.Query().All(context.Background())
	if err != nil {
		t.Fatalf("query indexed rows: %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("expected 1 indexed managed image, got %d", len(rows))
	}
	if rows[0].AssetID != assetID {
		t.Fatalf("expected managed asset id %q, got %q", assetID, rows[0].AssetID)
	}
	if rows[0].RelativePath != validRelativePath {
		t.Fatalf("expected managed relative path %q, got %q", validRelativePath, rows[0].RelativePath)
	}
}

func TestMediaHTTPServiceListImagesReturnsNewestFirst(t *testing.T) {
	service, _ := newIndexedMediaHTTPService(t)

	service.now = func() time.Time {
		return time.Date(2026, 3, 29, 10, 0, 0, 0, time.UTC)
	}
	older, err := service.ImportImage(context.Background(), &ImageImportRequest{
		Filename: "older.png",
		Data:     mustEncodePNG(t, 1, 1),
	})
	if err != nil {
		t.Fatalf("import older image: %v", err)
	}

	service.now = func() time.Time {
		return time.Date(2026, 3, 30, 10, 0, 0, 0, time.UTC)
	}
	newer, err := service.ImportImage(context.Background(), &ImageImportRequest{
		Filename: "newer.png",
		Data:     mustEncodePNG(t, 1, 2),
	})
	if err != nil {
		t.Fatalf("import newer image: %v", err)
	}

	items, err := service.ListImages(context.Background())
	if err != nil {
		t.Fatalf("list images: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 images, got %d", len(items))
	}
	if items[0].RelativePath != newer.RelativePath {
		t.Fatalf("expected newest image first, got %q", items[0].RelativePath)
	}
	if items[1].RelativePath != older.RelativePath {
		t.Fatalf("expected older image second, got %q", items[1].RelativePath)
	}
}

func TestMediaHTTPServiceListImagesPageSupportsCursorPagination(t *testing.T) {
	service, _ := newIndexedMediaHTTPService(t)

	for i, imageTime := range []time.Time{
		time.Date(2026, 3, 29, 10, 0, 0, 0, time.UTC),
		time.Date(2026, 3, 30, 10, 0, 0, 0, time.UTC),
		time.Date(2026, 3, 31, 10, 0, 0, 0, time.UTC),
	} {
		service.now = func() time.Time {
			return imageTime
		}
		if _, err := service.ImportImage(context.Background(), &ImageImportRequest{
			Filename: fmt.Sprintf("page-%d.png", i),
			Data:     mustEncodePNG(t, i+1, 1),
		}); err != nil {
			t.Fatalf("import page image %d: %v", i, err)
		}
	}

	firstPage, err := service.ListImagesPage(context.Background(), &ImageListPageRequest{Limit: 2})
	if err != nil {
		t.Fatalf("list first image page: %v", err)
	}
	if len(firstPage.Items) != 2 {
		t.Fatalf("expected 2 items in first page, got %d", len(firstPage.Items))
	}
	if !firstPage.HasMore || firstPage.NextCursor == "" {
		t.Fatalf("expected first page to have next cursor, got hasMore=%v cursor=%q", firstPage.HasMore, firstPage.NextCursor)
	}

	secondPage, err := service.ListImagesPage(context.Background(), &ImageListPageRequest{
		Limit:  2,
		Cursor: firstPage.NextCursor,
	})
	if err != nil {
		t.Fatalf("list second image page: %v", err)
	}
	if len(secondPage.Items) != 1 {
		t.Fatalf("expected 1 item in second page, got %d", len(secondPage.Items))
	}
	if secondPage.HasMore || secondPage.NextCursor != "" {
		t.Fatalf("expected second page to be terminal, got hasMore=%v cursor=%q", secondPage.HasMore, secondPage.NextCursor)
	}
	if firstPage.Items[0].CreatedAt < firstPage.Items[1].CreatedAt {
		t.Fatal("expected first page items to remain ordered descending by created_at")
	}
	if firstPage.Items[1].CreatedAt < secondPage.Items[0].CreatedAt {
		t.Fatal("expected second page to continue after first page cursor")
	}
}

func TestMediaHTTPServiceListImagesExcludesManuallyDeletedFiles(t *testing.T) {
	service, rootPath := newIndexedMediaHTTPService(t)

	result, err := service.ImportImage(context.Background(), &ImageImportRequest{
		Filename: "manual-delete.png",
		Data:     mustEncodePNG(t, 2, 1),
	})
	if err != nil {
		t.Fatalf("import image: %v", err)
	}

	absImagePath := filepath.Join(rootPath, filepath.FromSlash(result.RelativePath))
	if err := os.Remove(absImagePath); err != nil {
		t.Fatalf("remove local image file: %v", err)
	}

	items, err := service.ListImages(context.Background())
	if err != nil {
		t.Fatalf("list images after manual delete: %v", err)
	}
	if len(items) != 0 {
		t.Fatalf("expected missing image to be filtered from list, got %d items", len(items))
	}

	_, err = service.dbService.Client.MediaAsset.Query().
		Where(mediaasset.AssetIDEQ(result.ID)).
		Only(schemamixin.SkipSoftDelete(context.Background()))
	if !ent.IsNotFound(err) {
		t.Fatalf("expected manually deleted asset index row to be removed, err=%v", err)
	}
}

func TestMediaHTTPServiceDeleteImageRemovesFileAndMarksIndexedRowDeleted(t *testing.T) {
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

	absImagePath := filepath.Join(rootPath, filepath.FromSlash(result.RelativePath))
	if _, err := os.Stat(absImagePath); !os.IsNotExist(err) {
		t.Fatalf("expected image file to be removed, stat err=%v", err)
	}

	reloaded, err := service.dbService.Client.MediaAsset.Query().
		Where(mediaasset.AssetIDEQ(result.ID)).
		Only(schemamixin.SkipSoftDelete(context.Background()))
	if err != nil {
		t.Fatalf("reload deleted asset: %v", err)
	}
	if reloaded.DeletedAt == nil {
		t.Fatal("expected deleted_at to be set after logical delete")
	}
}

func TestMediaHTTPServiceRunFullMediaReconcileIndexesManagedFilesInBackground(t *testing.T) {
	service, rootPath := newIndexedMediaHTTPService(t)
	mediaHelper := commonhelper.NewMediaHelper()
	importedAt := time.Date(2026, 3, 31, 9, 8, 7, 0, time.UTC)
	imageData := mustEncodePNG(t, 2, 2)
	digest := sha256.Sum256(imageData)
	assetID := hex.EncodeToString(digest[:])

	filename := mediaHelper.BuildStoredImageFilename(assetID, ".png")
	relativePath := filepath.ToSlash(filepath.Join(mediaHelper.ImageRelativeDir(importedAt), filename))
	absPath := filepath.Join(rootPath, filepath.FromSlash(relativePath))
	if err := os.MkdirAll(filepath.Dir(absPath), 0755); err != nil {
		t.Fatalf("mkdir managed image dir: %v", err)
	}
	if err := os.WriteFile(absPath, imageData, 0644); err != nil {
		t.Fatalf("write managed image: %v", err)
	}

	status, err := service.RunFullMediaReconcile(context.Background())
	if err != nil {
		t.Fatalf("run background full reconcile: %v", err)
	}
	if !status.Running && status.LastFinishedAt == "" {
		t.Fatal("expected background reconcile to start or finish immediately")
	}

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		_, err := service.dbService.Client.MediaAsset.Query().
			Where(mediaasset.AssetIDEQ(assetID)).
			Only(context.Background())
		if err == nil {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}

	indexed, err := service.dbService.Client.MediaAsset.Query().
		Where(mediaasset.AssetIDEQ(assetID)).
		Only(context.Background())
	if err != nil {
		t.Fatalf("expected background reconcile to index managed image: %v", err)
	}
	if indexed.RelativePath != relativePath {
		t.Fatalf("expected indexed relative path %q, got %q", relativePath, indexed.RelativePath)
	}

	finalStatus, err := service.GetMediaReconcileStatus(context.Background())
	if err != nil {
		t.Fatalf("get media reconcile status: %v", err)
	}
	if finalStatus.Running {
		t.Fatal("expected background reconcile to finish")
	}
	if finalStatus.LastError != "" {
		t.Fatalf("expected empty background reconcile error, got %q", finalStatus.LastError)
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
