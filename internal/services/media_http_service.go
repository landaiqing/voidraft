package services

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"time"
	"voidraft/internal/common/helper"
	entmodel "voidraft/internal/models/ent"
	"voidraft/internal/models/ent/mediaasset"
	schemamixin "voidraft/internal/models/schema/mixin"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

const (
	mediaServiceRoute        = "/media"
	mediaDirName             = helper.MediaDirName
	mediaImagesDirName       = helper.MediaImagesDirName
	mediaCacheControl        = helper.MediaCacheControl
	mediaAssetBatchSize      = 256
	headerCacheControl       = helper.MediaHeaderCacheControl
	headerETag               = helper.MediaHeaderETag
	headerIfNoneMatch        = helper.MediaHeaderIfNoneMatch
	headerXContentTypeOption = helper.MediaHeaderXContentType
)

// MediaHTTPService serves media files and manages the indexed image store.
type MediaHTTPService struct {
	configService   *ConfigService
	dbService       *DatabaseService
	logger          *log.LogService
	mediaHelper     *helper.MediaHelper
	cancelObservers []helper.CancelFunc

	rootMu   sync.RWMutex
	rootPath string
	now      func() time.Time

	reconcileMu sync.Mutex
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
func NewMediaHTTPService(configService *ConfigService, logger *log.LogService, dbServices ...*DatabaseService) *MediaHTTPService {
	if logger == nil {
		logger = log.New()
	}

	var dbService *DatabaseService
	if len(dbServices) > 0 {
		dbService = dbServices[0]
	}

	return &MediaHTTPService{
		configService: configService,
		dbService:     dbService,
		logger:        logger,
		mediaHelper:   helper.NewMediaHelper(),
		now:           time.Now,
	}
}

// ServiceStartup configures the service and starts config watchers.
func (s *MediaHTTPService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	_ = options

	if err := s.configureFromConfig(); err != nil {
		return err
	}
	if err := s.reconcileMediaIndex(ctx); err != nil {
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

	client, rootPath, err := s.ensureDependencies()
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
		Only(schemamixin.SkipSoftDelete(ctx))
	if err != nil && !entmodel.IsNotFound(err) {
		return nil, fmt.Errorf("lookup image asset: %w", err)
	}
	if existing != nil {
		return s.importExistingImage(ctx, client, rootPath, existing, request, data, payload)
	}

	return s.createIndexedImage(ctx, client, rootPath, request, data, payload)
}

// DeleteImage removes one logical image asset and deletes its local file.
func (s *MediaHTTPService) DeleteImage(ctx context.Context, imageRef string) (*ImageDeleteResult, error) {
	client, rootPath, err := s.ensureDependencies()
	if err != nil {
		return nil, err
	}

	asset, err := s.findAssetByReference(ctx, imageRef, true)
	if err != nil {
		return nil, err
	}
	if asset == nil {
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
			RelativePath: relativePath,
			Deleted:      deleted,
		}, nil
	}
	if asset.DeletedAt != nil {
		return &ImageDeleteResult{
			RelativePath: asset.RelativePath,
			Deleted:      false,
		}, nil
	}

	_, absPath, err := s.mediaHelper.ResolveManagedImagePath(rootPath, asset.RelativePath, "")
	if err != nil {
		return nil, err
	}
	stagedPath, err := s.mediaHelper.StageFile(absPath, s.now().UTC())
	if err != nil {
		return nil, err
	}

	deletedAt := s.now().UTC().Format(time.RFC3339)
	if err := client.MediaAsset.UpdateOneID(asset.ID).
		SetDeletedAt(deletedAt).
		SetUpdatedAt(deletedAt).
		Exec(schemamixin.SkipAutoUpdate(ctx)); err != nil {
		rollbackErr := s.mediaHelper.RestoreStagedFile(absPath, stagedPath)
		return nil, helper.WrapRollbackError("logical delete image asset", err, rollbackErr)
	}

	if err := s.mediaHelper.DiscardStagedFile(stagedPath); err != nil {
		s.logger.Warning("discard staged image after delete %s: %v", stagedPath, err)
	}
	s.mediaHelper.TrimEmptyMediaDirs(rootPath, absPath)

	return &ImageDeleteResult{
		RelativePath: asset.RelativePath,
		Deleted:      true,
	}, nil
}

func (s *MediaHTTPService) importExistingImage(ctx context.Context, client *entmodel.Client, rootPath string, asset *entmodel.MediaAsset, request *ImageImportRequest, data []byte, payload *helper.ImagePayload) (*ImageAsset, error) {
	if asset == nil {
		return nil, fmt.Errorf("image asset is required")
	}
	if client == nil {
		return nil, fmt.Errorf("media index database is not configured")
	}

	originalName := coalesceOriginalFilename(asset.OriginalFilename, request.Filename)
	_, absPath, err := s.mediaHelper.ResolveManagedImagePath(rootPath, asset.RelativePath, "")
	if err != nil {
		return nil, err
	}

	switch {
	case asset.DeletedAt != nil:
		stagedPath, err := s.mediaHelper.StageFile(absPath, s.now().UTC())
		if err != nil {
			return nil, err
		}
		if err := s.mediaHelper.WriteBinaryFile(absPath, data); err != nil {
			rollbackErr := s.mediaHelper.RollbackFileChange(absPath, stagedPath)
			return nil, helper.WrapRollbackError("write restored image asset", err, rollbackErr)
		}
		if err := client.MediaAsset.UpdateOneID(asset.ID).
			ClearDeletedAt().
			SetMimeType(payload.MimeType).
			SetSize(int64(len(data))).
			SetWidth(payload.Width).
			SetHeight(payload.Height).
			SetNillableOriginalFilename(originalName).
			Exec(ctx); err != nil {
			rollbackErr := s.mediaHelper.RollbackFileChange(absPath, stagedPath)
			return nil, helper.WrapRollbackError("restore deleted image asset", err, rollbackErr)
		}
		if err := s.mediaHelper.DiscardStagedFile(stagedPath); err != nil {
			s.logger.Warning("discard staged image after restore %s: %v", stagedPath, err)
		}
		fresh, err := client.MediaAsset.Get(ctx, asset.ID)
		if err != nil {
			return nil, fmt.Errorf("reload restored image asset: %w", err)
		}
		return s.imageAssetFromEntity(fresh), nil

	case s.mediaHelper.FileExists(absPath):
		if asset.OriginalFilename == nil && originalName != nil {
			if err := client.MediaAsset.UpdateOneID(asset.ID).
				SetOriginalFilename(*originalName).
				Exec(schemamixin.SkipAutoUpdate(ctx)); err != nil {
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
		if asset.OriginalFilename == nil && originalName != nil {
			if err := client.MediaAsset.UpdateOneID(asset.ID).
				SetOriginalFilename(*originalName).
				Exec(schemamixin.SkipAutoUpdate(ctx)); err != nil {
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
	importedAt := s.now().UTC()
	relativePath, err := s.nextAvailableRelativePath(ctx, payload.Digest, payload.Extension, importedAt)
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
		SetNillableOriginalFilename(optionalString(originalFilename(request.Filename))).
		SetRelativePath(relativePath).
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
				Only(schemamixin.SkipSoftDelete(ctx))
			if lookupErr == nil && existing != nil {
				return s.importExistingImage(ctx, client, rootPath, existing, request, data, payload)
			}
		}
		return nil, fmt.Errorf("create image asset: %w", err)
	}

	return s.imageAssetFromEntity(asset), nil
}

func (s *MediaHTTPService) reconcileMediaIndex(ctx context.Context) error {
	s.reconcileMu.Lock()
	defer s.reconcileMu.Unlock()

	client, rootPath, err := s.ensureDependencies()
	if err != nil {
		return err
	}

	if err := s.walkIndexedMediaAssets(ctx, client, func(row *entmodel.MediaAsset) error {
		_, absPath, err := s.mediaHelper.ResolveManagedImagePath(rootPath, row.RelativePath, "")
		if err != nil {
			return err
		}
		if row.DeletedAt != nil {
			if removed, err := s.mediaHelper.RemoveImageArtifacts(absPath); err != nil {
				return err
			} else if removed {
				s.mediaHelper.TrimEmptyMediaDirs(rootPath, absPath)
			}
			if err := s.mediaHelper.DiscardStagedFiles(absPath); err != nil {
				return err
			}
			s.mediaHelper.TrimEmptyMediaDirs(rootPath, absPath)
			return nil
		}

		if s.mediaHelper.FileExists(absPath) {
			if err := s.mediaHelper.DiscardStagedFiles(absPath); err != nil {
				return err
			}
			return nil
		}
		if restored, err := s.mediaHelper.RestoreLatestStagedFile(absPath); err != nil {
			return err
		} else if restored {
			return nil
		}
		if err := s.hardDeleteAsset(schemamixin.SkipSoftDelete(ctx), row.ID); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return fmt.Errorf("query indexed media assets: %w", err)
	}
	return nil
}

func (s *MediaHTTPService) ensureDependencies() (*entmodel.Client, string, error) {
	if s.dbService == nil || s.dbService.Client == nil {
		return nil, "", fmt.Errorf("media index database is not configured")
	}

	rootPath := s.currentRootPath()
	if rootPath == "" {
		return nil, "", fmt.Errorf("media service is not configured")
	}

	return s.dbService.Client, rootPath, nil
}

func (s *MediaHTTPService) configureFromConfig() error {
	if s.configService == nil {
		return nil
	}

	config, err := s.configService.GetConfig()
	if err != nil {
		return fmt.Errorf("load media config: %w", err)
	}

	return s.configureRootPath(s.mediaHelper.RootPath(config.General.DataPath))
}

func (s *MediaHTTPService) configureRootPath(rootPath string) error {
	if err := s.mediaHelper.EnsureRoot(rootPath); err != nil {
		return err
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
		return
	}
	if err := s.reconcileMediaIndex(context.Background()); err != nil {
		s.logger.Error("reconcile media index after data path change: %v", err)
	}
}

func (s *MediaHTTPService) currentRootPath() string {
	s.rootMu.RLock()
	defer s.rootMu.RUnlock()
	return s.rootPath
}

func (s *MediaHTTPService) walkIndexedMediaAssets(ctx context.Context, client *entmodel.Client, visitor func(*entmodel.MediaAsset) error) error {
	lastAssetID := ""
	for {
		query := client.MediaAsset.Query().
			Order(mediaasset.ByAssetID()).
			Limit(mediaAssetBatchSize)
		if lastAssetID != "" {
			query = query.Where(mediaasset.AssetIDGT(lastAssetID))
		}

		rows, err := query.All(schemamixin.SkipSoftDelete(ctx))
		if err != nil {
			return err
		}
		if len(rows) == 0 {
			return nil
		}

		for _, row := range rows {
			if err := visitor(row); err != nil {
				return err
			}
		}
		lastAssetID = rows[len(rows)-1].AssetID
	}
}

func (s *MediaHTTPService) findAssetByReference(ctx context.Context, value string, includeDeleted bool) (*entmodel.MediaAsset, error) {
	client, _, err := s.ensureDependencies()
	if err != nil {
		return nil, err
	}

	clean := strings.TrimSpace(value)
	if clean == "" {
		return nil, fmt.Errorf("image path is required")
	}
	clean = strings.SplitN(clean, "#", 2)[0]
	clean = strings.SplitN(clean, "?", 2)[0]

	queryCtx := ctx
	if includeDeleted {
		queryCtx = schemamixin.SkipSoftDelete(ctx)
	}

	if relativePath, err := s.mediaHelper.NormalizeImageReference(clean, mediaServiceRoute); err == nil {
		asset, err := client.MediaAsset.Query().
			Where(mediaasset.RelativePathEQ(relativePath)).
			Only(queryCtx)
		if entmodel.IsNotFound(err) {
			return nil, nil
		}
		if err != nil {
			return nil, fmt.Errorf("lookup image asset by path: %w", err)
		}
		return asset, nil
	}

	if !s.mediaHelper.IsValidAssetID(clean) {
		return nil, fmt.Errorf("invalid image asset id")
	}

	asset, err := client.MediaAsset.Query().
		Where(mediaasset.AssetIDEQ(clean)).
		Only(queryCtx)
	if entmodel.IsNotFound(err) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("lookup image asset by id: %w", err)
	}
	return asset, nil
}

func (s *MediaHTTPService) nextAvailableRelativePath(ctx context.Context, digest string, extension string, importedAt time.Time) (string, error) {
	client, rootPath, err := s.ensureDependencies()
	if err != nil {
		return "", err
	}

	relativeDir := s.mediaHelper.ImageRelativeDir(importedAt)
	filename := s.mediaHelper.BuildStoredImageFilename(digest, extension)
	relativePath := path.Join(relativeDir, filename)

	existsInIndex, err := client.MediaAsset.Query().
		Where(mediaasset.RelativePathEQ(relativePath)).
		Exist(schemamixin.SkipSoftDelete(ctx))
	if err != nil {
		return "", fmt.Errorf("check media path collision: %w", err)
	}
	if existsInIndex {
		return "", fmt.Errorf("managed media path already indexed: %s", relativePath)
	}

	_, absPath, err := s.mediaHelper.ResolveManagedImagePath(rootPath, relativePath, "")
	if err != nil {
		return "", err
	}
	if _, err := os.Stat(absPath); err == nil {
		data, readErr := os.ReadFile(absPath)
		if readErr != nil {
			return "", fmt.Errorf("read existing managed media path: %w", readErr)
		}
		payload, inspectErr := s.mediaHelper.InspectImagePayload(data, "", filepath.Base(absPath))
		if inspectErr != nil {
			return "", fmt.Errorf("inspect existing managed media path: %w", inspectErr)
		}
		if payload.Digest != digest || payload.Extension != strings.ToLower(filepath.Ext(absPath)) {
			return "", fmt.Errorf("managed media path occupied by unexpected file: %s", relativePath)
		}
		return relativePath, nil
	} else if !os.IsNotExist(err) {
		return "", fmt.Errorf("stat candidate media path: %w", err)
	}

	return relativePath, nil
}

func (s *MediaHTTPService) hardDeleteAsset(ctx context.Context, id int) error {
	if err := s.dbService.Client.MediaAsset.DeleteOneID(id).Exec(schemamixin.SkipSoftDelete(ctx)); err != nil && !entmodel.IsNotFound(err) {
		return fmt.Errorf("delete media asset index row: %w", err)
	}
	return nil
}

func buildMediaETag(info os.FileInfo) string {
	return helper.NewMediaHelper().BuildETag(info)
}

func (s *MediaHTTPService) imageAssetFromEntity(asset *entmodel.MediaAsset) *ImageAsset {
	if asset == nil {
		return nil
	}

	result := &ImageAsset{
		ID:           asset.AssetID,
		Filename:     path.Base(asset.RelativePath),
		RelativePath: asset.RelativePath,
		URL:          s.mediaHelper.URL(mediaServiceRoute, asset.RelativePath),
		MimeType:     asset.MimeType,
		Size:         asset.Size,
		Width:        asset.Width,
		Height:       asset.Height,
		SHA256:       asset.AssetID,
		CreatedAt:    asset.CreatedAt,
		UpdatedAt:    asset.UpdatedAt,
	}
	if asset.OriginalFilename != nil {
		result.OriginalFilename = *asset.OriginalFilename
	}
	return result
}

func coalesceOriginalFilename(existing *string, imported string) *string {
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
