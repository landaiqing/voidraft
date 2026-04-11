package services

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"
	"voidraft/internal/common/helper"
	entmodel "voidraft/internal/models/ent"
	"voidraft/internal/models/ent/mediaasset"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

const (
	mediaServiceRoute        = "/media"
	mediaDirName             = helper.MediaDirName
	mediaCacheControl        = helper.MediaCacheControl
	headerCacheControl       = helper.MediaHeaderCacheControl
	headerETag               = helper.MediaHeaderETag
	headerIfNoneMatch        = helper.MediaHeaderIfNoneMatch
	headerXContentTypeOption = helper.MediaHeaderXContentType
)

// MediaHTTPService 负责媒体上传、删除和 HTTP 文件访问。
type MediaHTTPService struct {
	configService   *ConfigService
	dbService       *DatabaseService
	logger          *log.LogService
	mediaHelper     *helper.MediaHelper
	mediaReferences *MediaReferenceService
	syncService     *MediaSyncService
	now             func() time.Time
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
	ID        string `json:"id"`
	Filename  string `json:"filename,omitempty"`
	Path      string `json:"path"`
	URL       string `json:"url"`
	MimeType  string `json:"mime_type"`
	Size      int64  `json:"size"`
	Width     int    `json:"width"`
	Height    int    `json:"height"`
	SHA256    string `json:"sha256"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// ImageDeleteResult describes the outcome of a delete operation.
type ImageDeleteResult struct {
	Path    string `json:"path"`
	Deleted bool   `json:"deleted"`
}

// NewMediaHTTPService creates a media HTTP service.
func NewMediaHTTPService(configService *ConfigService, logger *log.LogService, dbService *DatabaseService, syncService *MediaSyncService) *MediaHTTPService {
	if logger == nil {
		logger = log.New()
	}

	service := &MediaHTTPService{
		configService: configService,
		dbService:     dbService,
		logger:        logger,
		syncService:   syncService,
		mediaHelper:   helper.NewMediaHelper(),
		now:           time.Now,
	}
	if service.syncService != nil {
		service.mediaReferences = service.syncService.mediaReferences
	}

	return service
}

// ServiceStartup keeps the HTTP service lightweight. Root state is managed by MediaSyncService.
func (s *MediaHTTPService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	_, _ = ctx, options
	if s.syncService == nil {
		return fmt.Errorf("media sync service is not configured")
	}
	return nil
}

func (s *MediaHTTPService) ServiceShutdown() error {
	return nil
}

// ServeHTTP serves configured media files under the mounted route prefix.
func (s *MediaHTTPService) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", http.MethodGet+", "+http.MethodHead)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	syncService, err := s.requireSyncService()
	if err != nil {
		http.Error(w, "media service is not configured", http.StatusServiceUnavailable)
		return
	}

	rootPath, _ := syncService.currentRootState()
	if rootPath == "" {
		http.Error(w, "media service is not configured", http.StatusServiceUnavailable)
		return
	}

	_, targetPath, err := s.mediaHelper.ResolveManagedImagePath(rootPath, r.URL.Path, "")
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

// ImportImage validates and stores an image in the indexed media store.
func (s *MediaHTTPService) ImportImage(ctx context.Context, request *ImageImportRequest) (*ImageAsset, error) {
	if request == nil {
		return nil, fmt.Errorf("image import request is required")
	}

	syncService, err := s.requireSyncService()
	if err != nil {
		return nil, err
	}

	client, rootPath, err := syncService.ensureDependencies()
	if err != nil {
		return nil, err
	}

	data, err := s.mediaHelper.NormalizeImportData(request.Data, request.DataBase64)
	if err != nil {
		return nil, err
	}

	payload, err := s.mediaHelper.InspectImagePayload(data, request.MimeType, request.Filename)
	if err != nil {
		return nil, err
	}

	existing, err := client.MediaAsset.Query().
		Where(mediaasset.AssetIDEQ(payload.Digest)).
		Only(ctx)
	if err != nil && !entmodel.IsNotFound(err) {
		return nil, fmt.Errorf("lookup image asset: %w", err)
	}
	if existing != nil {
		return s.importExistingImage(ctx, client, rootPath, existing, request, data, payload)
	}

	return s.createIndexedImage(ctx, client, rootPath, request, data, payload)
}

// DeleteImage permanently removes one indexed image asset and its local file when no active document still references it.
func (s *MediaHTTPService) DeleteImage(ctx context.Context, imageRef string) (*ImageDeleteResult, error) {
	syncService, err := s.requireSyncService()
	if err != nil {
		return nil, err
	}

	_, rootPath, err := syncService.ensureDependencies()
	if err != nil {
		return nil, err
	}
	rootVersion := syncService.currentRootVersion()

	asset, err := syncService.findAssetByReference(ctx, imageRef)
	if err != nil {
		return nil, err
	}
	if asset == nil {
		if rootVersion != syncService.currentRootVersion() {
			return &ImageDeleteResult{Deleted: false}, nil
		}
		relativePath, absPath, pathErr := s.mediaHelper.ResolveManagedImagePath(rootPath, imageRef, mediaServiceRoute)
		if pathErr != nil {
			return &ImageDeleteResult{Deleted: false}, nil
		}
		deleted, err := s.mediaHelper.RemoveImageArtifacts(absPath)
		if err != nil {
			return nil, err
		}
		if deleted {
			s.mediaHelper.TrimEmptyMediaDirs(rootPath, absPath)
		}
		return &ImageDeleteResult{
			Path:    relativePath,
			Deleted: deleted,
		}, nil
	}

	referenced, err := syncService.isAssetReferencedByActiveDocuments(ctx, asset)
	if err != nil {
		return nil, err
	}
	if referenced {
		return &ImageDeleteResult{
			Path:    asset.Path,
			Deleted: false,
		}, nil
	}

	return syncService.deleteAssetEntityIfVersionMatches(ctx, asset, rootVersion)
}

func (s *MediaHTTPService) importExistingImage(ctx context.Context, client *entmodel.Client, rootPath string, asset *entmodel.MediaAsset, request *ImageImportRequest, data []byte, payload *helper.ImagePayload) (*ImageAsset, error) {
	if asset == nil {
		return nil, fmt.Errorf("image asset is required")
	}
	if client == nil {
		return nil, fmt.Errorf("media index database is not configured")
	}

	filename := coalesceFilename(asset.Filename, request.Filename)
	_, absPath, err := s.mediaHelper.ResolveManagedImagePath(rootPath, asset.Path, "")
	if err != nil {
		return nil, err
	}

	switch {
	case s.mediaHelper.FileExists(absPath):
		if asset.Filename == nil && filename != nil {
			if err := client.MediaAsset.UpdateOneID(asset.ID).
				SetFilename(*filename).
				Exec(ctx); err != nil {
				return nil, fmt.Errorf("repair indexed image asset: %w", err)
			}
			fresh, err := client.MediaAsset.Get(ctx, asset.ID)
			if err != nil {
				return nil, fmt.Errorf("reload repaired image asset: %w", err)
			}
			return s.imageAssetFromEntity(fresh), nil
		}
		return s.imageAssetFromEntity(asset), nil

	default:
		if err := s.mediaHelper.WriteBinaryFile(absPath, data); err != nil {
			return nil, err
		}
		if asset.Filename == nil && filename != nil {
			if err := client.MediaAsset.UpdateOneID(asset.ID).
				SetFilename(*filename).
				Exec(ctx); err != nil {
				return nil, fmt.Errorf("repair image asset filename: %w", err)
			}
			fresh, err := client.MediaAsset.Get(ctx, asset.ID)
			if err != nil {
				return nil, fmt.Errorf("reload repaired image asset: %w", err)
			}
			return s.imageAssetFromEntity(fresh), nil
		}
		return s.imageAssetFromEntity(asset), nil
	}
}

func (s *MediaHTTPService) createIndexedImage(ctx context.Context, client *entmodel.Client, rootPath string, request *ImageImportRequest, data []byte, payload *helper.ImagePayload) (*ImageAsset, error) {
	syncService, err := s.requireSyncService()
	if err != nil {
		return nil, err
	}

	importedAt := s.now().UTC()
	relativePath, err := syncService.nextAvailableRelativePath(ctx, payload.Digest, payload.Extension, importedAt)
	if err != nil {
		return nil, err
	}

	_, absPath, err := s.mediaHelper.ResolveManagedImagePath(rootPath, relativePath, "")
	if err != nil {
		return nil, err
	}
	if err := s.mediaHelper.WriteBinaryFile(absPath, data); err != nil {
		return nil, err
	}

	asset, err := client.MediaAsset.Create().
		SetAssetID(payload.Digest).
		SetNillableFilename(optionalString(originalFilename(request.Filename))).
		SetPath(relativePath).
		SetMimeType(payload.MimeType).
		SetSize(int64(len(data))).
		SetWidth(payload.Width).
		SetHeight(payload.Height).
		SetCreatedAt(importedAt.Format(time.RFC3339)).
		SetUpdatedAt(importedAt.Format(time.RFC3339)).
		Save(ctx)
	if err != nil {
		_, _ = s.mediaHelper.RemoveImageArtifacts(absPath)
		if entmodel.IsConstraintError(err) {
			existing, lookupErr := client.MediaAsset.Query().
				Where(mediaasset.AssetIDEQ(payload.Digest)).
				Only(ctx)
			if lookupErr == nil && existing != nil {
				return s.importExistingImage(ctx, client, rootPath, existing, request, data, payload)
			}
		}
		return nil, fmt.Errorf("create image asset: %w", err)
	}

	return s.imageAssetFromEntity(asset), nil
}

func (s *MediaHTTPService) requireSyncService() (*MediaSyncService, error) {
	if s.syncService == nil {
		return nil, fmt.Errorf("media sync service is not configured")
	}
	return s.syncService, nil
}

func (s *MediaHTTPService) configureRootPath(rootPath string) error {
	syncService, err := s.requireSyncService()
	if err != nil {
		return err
	}
	return syncService.configureRootPath(rootPath)
}

func (s *MediaHTTPService) currentRootVersion() uint64 {
	if s.syncService == nil {
		return 0
	}
	return s.syncService.currentRootVersion()
}

func (s *MediaHTTPService) reconcileMediaIndex(ctx context.Context) error {
	syncService, err := s.requireSyncService()
	if err != nil {
		return err
	}
	return syncService.reconcileMediaIndex(ctx)
}

func (s *MediaHTTPService) cleanupRemovedMediaReferences(ctx context.Context, refs []MediaReference, expectedRootVersion uint64) error {
	syncService, err := s.requireSyncService()
	if err != nil {
		return err
	}
	return syncService.cleanupRemovedMediaReferences(ctx, refs, expectedRootVersion)
}

func (s *MediaHTTPService) sweepOrphanedAssets(ctx context.Context, expectedRootVersion uint64) error {
	syncService, err := s.requireSyncService()
	if err != nil {
		return err
	}
	return syncService.sweepOrphanedAssets(ctx, expectedRootVersion)
}

func buildMediaETag(info os.FileInfo) string {
	return helper.NewMediaHelper().BuildETag(info)
}

func (s *MediaHTTPService) imageAssetFromEntity(asset *entmodel.MediaAsset) *ImageAsset {
	if asset == nil {
		return nil
	}

	result := &ImageAsset{
		ID:        asset.AssetID,
		Filename:  path.Base(asset.Path),
		Path:      asset.Path,
		URL:       s.mediaHelper.URL(mediaServiceRoute, asset.Path),
		MimeType:  asset.MimeType,
		Size:      asset.Size,
		Width:     asset.Width,
		Height:    asset.Height,
		SHA256:    asset.AssetID,
		CreatedAt: asset.CreatedAt,
		UpdatedAt: asset.UpdatedAt,
	}
	if asset.Filename != nil && strings.TrimSpace(*asset.Filename) != "" {
		result.Filename = *asset.Filename
	}
	return result
}

func coalesceFilename(existing *string, imported string) *string {
	if existing != nil && strings.TrimSpace(*existing) != "" {
		value := strings.TrimSpace(*existing)
		return &value
	}
	return optionalString(originalFilename(imported))
}

func optionalString(value string) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return &value
}

func originalFilename(filename string) string {
	filename = strings.TrimSpace(filename)
	if filename == "" {
		return ""
	}
	return filepath.Base(filename)
}
