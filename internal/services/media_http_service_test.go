package services

import (
	"bytes"
	"context"
	"encoding/base64"
	"image"
	"image/color"
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"
)

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
	service := NewMediaHTTPService(nil, nil)
	service.now = func() time.Time {
		return time.Date(2026, 3, 30, 12, 34, 56, 0, time.UTC)
	}

	rootPath := filepath.Join(t.TempDir(), "media")
	if err := service.configureRootPath(rootPath); err != nil {
		t.Fatalf("configure root path: %v", err)
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

	absImagePath := filepath.Join(rootPath, filepath.FromSlash(result.RelativePath))
	if _, err := os.Stat(absImagePath); err != nil {
		t.Fatalf("stat imported image: %v", err)
	}
	if _, err := os.Stat(metadataPathForImage(absImagePath)); err != nil {
		t.Fatalf("stat image metadata: %v", err)
	}
}

func TestMediaHTTPServiceImportImageSupportsBase64Payload(t *testing.T) {
	service := NewMediaHTTPService(nil, nil)
	rootPath := filepath.Join(t.TempDir(), "media")
	if err := service.configureRootPath(rootPath); err != nil {
		t.Fatalf("configure root path: %v", err)
	}

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

func TestMediaHTTPServiceListImagesReturnsNewestFirst(t *testing.T) {
	service := NewMediaHTTPService(nil, nil)
	rootPath := filepath.Join(t.TempDir(), "media")
	if err := service.configureRootPath(rootPath); err != nil {
		t.Fatalf("configure root path: %v", err)
	}

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

func TestMediaHTTPServiceDeleteImageRemovesFileAndMetadata(t *testing.T) {
	service := NewMediaHTTPService(nil, nil)
	rootPath := filepath.Join(t.TempDir(), "media")
	if err := service.configureRootPath(rootPath); err != nil {
		t.Fatalf("configure root path: %v", err)
	}

	result, err := service.ImportImage(context.Background(), &ImageImportRequest{
		Filename: "delete-me.png",
		Data:     mustEncodePNG(t, 1, 1),
	})
	if err != nil {
		t.Fatalf("import image: %v", err)
	}

	deleteResult, err := service.DeleteImage(context.Background(), result.URL)
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
	if _, err := os.Stat(metadataPathForImage(absImagePath)); !os.IsNotExist(err) {
		t.Fatalf("expected metadata file to be removed, stat err=%v", err)
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
