package services

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
	"voidraft/internal/common/helper"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
	_ "golang.org/x/image/bmp"
	_ "golang.org/x/image/tiff"
	_ "golang.org/x/image/webp"
)

const (
	mediaServiceName         = "voidraft/internal/services/mediahttp"
	mediaServiceRoute        = "/media"
	mediaDirName             = "media"
	mediaImagesDirName       = "images"
	mediaCacheControl        = "public, max-age=31536000, immutable"
	headerCacheControl       = "Cache-Control"
	headerETag               = "ETag"
	headerIfNoneMatch        = "If-None-Match"
	headerXContentTypeOption = "X-Content-Type-Options"
)

// MediaHTTPService serves media files from the current data directory.
type MediaHTTPService struct {
	configService   *ConfigService
	logger          *log.LogService
	cancelObservers []helper.CancelFunc

	rootMu   sync.RWMutex
	rootPath string
	now      func() time.Time
}

// ImageImportRequest describes an image import payload.
type ImageImportRequest struct {
	Filename   string `json:"filename,omitempty"`
	MimeType   string `json:"mime_type,omitempty"`
	Data       []byte `json:"data,omitempty"`
	DataBase64 string `json:"data_base64,omitempty"`
}

// ImageAsset describes one imported image asset.
type ImageAsset struct {
	ID               string `json:"id"`
	Filename         string `json:"filename"`
	OriginalFilename string `json:"original_filename,omitempty"`
	RelativePath     string `json:"relative_path"`
	URL              string `json:"url"`
	MimeType         string `json:"mime_type"`
	Size             int64  `json:"size"`
	Width            int    `json:"width"`
	Height           int    `json:"height"`
	SHA256           string `json:"sha256"`
	CreatedAt        string `json:"created_at"`
	UpdatedAt        string `json:"updated_at"`
}

// ImageDeleteResult describes the outcome of a delete operation.
type ImageDeleteResult struct {
	RelativePath string `json:"relative_path"`
	Deleted      bool   `json:"deleted"`
}

// NewMediaHTTPService creates a media HTTP service.
func NewMediaHTTPService(configService *ConfigService, logger *log.LogService) *MediaHTTPService {
	if logger == nil {
		logger = log.New()
	}

	return &MediaHTTPService{
		configService: configService,
		logger:        logger,
		now:           time.Now,
	}
}

// ServiceName returns the stable service identifier.
func (s *MediaHTTPService) ServiceName() string {
	return mediaServiceName
}

// ServiceStartup configures the service and starts config watchers.
func (s *MediaHTTPService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	_ = ctx
	_ = options

	if err := s.configureFromConfig(); err != nil {
		return err
	}

	if s.configService != nil {
		s.cancelObservers = []helper.CancelFunc{
			s.configService.Watch("general.dataPath", s.onDataPathChange),
		}
	}

	return nil
}

// ServiceShutdown stops config watchers.
func (s *MediaHTTPService) ServiceShutdown() error {
	for _, cancel := range s.cancelObservers {
		if cancel != nil {
			cancel()
		}
	}
	s.cancelObservers = nil
	return nil
}

// ServeHTTP serves configured media files under the mounted route prefix.
func (s *MediaHTTPService) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", http.MethodGet+", "+http.MethodHead)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	rootPath := s.currentRootPath()
	if rootPath == "" {
		http.Error(w, "media service is not configured", http.StatusServiceUnavailable)
		return
	}

	targetPath, err := resolveMediaPath(rootPath, r.URL.Path)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	info, err := os.Stat(targetPath)
	if err != nil {
		if os.IsNotExist(err) {
			http.NotFound(w, r)
			return
		}
		s.logger.Error("stat media file: %v", err)
		http.Error(w, "failed to read media", http.StatusInternalServerError)
		return
	}
	if info.IsDir() {
		http.NotFound(w, r)
		return
	}

	etag := buildMediaETag(info)
	if match := r.Header.Get(headerIfNoneMatch); match != "" && match == etag {
		w.Header().Set(headerETag, etag)
		w.WriteHeader(http.StatusNotModified)
		return
	}

	w.Header().Set(headerCacheControl, mediaCacheControl)
	w.Header().Set(headerETag, etag)
	w.Header().Set(headerXContentTypeOption, "nosniff")
	http.ServeFile(w, r, targetPath)
}

// ImportImage validates and stores an image under the date-based media tree.
func (s *MediaHTTPService) ImportImage(ctx context.Context, request *ImageImportRequest) (*ImageAsset, error) {
	_ = ctx

	if request == nil {
		return nil, fmt.Errorf("image import request is required")
	}

	rootPath := s.currentRootPath()
	if rootPath == "" {
		return nil, fmt.Errorf("media service is not configured")
	}

	data, err := normalizeImportData(request)
	if err != nil {
		return nil, err
	}

	mimeType, extension, width, height, digest, err := inspectImagePayload(data, request.MimeType, request.Filename)
	if err != nil {
		return nil, err
	}

	importedAt := s.now().UTC()
	relativeDir := imageRelativeDir(importedAt)
	absDir := filepath.Join(rootPath, filepath.FromSlash(relativeDir))
	if err := os.MkdirAll(absDir, 0755); err != nil {
		return nil, fmt.Errorf("create image directory: %w", err)
	}

	filename := buildStoredImageFilename(importedAt, digest, extension)
	relativePath := path.Join(relativeDir, filename)
	absImagePath := filepath.Join(rootPath, filepath.FromSlash(relativePath))
	if err := os.WriteFile(absImagePath, data, 0644); err != nil {
		return nil, fmt.Errorf("write image file: %w", err)
	}

	info, err := os.Stat(absImagePath)
	if err != nil {
		return nil, fmt.Errorf("stat image file: %w", err)
	}

	asset := &ImageAsset{
		ID:               strings.TrimSuffix(filename, extension),
		Filename:         filename,
		OriginalFilename: originalFilename(request.Filename),
		RelativePath:     relativePath,
		URL:              mediaURL(relativePath),
		MimeType:         mimeType,
		Size:             info.Size(),
		Width:            width,
		Height:           height,
		SHA256:           digest,
		CreatedAt:        importedAt.Format(time.RFC3339),
		UpdatedAt:        info.ModTime().UTC().Format(time.RFC3339),
	}

	if err := writeImageAssetMetadata(metadataPathForImage(absImagePath), asset); err != nil {
		return nil, err
	}

	return asset, nil
}

// ListImages returns all imported images ordered by creation time descending.
func (s *MediaHTTPService) ListImages(ctx context.Context) ([]*ImageAsset, error) {
	_ = ctx

	rootPath := s.currentRootPath()
	if rootPath == "" {
		return nil, fmt.Errorf("media service is not configured")
	}

	imagesRoot := filepath.Join(rootPath, mediaImagesDirName)
	assets := make([]*ImageAsset, 0)
	err := filepath.WalkDir(imagesRoot, func(entryPath string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			return nil
		}

		asset, err := readImageAssetMetadata(entryPath)
		if err != nil {
			s.logger.Warning("skip invalid image metadata %s: %v", entryPath, err)
			return nil
		}
		assets = append(assets, asset)
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("list images: %w", err)
	}

	sort.Slice(assets, func(i int, j int) bool {
		if assets[i].CreatedAt == assets[j].CreatedAt {
			return assets[i].RelativePath > assets[j].RelativePath
		}
		return assets[i].CreatedAt > assets[j].CreatedAt
	})

	return assets, nil
}

// DeleteImage removes one image file and its metadata sidecar.
func (s *MediaHTTPService) DeleteImage(ctx context.Context, imagePath string) (*ImageDeleteResult, error) {
	_ = ctx

	rootPath := s.currentRootPath()
	if rootPath == "" {
		return nil, fmt.Errorf("media service is not configured")
	}

	relativePath, err := normalizeImageReference(imagePath)
	if err != nil {
		return nil, err
	}

	absImagePath, err := resolveMediaPath(rootPath, relativePath)
	if err != nil {
		return nil, err
	}

	deleted := false
	if err := os.Remove(absImagePath); err != nil {
		if !os.IsNotExist(err) {
			return nil, fmt.Errorf("delete image file: %w", err)
		}
	} else {
		deleted = true
	}

	if err := os.Remove(metadataPathForImage(absImagePath)); err != nil && !os.IsNotExist(err) {
		return nil, fmt.Errorf("delete image metadata: %w", err)
	}

	return &ImageDeleteResult{
		RelativePath: relativePath,
		Deleted:      deleted,
	}, nil
}

func (s *MediaHTTPService) configureFromConfig() error {
	if s.configService == nil {
		return fmt.Errorf("media config service is not ready")
	}

	config, err := s.configService.GetConfig()
	if err != nil {
		return fmt.Errorf("load media config: %w", err)
	}

	return s.configureRootPath(mediaRootPath(config.General.DataPath))
}

func (s *MediaHTTPService) configureRootPath(rootPath string) error {
	if strings.TrimSpace(rootPath) == "" {
		return fmt.Errorf("media root path is required")
	}

	for _, dir := range []string{
		rootPath,
		filepath.Join(rootPath, mediaImagesDirName),
	} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("create media directory %s: %w", dir, err)
		}
	}

	s.rootMu.Lock()
	s.rootPath = rootPath
	s.rootMu.Unlock()

	s.logger.Info("media service configured", "rootPath", rootPath)
	return nil
}

func (s *MediaHTTPService) onDataPathChange(oldValue interface{}, newValue interface{}) {
	_, _ = oldValue, newValue
	if err := s.configureFromConfig(); err != nil {
		s.logger.Error("reconfigure media service after data path change: %v", err)
	}
}

func (s *MediaHTTPService) currentRootPath() string {
	s.rootMu.RLock()
	defer s.rootMu.RUnlock()
	return s.rootPath
}

func mediaRootPath(dataPath string) string {
	return filepath.Join(dataPath, mediaDirName)
}

func mediaURL(relativePath string) string {
	return path.Join(mediaServiceRoute, relativePath)
}

func imageRelativeDir(importedAt time.Time) string {
	return path.Join(
		mediaImagesDirName,
		importedAt.Format("2006"),
		importedAt.Format("01"),
		importedAt.Format("02"),
	)
}

func buildStoredImageFilename(importedAt time.Time, digest string, extension string) string {
	shortDigest := digest
	if len(shortDigest) > 12 {
		shortDigest = shortDigest[:12]
	}
	return fmt.Sprintf("%s_%s%s", importedAt.Format("20060102T150405Z"), shortDigest, extension)
}

func metadataPathForImage(imagePath string) string {
	return strings.TrimSuffix(imagePath, filepath.Ext(imagePath)) + ".json"
}

func normalizeImportData(request *ImageImportRequest) ([]byte, error) {
	if len(request.Data) > 0 {
		return request.Data, nil
	}

	payload := strings.TrimSpace(request.DataBase64)
	if payload == "" {
		return nil, fmt.Errorf("image data is required")
	}

	if commaIndex := strings.Index(payload, ","); strings.HasPrefix(payload, "data:") && commaIndex >= 0 {
		payload = payload[commaIndex+1:]
	}

	data, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		return nil, fmt.Errorf("decode image base64: %w", err)
	}
	if len(data) == 0 {
		return nil, fmt.Errorf("image data is required")
	}
	return data, nil
}

func inspectImagePayload(data []byte, declaredMime string, filename string) (string, string, int, int, string, error) {
	mimeType := http.DetectContentType(data)
	if strings.TrimSpace(declaredMime) != "" && strings.HasPrefix(strings.TrimSpace(declaredMime), "image/") {
		mimeType = strings.TrimSpace(declaredMime)
	}

	extension, ok := imageExtensionByMime(mimeType)
	if !ok {
		extension = strings.ToLower(filepath.Ext(filename))
		if !isSupportedImageExtension(extension) {
			return "", "", 0, 0, "", fmt.Errorf("unsupported image type: %s", mimeType)
		}
	}

	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return "", "", 0, 0, "", fmt.Errorf("decode image metadata: %w", err)
	}

	if mappedMime, ok := imageMimeByFormat(format); ok && !strings.HasPrefix(strings.ToLower(mimeType), "image/") {
		mimeType = mappedMime
	}
	if mappedExtension, ok := imageExtensionByFormat(format); ok {
		extension = mappedExtension
	}

	sum := sha256.Sum256(data)
	return mimeType, extension, config.Width, config.Height, hex.EncodeToString(sum[:]), nil
}

func writeImageAssetMetadata(metadataPath string, asset *ImageAsset) error {
	payload, err := json.MarshalIndent(asset, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal image metadata: %w", err)
	}
	payload = append(payload, '\n')
	if err := os.WriteFile(metadataPath, payload, 0644); err != nil {
		return fmt.Errorf("write image metadata: %w", err)
	}
	return nil
}

func readImageAssetMetadata(metadataPath string) (*ImageAsset, error) {
	payload, err := os.ReadFile(metadataPath)
	if err != nil {
		return nil, err
	}

	var asset ImageAsset
	if err := json.Unmarshal(payload, &asset); err != nil {
		return nil, err
	}
	if asset.RelativePath == "" {
		return nil, fmt.Errorf("missing relative path")
	}
	if asset.URL == "" {
		asset.URL = mediaURL(asset.RelativePath)
	}
	return &asset, nil
}

func normalizeImageReference(value string) (string, error) {
	clean := strings.TrimSpace(value)
	if clean == "" {
		return "", fmt.Errorf("image path is required")
	}
	if strings.HasPrefix(clean, mediaServiceRoute+"/") {
		clean = strings.TrimPrefix(clean, mediaServiceRoute+"/")
	}
	clean = strings.TrimPrefix(clean, "/")
	clean = strings.ReplaceAll(clean, `\`, "/")
	if !strings.HasPrefix(clean, mediaImagesDirName+"/") {
		return "", fmt.Errorf("invalid image path")
	}
	return clean, nil
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
	switch strings.ToLower(strings.TrimSpace(extension)) {
	case ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tiff", ".tif":
		return true
	default:
		return false
	}
}

func originalFilename(filename string) string {
	filename = strings.TrimSpace(filename)
	if filename == "" {
		return ""
	}
	return filepath.Base(filename)
}

func resolveMediaPath(rootPath string, requestPath string) (string, error) {
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

func buildMediaETag(info os.FileInfo) string {
	return fmt.Sprintf(`W/"%x-%x"`, info.Size(), info.ModTime().UnixNano())
}
