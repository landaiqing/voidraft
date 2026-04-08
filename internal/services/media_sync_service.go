package services

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
	"voidraft/internal/common/helper"
	entmodel "voidraft/internal/models/ent"
	"voidraft/internal/models/ent/document"
	"voidraft/internal/models/ent/mediaasset"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

const (
	mediaImagesDirName     = helper.MediaImagesDirName
	mediaAssetBatchSize    = 256
	mediaDocumentBatchSize = 64
	mediaCleanupQueueSize  = 128
	mediaCleanupJobTimeout = 2 * time.Minute
)

type orphanCleanupKind uint8

const (
	orphanCleanupCandidates orphanCleanupKind = iota + 1
	orphanCleanupSweep
)

type orphanCleanupRequest struct {
	kind        orphanCleanupKind
	refs        []MediaReference
	rootVersion uint64
	reason      string
}

var errMediaCleanupRootChanged = errors.New("media cleanup root changed")

// MediaSyncService 管理媒体根目录状态、索引修复和孤儿资源清理。
type MediaSyncService struct {
	configService   *ConfigService
	dbService       *DatabaseService
	logger          *log.LogService
	mediaHelper     *helper.MediaHelper
	mediaReferences *MediaReferenceService
	cancelObservers []helper.CancelFunc

	rootMu      sync.RWMutex
	rootPath    string
	rootVersion uint64

	reconcileMu sync.Mutex

	cleanupWorkerMu     sync.Mutex
	cleanupJobs         chan orphanCleanupRequest
	cleanupCtx          context.Context
	cleanupCancel       context.CancelFunc
	cleanupWG           sync.WaitGroup
	cleanupSweepPending bool
}

func NewMediaSyncService(configService *ConfigService, logger *log.LogService, dbService *DatabaseService) *MediaSyncService {
	if logger == nil {
		logger = log.New()
	}

	return &MediaSyncService{
		configService:   configService,
		dbService:       dbService,
		logger:          logger,
		mediaHelper:     helper.NewMediaHelper(),
		mediaReferences: NewMediaReferenceService(),
		cleanupJobs:     make(chan orphanCleanupRequest, mediaCleanupQueueSize),
	}
}

func (s *MediaSyncService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	_ = options

	s.ensureCleanupWorkerStarted()

	if err := s.configureFromConfig(); err != nil {
		return err
	}
	if err := s.reconcileMediaIndex(ctx); err != nil {
		return err
	}
	s.scheduleFullOrphanSweep("service startup")

	if s.configService != nil {
		s.cancelObservers = []helper.CancelFunc{
			s.configService.Watch("general.dataPath", s.onDataPathChange),
		}
	}

	return nil
}

func (s *MediaSyncService) ServiceShutdown() error {
	for _, cancel := range s.cancelObservers {
		if cancel != nil {
			cancel()
		}
	}
	s.cancelObservers = nil
	s.stopCleanupWorker()
	return nil
}

func (s *MediaSyncService) scheduleOrphanCleanupForDeletedContent(content string) {
	if strings.TrimSpace(content) == "" {
		return
	}
	s.enqueueCleanup(orphanCleanupRequest{
		kind:        orphanCleanupCandidates,
		refs:        s.mediaReferences.DiffRemovedReferences(content, ""),
		rootVersion: s.currentRootVersion(),
		reason:      "document delete",
	})
}

func (s *MediaSyncService) scheduleFullOrphanSweep(reason string) {
	s.enqueueCleanup(orphanCleanupRequest{
		kind:        orphanCleanupSweep,
		rootVersion: s.currentRootVersion(),
		reason:      reason,
	})
}

func (s *MediaSyncService) ensureCleanupWorkerStarted() {
	s.cleanupWorkerMu.Lock()
	defer s.cleanupWorkerMu.Unlock()

	if s.cleanupCancel != nil {
		return
	}

	s.cleanupCtx, s.cleanupCancel = context.WithCancel(context.Background())
	s.cleanupWG.Add(1)
	go s.runCleanupWorker(s.cleanupCtx)
}

func (s *MediaSyncService) stopCleanupWorker() {
	s.cleanupWorkerMu.Lock()
	cancel := s.cleanupCancel
	s.cleanupCancel = nil
	s.cleanupCtx = nil
	s.cleanupWorkerMu.Unlock()

	if cancel != nil {
		cancel()
	}
	s.cleanupWG.Wait()
}

func (s *MediaSyncService) enqueueCleanup(request orphanCleanupRequest) {
	if request.kind == orphanCleanupCandidates && len(request.refs) == 0 {
		return
	}

	s.ensureCleanupWorkerStarted()

	s.cleanupWorkerMu.Lock()
	ctx := s.cleanupCtx
	if request.kind == orphanCleanupSweep {
		if s.cleanupSweepPending {
			s.cleanupWorkerMu.Unlock()
			return
		}
		s.cleanupSweepPending = true
	}
	s.cleanupWorkerMu.Unlock()
	if ctx == nil {
		return
	}

	if request.kind == orphanCleanupSweep {
		go func() {
			select {
			case s.cleanupJobs <- request:
			case <-ctx.Done():
			}
		}()
		return
	}

	select {
	case s.cleanupJobs <- request:
	default:
		s.logger.Warning("drop orphan cleanup request: queue is full, reason=%s", request.reason)
		s.scheduleFullOrphanSweep("cleanup queue saturation")
	}
}

func (s *MediaSyncService) runCleanupWorker(ctx context.Context) {
	defer s.cleanupWG.Done()

	for {
		select {
		case <-ctx.Done():
			return
		case request := <-s.cleanupJobs:
			jobCtx, cancel := context.WithTimeout(ctx, mediaCleanupJobTimeout)
			s.processCleanupRequest(jobCtx, request)
			cancel()
		}
	}
}

func (s *MediaSyncService) processCleanupRequest(ctx context.Context, request orphanCleanupRequest) {
	if request.kind == orphanCleanupSweep {
		defer s.setCleanupSweepPending(false)
	}

	if request.rootVersion == 0 {
		return
	}
	if request.rootVersion != s.currentRootVersion() {
		s.logger.Info("skip orphan cleanup request due to root version change", "reason", request.reason)
		return
	}

	var err error
	switch request.kind {
	case orphanCleanupCandidates:
		err = s.cleanupRemovedMediaReferences(ctx, request.refs, request.rootVersion)
	case orphanCleanupSweep:
		err = s.sweepOrphanedAssets(ctx, request.rootVersion)
	default:
		return
	}
	if err != nil && ctx.Err() == nil {
		s.logger.Error("process orphan cleanup request: %v", err)
	}
}

func (s *MediaSyncService) setCleanupSweepPending(pending bool) {
	s.cleanupWorkerMu.Lock()
	s.cleanupSweepPending = pending
	s.cleanupWorkerMu.Unlock()
}

func (s *MediaSyncService) reconcileMediaIndex(ctx context.Context) error {
	s.reconcileMu.Lock()
	defer s.reconcileMu.Unlock()

	client, rootPath, err := s.ensureDependencies()
	if err != nil {
		return err
	}

	if err := s.walkIndexedMediaAssets(ctx, client, func(row *entmodel.MediaAsset) error {
		_, absPath, err := s.mediaHelper.ResolveManagedImagePath(rootPath, row.Path, "")
		if err != nil {
			return err
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
		if err := s.hardDeleteAsset(ctx, row.ID); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return fmt.Errorf("query indexed media assets: %w", err)
	}
	return nil
}

func (s *MediaSyncService) cleanupRemovedMediaReferences(ctx context.Context, refs []MediaReference, expectedRootVersion uint64) error {
	if len(refs) == 0 || expectedRootVersion == 0 || expectedRootVersion != s.currentRootVersion() {
		return nil
	}

	candidates, err := s.resolveCandidateAssets(ctx, refs)
	if err != nil {
		return err
	}
	if len(candidates) == 0 {
		return nil
	}

	referencedIDs, err := s.findReferencedCandidateAssetIDs(ctx, candidates)
	if err != nil {
		return err
	}

	for id, asset := range candidates {
		if _, exists := referencedIDs[id]; exists {
			continue
		}
		if _, err := s.deleteAssetEntityIfVersionMatches(ctx, asset, expectedRootVersion); err != nil && ctx.Err() == nil {
			s.logger.Error("delete orphaned image asset %s: %v", asset.AssetID, err)
		}
	}
	return nil
}

func (s *MediaSyncService) sweepOrphanedAssets(ctx context.Context, expectedRootVersion uint64) error {
	rootPath, currentVersion := s.currentRootState()
	if rootPath == "" || expectedRootVersion == 0 || expectedRootVersion != currentVersion {
		return nil
	}

	referencedKeys, err := s.collectAllReferencedMediaKeys(ctx)
	if err != nil {
		return err
	}

	client, err := s.databaseClient()
	if err != nil {
		return err
	}

	err = s.walkIndexedMediaAssets(ctx, client, func(row *entmodel.MediaAsset) error {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if s.currentRootVersion() != expectedRootVersion {
			return errMediaCleanupRootChanged
		}
		if _, exists := referencedKeys[(MediaReference{Kind: MediaReferenceKindImage, AssetID: row.AssetID}).key()]; exists {
			return nil
		}
		if _, exists := referencedKeys[(MediaReference{Kind: MediaReferenceKindImage, Path: row.Path}).key()]; exists {
			return nil
		}
		if _, err := s.deleteAssetEntityIfVersionMatches(ctx, row, expectedRootVersion); err != nil && ctx.Err() == nil {
			s.logger.Error("delete swept orphaned image asset %s: %v", row.AssetID, err)
		}
		return nil
	})
	if err != nil {
		if errors.Is(err, errMediaCleanupRootChanged) {
			return nil
		}
		return err
	}

	indexedPaths, err := s.collectIndexedMediaPaths(ctx, client, expectedRootVersion)
	if err != nil {
		if errors.Is(err, errMediaCleanupRootChanged) {
			return nil
		}
		return err
	}

	if err := s.sweepUnindexedMediaFiles(ctx, rootPath, indexedPaths, expectedRootVersion); err != nil {
		if errors.Is(err, errMediaCleanupRootChanged) {
			return nil
		}
		return err
	}
	return nil
}

func (s *MediaSyncService) collectIndexedMediaPaths(ctx context.Context, client *entmodel.Client, expectedRootVersion uint64) (map[string]struct{}, error) {
	indexedPaths := make(map[string]struct{})
	if client == nil {
		return indexedPaths, nil
	}

	err := s.walkIndexedMediaAssets(ctx, client, func(row *entmodel.MediaAsset) error {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if expectedRootVersion != 0 && s.currentRootVersion() != expectedRootVersion {
			return errMediaCleanupRootChanged
		}
		if cleanPath := strings.TrimSpace(row.Path); cleanPath != "" {
			indexedPaths[cleanPath] = struct{}{}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return indexedPaths, nil
}

func (s *MediaSyncService) sweepUnindexedMediaFiles(ctx context.Context, rootPath string, indexedPaths map[string]struct{}, expectedRootVersion uint64) error {
	if strings.TrimSpace(rootPath) == "" || expectedRootVersion == 0 || s.currentRootVersion() != expectedRootVersion {
		return nil
	}

	imagesRoot := filepath.Join(rootPath, mediaImagesDirName)
	info, err := os.Stat(imagesRoot)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("stat managed images root: %w", err)
	}
	if !info.IsDir() {
		return fmt.Errorf("managed images root is not a directory: %s", imagesRoot)
	}

	dirs := make([]string, 0, 32)
	deletedFiles := 0
	walkErr := filepath.WalkDir(imagesRoot, func(entryPath string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if s.currentRootVersion() != expectedRootVersion {
			return errMediaCleanupRootChanged
		}

		if entry.IsDir() {
			if entryPath != imagesRoot {
				dirs = append(dirs, entryPath)
			}
			return nil
		}
		if !entry.Type().IsRegular() || isManagedMediaStagedFile(entry.Name()) {
			return nil
		}

		relativePath, err := filepath.Rel(rootPath, entryPath)
		if err != nil {
			return fmt.Errorf("resolve managed media relative path: %w", err)
		}
		if relativePath == ".." || strings.HasPrefix(relativePath, ".."+string(os.PathSeparator)) {
			return fmt.Errorf("managed media file escapes root: %s", entryPath)
		}

		normalizedPath := filepath.ToSlash(relativePath)
		if !strings.HasPrefix(normalizedPath, mediaImagesDirName+"/") {
			return nil
		}
		if _, exists := indexedPaths[normalizedPath]; exists {
			return nil
		}

		deleted, err := s.mediaHelper.RemoveImageArtifacts(entryPath)
		if err != nil {
			return err
		}
		if deleted {
			deletedFiles++
			s.mediaHelper.TrimEmptyMediaDirs(rootPath, entryPath)
		}
		return nil
	})
	if walkErr != nil {
		return walkErr
	}

	sort.Slice(dirs, func(i int, j int) bool {
		return len(dirs[i]) > len(dirs[j])
	})

	deletedDirs := 0
	for _, dirPath := range dirs {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if s.currentRootVersion() != expectedRootVersion {
			return errMediaCleanupRootChanged
		}
		if err := os.Remove(dirPath); err == nil {
			deletedDirs++
		} else if !os.IsNotExist(err) {
			continue
		}
	}

	if deletedFiles > 0 || deletedDirs > 0 {
		s.logger.Info(
			"swept unindexed managed media files",
			"files", deletedFiles,
			"dirs", deletedDirs,
		)
	}
	return nil
}

func isManagedMediaStagedFile(name string) bool {
	name = strings.TrimSpace(name)
	return strings.HasPrefix(name, ".") && strings.Contains(name, helper.MediaStagedFileMarker)
}

func (s *MediaSyncService) resolveCandidateAssets(ctx context.Context, refs []MediaReference) (map[int]*entmodel.MediaAsset, error) {
	assets := make(map[int]*entmodel.MediaAsset, len(refs))
	for _, ref := range refs {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}

		lookup := ref.AssetID
		if lookup == "" {
			lookup = ref.Path
		}
		if lookup == "" {
			continue
		}

		asset, err := s.findAssetByReference(ctx, lookup)
		if err != nil {
			return nil, err
		}
		if asset == nil {
			continue
		}
		assets[asset.ID] = asset
	}
	return assets, nil
}

func (s *MediaSyncService) findReferencedCandidateAssetIDs(ctx context.Context, candidates map[int]*entmodel.MediaAsset) (map[int]struct{}, error) {
	candidateByAssetID := make(map[string]int, len(candidates))
	candidateByPath := make(map[string]int, len(candidates))
	for id, asset := range candidates {
		candidateByAssetID[asset.AssetID] = id
		candidateByPath[asset.Path] = id
	}

	referenced := make(map[int]struct{}, len(candidates))
	err := s.scanActiveDocuments(ctx, func(docRow *entmodel.Document) (bool, error) {
		s.mediaReferences.VisitReferences(docRow.Content, func(ref MediaReference) bool {
			if ref.AssetID != "" {
				if assetID, exists := candidateByAssetID[ref.AssetID]; exists {
					referenced[assetID] = struct{}{}
				}
			}
			if ref.Path != "" {
				if assetID, exists := candidateByPath[ref.Path]; exists {
					referenced[assetID] = struct{}{}
				}
			}
			return len(referenced) == len(candidates)
		})
		return len(referenced) == len(candidates), nil
	})
	if err != nil {
		return nil, err
	}

	return referenced, nil
}

func (s *MediaSyncService) collectAllReferencedMediaKeys(ctx context.Context) (map[string]struct{}, error) {
	referenced := make(map[string]struct{})
	err := s.scanActiveDocuments(ctx, func(docRow *entmodel.Document) (bool, error) {
		s.mediaReferences.VisitReferences(docRow.Content, func(ref MediaReference) bool {
			if key := ref.key(); key != "" {
				referenced[key] = struct{}{}
			}
			return false
		})
		return false, nil
	})
	if err != nil {
		return nil, err
	}
	return referenced, nil
}

func (s *MediaSyncService) scanActiveDocuments(ctx context.Context, visitor func(*entmodel.Document) (bool, error)) error {
	client, err := s.databaseClient()
	if err != nil {
		return err
	}

	lastID := 0
	for {
		query := client.Document.Query().
			Select(document.FieldID, document.FieldContent).
			Order(document.ByID()).
			Limit(mediaDocumentBatchSize)
		if lastID > 0 {
			query = query.Where(document.IDGT(lastID))
		}

		rows, err := query.All(ctx)
		if err != nil {
			return fmt.Errorf("query documents for media reference scan: %w", err)
		}
		if len(rows) == 0 {
			return nil
		}

		for _, row := range rows {
			stop, err := visitor(row)
			if err != nil {
				return err
			}
			if stop {
				return nil
			}
		}
		lastID = rows[len(rows)-1].ID
	}
}

func (s *MediaSyncService) isAssetReferencedByActiveDocuments(ctx context.Context, asset *entmodel.MediaAsset) (bool, error) {
	if asset == nil {
		return false, nil
	}

	referenced, err := s.findReferencedCandidateAssetIDs(ctx, map[int]*entmodel.MediaAsset{
		asset.ID: asset,
	})
	if err != nil {
		return false, err
	}
	_, exists := referenced[asset.ID]
	return exists, nil
}

func (s *MediaSyncService) deleteAssetEntityIfVersionMatches(ctx context.Context, asset *entmodel.MediaAsset, expectedRootVersion uint64) (*ImageDeleteResult, error) {
	if asset == nil {
		return &ImageDeleteResult{Deleted: false}, nil
	}

	rootPath, currentVersion := s.currentRootState()
	if rootPath == "" || expectedRootVersion == 0 || currentVersion != expectedRootVersion {
		return &ImageDeleteResult{
			Path:    asset.Path,
			Deleted: false,
		}, nil
	}

	_, absPath, err := s.mediaHelper.ResolveManagedImagePath(rootPath, asset.Path, "")
	if err != nil {
		return nil, err
	}
	stagedPath, err := s.mediaHelper.StageFile(absPath, time.Now().UTC())
	if err != nil {
		return nil, err
	}

	if s.currentRootVersion() != expectedRootVersion {
		if rollbackErr := s.mediaHelper.RestoreStagedFile(absPath, stagedPath); rollbackErr != nil {
			return nil, fmt.Errorf("delete image asset aborted after root change: %w", rollbackErr)
		}
		return &ImageDeleteResult{
			Path:    asset.Path,
			Deleted: false,
		}, nil
	}

	if err := s.hardDeleteAsset(ctx, asset.ID); err != nil {
		rollbackErr := s.mediaHelper.RestoreStagedFile(absPath, stagedPath)
		return nil, helper.WrapRollbackError("delete image asset", err, rollbackErr)
	}

	if err := s.mediaHelper.DiscardStagedFile(stagedPath); err != nil {
		s.logger.Warning("discard staged image after delete %s: %v", stagedPath, err)
	}
	if err := s.mediaHelper.DiscardStagedFiles(absPath); err != nil {
		s.logger.Warning("discard remaining staged images after delete %s: %v", absPath, err)
	}
	s.mediaHelper.TrimEmptyMediaDirs(rootPath, absPath)

	return &ImageDeleteResult{
		Path:    asset.Path,
		Deleted: true,
	}, nil
}

func (s *MediaSyncService) databaseClient() (*entmodel.Client, error) {
	if s.dbService == nil || s.dbService.Client == nil {
		return nil, fmt.Errorf("media index database is not configured")
	}
	return s.dbService.Client, nil
}

func (s *MediaSyncService) ensureDependencies() (*entmodel.Client, string, error) {
	client, err := s.databaseClient()
	if err != nil {
		return nil, "", err
	}

	rootPath, _ := s.currentRootState()
	if rootPath == "" {
		return nil, "", fmt.Errorf("media service is not configured")
	}

	return client, rootPath, nil
}

func (s *MediaSyncService) configureFromConfig() error {
	if s.configService == nil {
		return nil
	}

	config, err := s.configService.GetConfig()
	if err != nil {
		return fmt.Errorf("load media config: %w", err)
	}

	return s.configureRootPath(s.mediaHelper.RootPath(config.General.DataPath))
}

func (s *MediaSyncService) configureRootPath(rootPath string) error {
	if err := s.mediaHelper.EnsureRoot(rootPath); err != nil {
		return err
	}

	s.rootMu.Lock()
	s.rootPath = rootPath
	s.rootVersion++
	s.rootMu.Unlock()

	s.logger.Info("media service configured", "rootPath", rootPath)
	return nil
}

func (s *MediaSyncService) onDataPathChange(oldValue interface{}, newValue interface{}) {
	_, _ = oldValue, newValue

	if err := s.configureFromConfig(); err != nil {
		s.logger.Error("reconfigure media service after data path change: %v", err)
		return
	}
	if err := s.reconcileMediaIndex(context.Background()); err != nil {
		s.logger.Error("reconcile media index after data path change: %v", err)
	}
	s.scheduleFullOrphanSweep("data path change")
}

func (s *MediaSyncService) currentRootPath() string {
	rootPath, _ := s.currentRootState()
	return rootPath
}

func (s *MediaSyncService) currentRootVersion() uint64 {
	_, version := s.currentRootState()
	return version
}

func (s *MediaSyncService) currentRootState() (string, uint64) {
	s.rootMu.RLock()
	defer s.rootMu.RUnlock()
	return s.rootPath, s.rootVersion
}

func (s *MediaSyncService) walkIndexedMediaAssets(ctx context.Context, client *entmodel.Client, visitor func(*entmodel.MediaAsset) error) error {
	lastAssetID := ""
	for {
		query := client.MediaAsset.Query().
			Order(mediaasset.ByAssetID()).
			Limit(mediaAssetBatchSize)
		if lastAssetID != "" {
			query = query.Where(mediaasset.AssetIDGT(lastAssetID))
		}

		rows, err := query.All(ctx)
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

func (s *MediaSyncService) findAssetByReference(ctx context.Context, value string) (*entmodel.MediaAsset, error) {
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

	if relativePath, err := s.mediaHelper.NormalizeImageReference(clean, mediaServiceRoute); err == nil {
		asset, err := client.MediaAsset.Query().
			Where(mediaasset.PathEQ(relativePath)).
			Only(ctx)
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
		Only(ctx)
	if entmodel.IsNotFound(err) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("lookup image asset by id: %w", err)
	}
	return asset, nil
}

func (s *MediaSyncService) nextAvailableRelativePath(ctx context.Context, digest string, extension string, importedAt time.Time) (string, error) {
	client, rootPath, err := s.ensureDependencies()
	if err != nil {
		return "", err
	}

	relativeDir := s.mediaHelper.ImageRelativeDir(importedAt)
	filename := s.mediaHelper.BuildStoredImageFilename(digest, extension)
	relativePath := path.Join(relativeDir, filename)

	existsInIndex, err := client.MediaAsset.Query().
		Where(mediaasset.PathEQ(relativePath)).
		Exist(ctx)
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

func (s *MediaSyncService) hardDeleteAsset(ctx context.Context, id int) error {
	if err := s.dbService.Client.MediaAsset.DeleteOneID(id).Exec(ctx); err != nil && !entmodel.IsNotFound(err) {
		return fmt.Errorf("delete media asset index row: %w", err)
	}
	return nil
}
