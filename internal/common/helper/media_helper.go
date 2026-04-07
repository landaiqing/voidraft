package helper

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"slices"
	"strings"
	"time"

	_ "golang.org/x/image/bmp"
	_ "golang.org/x/image/tiff"
	_ "golang.org/x/image/webp"
)

const (
	MediaDirName            = "media"
	MediaImagesDirName      = "images"
	MediaCacheControl       = "public, max-age=31536000, immutable"
	MediaHeaderCacheControl = "Cache-Control"
	MediaHeaderETag         = "ETag"
	MediaHeaderIfNoneMatch  = "If-None-Match"
	MediaHeaderXContentType = "X-Content-Type-Options"
	MediaStagedFileMarker   = ".voidraft-stage-"
)

type MediaHelper struct{}

type ImagePayload struct {
	MimeType  string
	Extension string
	Width     int
	Height    int
	Digest    string
}

func NewMediaHelper() *MediaHelper {
	return &MediaHelper{}
}

func (h *MediaHelper) RootPath(dataPath string) string {
	return filepath.Join(dataPath, MediaDirName)
}

func (h *MediaHelper) EnsureRoot(rootPath string) error {
	if strings.TrimSpace(rootPath) == "" {
		return fmt.Errorf("media root path is required")
	}

	for _, dir := range []string{
		rootPath,
		filepath.Join(rootPath, MediaImagesDirName),
	} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("create media directory %s: %w", dir, err)
		}
	}
	return nil
}

func (h *MediaHelper) URL(routePrefix string, relativePath string) string {
	if strings.TrimSpace(relativePath) == "" {
		return routePrefix
	}
	return path.Join(routePrefix, relativePath)
}

func (h *MediaHelper) ImageRelativeDir(importedAt time.Time) string {
	return path.Join(
		MediaImagesDirName,
		importedAt.Format("2006"),
		importedAt.Format("01"),
		importedAt.Format("02"),
	)
}

func (h *MediaHelper) BuildStoredImageFilename(digest string, extension string) string {
	return fmt.Sprintf("sha256_%s%s", strings.ToLower(strings.TrimSpace(digest)), canonicalImageExtension(extension))
}

func (h *MediaHelper) NormalizeImageReference(value string, routePrefix string) (string, error) {
	clean := strings.TrimSpace(value)
	if clean == "" {
		return "", fmt.Errorf("image path is required")
	}
	if parsed, err := url.Parse(clean); err == nil && parsed.Scheme != "" && strings.TrimSpace(parsed.Path) != "" {
		clean = parsed.Path
	}
	if strings.TrimSpace(routePrefix) != "" && strings.HasPrefix(clean, routePrefix+"/") {
		clean = strings.TrimPrefix(clean, routePrefix+"/")
	}
	clean = strings.TrimPrefix(clean, "/")
	clean = strings.ReplaceAll(clean, `\`, "/")
	if !strings.HasPrefix(clean, MediaImagesDirName+"/") {
		return "", fmt.Errorf("invalid image path")
	}
	return clean, nil
}

func (h *MediaHelper) ResolveManagedImagePath(rootPath string, value string, routePrefix string) (string, string, error) {
	relativePath, err := h.NormalizeImageReference(value, routePrefix)
	if err != nil {
		return "", "", err
	}
	absPath, err := h.ResolvePath(rootPath, relativePath)
	if err != nil {
		return "", "", err
	}
	return relativePath, absPath, nil
}

func (h *MediaHelper) ResolvePath(rootPath string, requestPath string) (string, error) {
	if strings.Contains(requestPath, `\`) {
		return "", fmt.Errorf("invalid media path")
	}

	for _, segment := range strings.Split(strings.TrimPrefix(requestPath, "/"), "/") {
		if segment == ".." {
			return "", fmt.Errorf("invalid media path")
		}
	}

	cleanPath := path.Clean("/" + requestPath)
	relativePath := strings.TrimPrefix(cleanPath, "/")
	if relativePath == "" || relativePath == "." {
		return "", fmt.Errorf("invalid media path")
	}

	targetPath := filepath.Join(rootPath, filepath.FromSlash(relativePath))
	resolvedRelativePath, err := filepath.Rel(rootPath, targetPath)
	if err != nil {
		return "", err
	}
	if resolvedRelativePath == ".." || strings.HasPrefix(resolvedRelativePath, ".."+string(os.PathSeparator)) {
		return "", fmt.Errorf("media path escapes root")
	}

	return targetPath, nil
}

func (h *MediaHelper) StageFile(absPath string, at time.Time) (string, error) {
	info, err := os.Stat(absPath)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil
		}
		return "", fmt.Errorf("stat file before staging: %w", err)
	}
	if info.IsDir() {
		return "", fmt.Errorf("path is a directory: %s", absPath)
	}

	stagedPath, err := h.nextStagedFilePath(absPath, at)
	if err != nil {
		return "", err
	}
	if err := os.Rename(absPath, stagedPath); err != nil {
		return "", fmt.Errorf("stage file: %w", err)
	}
	return stagedPath, nil
}

func (h *MediaHelper) RestoreStagedFile(absPath string, stagedPath string) error {
	if strings.TrimSpace(stagedPath) == "" {
		return nil
	}
	if err := os.Rename(stagedPath, absPath); err != nil {
		return fmt.Errorf("restore staged file: %w", err)
	}
	return nil
}

func (h *MediaHelper) RollbackFileChange(absPath string, stagedPath string) error {
	if err := os.Remove(absPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("remove changed file: %w", err)
	}
	if err := h.RestoreStagedFile(absPath, stagedPath); err != nil {
		return err
	}
	return nil
}

func (h *MediaHelper) DiscardStagedFile(stagedPath string) error {
	if strings.TrimSpace(stagedPath) == "" {
		return nil
	}
	if err := os.Remove(stagedPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("discard staged file: %w", err)
	}
	return nil
}

func (h *MediaHelper) StagedFilePaths(absPath string) ([]string, error) {
	pattern := filepath.Join(
		filepath.Dir(absPath),
		fmt.Sprintf(".%s%s*", filepath.Base(absPath), MediaStagedFileMarker),
	)
	paths, err := filepath.Glob(pattern)
	if err != nil {
		return nil, fmt.Errorf("list staged files: %w", err)
	}
	slices.Sort(paths)
	return paths, nil
}

func (h *MediaHelper) RestoreLatestStagedFile(absPath string) (bool, error) {
	stagedPaths, err := h.StagedFilePaths(absPath)
	if err != nil {
		return false, err
	}
	if len(stagedPaths) == 0 {
		return false, nil
	}

	latestPath := stagedPaths[len(stagedPaths)-1]
	if err := h.RestoreStagedFile(absPath, latestPath); err != nil {
		return false, err
	}
	for _, stagedPath := range stagedPaths[:len(stagedPaths)-1] {
		if err := h.DiscardStagedFile(stagedPath); err != nil {
			return true, err
		}
	}
	return true, nil
}

func (h *MediaHelper) DiscardStagedFiles(absPath string) error {
	stagedPaths, err := h.StagedFilePaths(absPath)
	if err != nil {
		return err
	}
	for _, stagedPath := range stagedPaths {
		if err := h.DiscardStagedFile(stagedPath); err != nil {
			return err
		}
	}
	return nil
}

func (h *MediaHelper) BuildETag(info os.FileInfo) string {
	return fmt.Sprintf(`W/"%x-%x"`, info.Size(), info.ModTime().UnixNano())
}

func (h *MediaHelper) NormalizeImportData(data []byte, dataBase64 string) ([]byte, error) {
	if len(data) > 0 {
		return data, nil
	}

	payload := strings.TrimSpace(dataBase64)
	if payload == "" {
		return nil, fmt.Errorf("image data is required")
	}

	if commaIndex := strings.Index(payload, ","); strings.HasPrefix(payload, "data:") && commaIndex >= 0 {
		payload = payload[commaIndex+1:]
	}

	decoded, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		return nil, fmt.Errorf("decode image base64: %w", err)
	}
	if len(decoded) == 0 {
		return nil, fmt.Errorf("image data is required")
	}
	return decoded, nil
}

func (h *MediaHelper) InspectImagePayload(data []byte, declaredMime string, filename string) (*ImagePayload, error) {
	mimeType := http.DetectContentType(data)
	if strings.TrimSpace(declaredMime) != "" && strings.HasPrefix(strings.TrimSpace(declaredMime), "image/") {
		mimeType = strings.TrimSpace(declaredMime)
	}

	extension, ok := imageExtensionByMime(mimeType)
	if !ok {
		extension = canonicalImageExtension(filepath.Ext(filename))
		if !isSupportedImageExtension(extension) {
			return nil, fmt.Errorf("unsupported image type: %s", mimeType)
		}
	}

	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("decode image metadata: %w", err)
	}

	if mappedMime, ok := imageMimeByFormat(format); ok && !strings.HasPrefix(strings.ToLower(mimeType), "image/") {
		mimeType = mappedMime
	}
	if mappedExtension, ok := imageExtensionByFormat(format); ok {
		extension = mappedExtension
	}

	sum := sha256.Sum256(data)
	return &ImagePayload{
		MimeType:  mimeType,
		Extension: canonicalImageExtension(extension),
		Width:     config.Width,
		Height:    config.Height,
		Digest:    hex.EncodeToString(sum[:]),
	}, nil
}

func (h *MediaHelper) WriteBinaryFile(absPath string, data []byte) error {
	if err := os.MkdirAll(filepath.Dir(absPath), 0755); err != nil {
		return fmt.Errorf("create image directory: %w", err)
	}
	if err := os.WriteFile(absPath, data, 0644); err != nil {
		return fmt.Errorf("write image file: %w", err)
	}
	return nil
}

func (h *MediaHelper) FileExists(absPath string) bool {
	info, err := os.Stat(absPath)
	return err == nil && !info.IsDir()
}

func (h *MediaHelper) RemoveImageArtifacts(absPath string) (bool, error) {
	deletedFile := false
	if err := os.Remove(absPath); err != nil {
		if !os.IsNotExist(err) {
			return false, fmt.Errorf("delete image file: %w", err)
		}
	} else {
		deletedFile = true
	}
	return deletedFile, nil
}

func (h *MediaHelper) TrimEmptyMediaDirs(rootPath string, imagePath string) {
	stopPath := filepath.Join(rootPath, MediaImagesDirName)
	current := filepath.Dir(imagePath)

	for {
		rel, err := filepath.Rel(stopPath, current)
		if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
			return
		}
		if current == stopPath {
			return
		}
		if err := os.Remove(current); err != nil {
			return
		}
		next := filepath.Dir(current)
		if next == current {
			return
		}
		current = next
	}
}

func (h *MediaHelper) IsValidAssetID(value string) bool {
	if len(value) != 64 {
		return false
	}
	for _, r := range value {
		switch {
		case r >= '0' && r <= '9':
		case r >= 'a' && r <= 'f':
		case r >= 'A' && r <= 'F':
		default:
			return false
		}
	}
	return true
}

func WrapRollbackError(action string, err error, rollbackErr error) error {
	if rollbackErr == nil {
		return fmt.Errorf("%s: %w", action, err)
	}
	return fmt.Errorf("%s: %w; rollback failed: %v", action, err, rollbackErr)
}

func (h *MediaHelper) nextStagedFilePath(absPath string, at time.Time) (string, error) {
	if at.IsZero() {
		at = time.Now().UTC()
	}

	dir := filepath.Dir(absPath)
	base := filepath.Base(absPath)
	stamp := at.UTC().UnixNano()

	for attempt := 0; attempt < 16; attempt++ {
		candidate := filepath.Join(dir, fmt.Sprintf(".%s%s%d-%d", base, MediaStagedFileMarker, stamp, attempt))
		if _, err := os.Stat(candidate); os.IsNotExist(err) {
			return candidate, nil
		} else if err != nil {
			return "", fmt.Errorf("stat staged file path: %w", err)
		}
	}

	return "", fmt.Errorf("allocate staged file path for %s: no free candidate", absPath)
}

func canonicalImageExtension(extension string) string {
	switch strings.ToLower(strings.TrimSpace(extension)) {
	case ".jpeg":
		return ".jpg"
	case ".tif":
		return ".tiff"
	default:
		return strings.ToLower(strings.TrimSpace(extension))
	}
}

func imageExtensionByMime(mimeType string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(mimeType)) {
	case "image/png":
		return ".png", true
	case "image/jpeg":
		return ".jpg", true
	case "image/gif":
		return ".gif", true
	case "image/webp":
		return ".webp", true
	case "image/bmp":
		return ".bmp", true
	case "image/tiff":
		return ".tiff", true
	default:
		return "", false
	}
}

func imageExtensionByFormat(format string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(format)) {
	case "png":
		return ".png", true
	case "jpeg":
		return ".jpg", true
	case "gif":
		return ".gif", true
	case "webp":
		return ".webp", true
	case "bmp":
		return ".bmp", true
	case "tiff":
		return ".tiff", true
	default:
		return "", false
	}
}

func imageMimeByFormat(format string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(format)) {
	case "png":
		return "image/png", true
	case "jpeg":
		return "image/jpeg", true
	case "gif":
		return "image/gif", true
	case "webp":
		return "image/webp", true
	case "bmp":
		return "image/bmp", true
	case "tiff":
		return "image/tiff", true
	default:
		return "", false
	}
}

func isSupportedImageExtension(extension string) bool {
	switch canonicalImageExtension(extension) {
	case ".png", ".jpg", ".gif", ".webp", ".bmp", ".tiff":
		return true
	default:
		return false
	}
}
