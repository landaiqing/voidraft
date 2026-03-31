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
	"os"
	"path"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
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
)

var managedImageFilenamePattern = regexp.MustCompile(`^sha256_([0-9a-f]{64})(\.[A-Za-z0-9]+)$`)

type MediaHelper struct{}

type ManagedImageFile struct {
	RelativePath string
	AbsPath      string
	ImportedAt   time.Time
	Digest       string
}

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

	if err := os.Remove(metadataPathForImage(absPath)); err != nil && !os.IsNotExist(err) {
		return deletedFile, fmt.Errorf("delete image metadata: %w", err)
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

func (h *MediaHelper) ScanManagedImageFiles(rootPath string) ([]ManagedImageFile, error) {
	imagesRoot := filepath.Join(rootPath, MediaImagesDirName)
	if _, err := os.Stat(imagesRoot); err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("stat media images root: %w", err)
	}

	yearDirs, err := os.ReadDir(imagesRoot)
	if err != nil {
		return nil, fmt.Errorf("read media year directories: %w", err)
	}

	files := make([]ManagedImageFile, 0)
	for _, yearDir := range yearDirs {
		if !yearDir.IsDir() || !isManagedYearDir(yearDir.Name()) {
			continue
		}

		yearPath := filepath.Join(imagesRoot, yearDir.Name())
		monthDirs, err := os.ReadDir(yearPath)
		if err != nil {
			return nil, fmt.Errorf("read media month directories: %w", err)
		}

		for _, monthDir := range monthDirs {
			if !monthDir.IsDir() || !isManagedMonthOrDayDir(monthDir.Name(), 12) {
				continue
			}

			monthPath := filepath.Join(yearPath, monthDir.Name())
			dayDirs, err := os.ReadDir(monthPath)
			if err != nil {
				return nil, fmt.Errorf("read media day directories: %w", err)
			}

			for _, dayDir := range dayDirs {
				if !dayDir.IsDir() || !isManagedMonthOrDayDir(dayDir.Name(), 31) {
					continue
				}

				dayPath := filepath.Join(monthPath, dayDir.Name())
				entries, err := os.ReadDir(dayPath)
				if err != nil {
					return nil, fmt.Errorf("read managed image directory: %w", err)
				}

				for _, entry := range entries {
					if entry.IsDir() {
						continue
					}

					digest, _, ok := parseManagedImageFilename(entry.Name())
					if !ok {
						continue
					}
					info, err := entry.Info()
					if err != nil {
						return nil, fmt.Errorf("read managed image info: %w", err)
					}
					importedAt := time.Date(
						mustAtoi(yearDir.Name()),
						time.Month(mustAtoi(monthDir.Name())),
						mustAtoi(dayDir.Name()),
						info.ModTime().UTC().Hour(),
						info.ModTime().UTC().Minute(),
						info.ModTime().UTC().Second(),
						info.ModTime().UTC().Nanosecond(),
						time.UTC,
					)

					files = append(files, ManagedImageFile{
						RelativePath: path.Join(MediaImagesDirName, yearDir.Name(), monthDir.Name(), dayDir.Name(), entry.Name()),
						AbsPath:      filepath.Join(dayPath, entry.Name()),
						ImportedAt:   importedAt,
						Digest:       digest,
					})
				}
			}
		}
	}

	sort.Slice(files, func(i int, j int) bool {
		return files[i].RelativePath < files[j].RelativePath
	})
	return files, nil
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

func parseManagedImageFilename(filename string) (string, string, bool) {
	matches := managedImageFilenamePattern.FindStringSubmatch(strings.TrimSpace(filename))
	if len(matches) != 3 {
		return "", "", false
	}

	extension := canonicalImageExtension(matches[2])
	if !isSupportedImageExtension(extension) {
		return "", "", false
	}

	return strings.ToLower(matches[1]), extension, true
}

func metadataPathForImage(imagePath string) string {
	return strings.TrimSuffix(imagePath, filepath.Ext(imagePath)) + ".json"
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

func isManagedYearDir(name string) bool {
	if len(name) != 4 {
		return false
	}
	year, err := strconv.Atoi(name)
	return err == nil && year >= 2000 && year <= 9999
}

func isManagedMonthOrDayDir(name string, max int) bool {
	if len(name) != 2 {
		return false
	}
	value, err := strconv.Atoi(name)
	return err == nil && value >= 1 && value <= max
}

func mustAtoi(value string) int {
	result, err := strconv.Atoi(value)
	if err != nil {
		return 0
	}
	return result
}
