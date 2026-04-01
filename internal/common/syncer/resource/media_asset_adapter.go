package resource

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
	"voidraft/internal/common/helper"
	"voidraft/internal/common/syncer/snapshot"
	"voidraft/internal/models/ent"
	"voidraft/internal/models/ent/mediaasset"
	schemamixin "voidraft/internal/models/schema/mixin"
)

const mediaAssetBlobName = "original.bin"

const mediaAssetExportBatchSize = 256

// MediaAssetAdapter syncs indexed media assets and their original image blobs.
type MediaAssetAdapter struct {
	client           *ent.Client
	mediaHelper      *helper.MediaHelper
	mediaRootResolve func() string
}

// NewMediaAssetAdapter creates a media asset adapter.
func NewMediaAssetAdapter(client *ent.Client, mediaRootResolve func() string) *MediaAssetAdapter {
	return &MediaAssetAdapter{
		client:           client,
		mediaHelper:      helper.NewMediaHelper(),
		mediaRootResolve: mediaRootResolve,
	}
}

// Kind returns the adapter resource kind.
func (a *MediaAssetAdapter) Kind() string {
	return "media_assets"
}

// Export exports indexed media assets and their original image blobs.
func (a *MediaAssetAdapter) Export(ctx context.Context) ([]snapshot.Record, error) {
	rootPath, err := a.mediaRoot()
	if err != nil {
		return nil, err
	}

	records := make([]snapshot.Record, 0)
	lastAssetID := ""
	for {
		query := a.client.MediaAsset.Query().
			Order(mediaasset.ByAssetID()).
			Limit(mediaAssetExportBatchSize)
		if lastAssetID != "" {
			query = query.Where(mediaasset.AssetIDGT(lastAssetID))
		}

		assets, err := query.All(exportContext(ctx))
		if err != nil {
			return nil, err
		}
		if len(assets) == 0 {
			return records, nil
		}

		for _, item := range assets {
			values := map[string]interface{}{
				mediaasset.FieldCreatedAt:    item.CreatedAt,
				mediaasset.FieldUpdatedAt:    item.UpdatedAt,
				mediaasset.FieldDeletedAt:    nullableStringValue(item.DeletedAt),
				mediaasset.FieldAssetID:      item.AssetID,
				mediaasset.FieldRelativePath: item.RelativePath,
				mediaasset.FieldMimeType:     item.MimeType,
				mediaasset.FieldSize:         item.Size,
				mediaasset.FieldWidth:        item.Width,
				mediaasset.FieldHeight:       item.Height,
			}
			if item.OriginalFilename != nil {
				values[mediaasset.FieldOriginalFilename] = *item.OriginalFilename
			}

			record, err := a.buildExportRecord(ctx, rootPath, item, values)
			if err != nil {
				return nil, err
			}
			if record.Kind == "" {
				continue
			}
			records = append(records, record)
		}

		lastAssetID = assets[len(assets)-1].AssetID
	}
}

// Apply applies media asset records to the local database and filesystem.
func (a *MediaAssetAdapter) Apply(ctx context.Context, records []snapshot.Record) error {
	applyCtx := importContext(ctx)
	rootPath, err := a.mediaRoot()
	if err != nil {
		return err
	}

	for _, record := range records {
		found, err := a.client.MediaAsset.Query().
			Where(mediaasset.AssetIDEQ(record.ID)).
			First(schemamixin.SkipSoftDelete(applyCtx))
		switch {
		case ent.IsNotFound(err):
			if err := a.create(applyCtx, rootPath, record); err != nil {
				return err
			}
		case err != nil:
			return err
		default:
			if shouldApplyRecord(found.UpdatedAt, record) {
				if err := a.update(applyCtx, rootPath, found, record); err != nil {
					return err
				}
			}
		}
	}

	return nil
}

func (a *MediaAssetAdapter) create(ctx context.Context, rootPath string, record snapshot.Record) error {
	relativePath, _, err := a.mediaHelper.ResolveManagedImagePath(rootPath, stringValue(record, mediaasset.FieldRelativePath), "")
	if err != nil {
		return fmt.Errorf("resolve media asset path %s: %w", record.ID, err)
	}

	builder := a.client.MediaAsset.Create().
		SetAssetID(record.ID).
		SetRelativePath(relativePath).
		SetMimeType(stringValue(record, mediaasset.FieldMimeType)).
		SetSize(int64Value(record, mediaasset.FieldSize)).
		SetWidth(intValue(record, mediaasset.FieldWidth)).
		SetHeight(intValue(record, mediaasset.FieldHeight)).
		SetCreatedAt(stringValue(record, mediaasset.FieldCreatedAt)).
		SetUpdatedAt(stringValue(record, mediaasset.FieldUpdatedAt)).
		SetNillableOriginalFilename(optionalStringValue(record, mediaasset.FieldOriginalFilename))

	if deletedAt := recordDeletedAtString(record); deletedAt != nil {
		return builder.SetDeletedAt(*deletedAt).Exec(ctx)
	}

	prepared, err := a.prepareActiveRecordBlob(rootPath, record)
	if err != nil {
		return err
	}
	return a.applyActiveBlob(prepared.absPath, prepared.data, "create synced media asset", builder.Exec, ctx)
}

func (a *MediaAssetAdapter) update(ctx context.Context, rootPath string, current *ent.MediaAsset, record snapshot.Record) error {
	nextRelativePath, _, err := a.mediaHelper.ResolveManagedImagePath(rootPath, stringValue(record, mediaasset.FieldRelativePath), "")
	if err != nil {
		return fmt.Errorf("resolve media asset path %s: %w", record.ID, err)
	}
	update := a.client.MediaAsset.UpdateOneID(current.ID).
		SetRelativePath(nextRelativePath).
		SetMimeType(stringValue(record, mediaasset.FieldMimeType)).
		SetSize(int64Value(record, mediaasset.FieldSize)).
		SetWidth(intValue(record, mediaasset.FieldWidth)).
		SetHeight(intValue(record, mediaasset.FieldHeight)).
		SetUpdatedAt(stringValue(record, mediaasset.FieldUpdatedAt))
	if name := optionalStringValue(record, mediaasset.FieldOriginalFilename); name != nil {
		update.SetOriginalFilename(*name)
	} else {
		update.ClearOriginalFilename()
	}

	if deletedAt := recordDeletedAtString(record); deletedAt != nil {
		update.SetDeletedAt(*deletedAt)
		if err := update.Exec(ctx); err != nil {
			return err
		}
		if err := a.removeBlobAtPath(rootPath, current.RelativePath); err != nil {
			return err
		}
		if current.RelativePath != nextRelativePath {
			if err := a.removeBlobAtPath(rootPath, nextRelativePath); err != nil {
				return err
			}
		}
		return nil
	}

	update.ClearDeletedAt()
	prepared, err := a.prepareActiveRecordBlob(rootPath, record)
	if err != nil {
		return err
	}
	if err := a.applyActiveBlob(prepared.absPath, prepared.data, "update synced media asset", update.Exec, ctx); err != nil {
		return err
	}
	if current.RelativePath != nextRelativePath {
		if err := a.removeBlobAtPath(rootPath, current.RelativePath); err != nil {
			return err
		}
	}
	return nil
}

func (a *MediaAssetAdapter) mediaRoot() (string, error) {
	if a.mediaRootResolve == nil {
		return "", fmt.Errorf("media root resolver is not configured")
	}
	rootPath := strings.TrimSpace(a.mediaRootResolve())
	if rootPath == "" {
		return "", fmt.Errorf("media root path is not configured")
	}
	return rootPath, nil
}

func (a *MediaAssetAdapter) buildExportRecord(ctx context.Context, rootPath string, item *ent.MediaAsset, values map[string]interface{}) (snapshot.Record, error) {
	relativePath, blobPath, err := a.mediaHelper.ResolveManagedImagePath(rootPath, item.RelativePath, "")
	if err != nil {
		return snapshot.Record{}, fmt.Errorf("resolve media asset path %s: %w", item.AssetID, err)
	}
	values[mediaasset.FieldRelativePath] = relativePath

	if item.DeletedAt != nil {
		record, err := snapshot.NewRecord(a.Kind(), item.AssetID, values, nil)
		if err != nil {
			return snapshot.Record{}, fmt.Errorf("build media asset record %s: %w", item.AssetID, err)
		}
		return record, nil
	}

	info, err := os.Stat(blobPath)
	if err != nil {
		if os.IsNotExist(err) {
			restored, restoreErr := a.mediaHelper.RestoreLatestStagedFile(blobPath)
			if restoreErr != nil {
				return snapshot.Record{}, fmt.Errorf("restore staged media asset blob %s: %w", item.AssetID, restoreErr)
			}
			if restored {
				info, err = os.Stat(blobPath)
			}
		}
		if err != nil {
			if os.IsNotExist(err) {
				return snapshot.Record{}, fmt.Errorf("active media asset blob %s is missing at %s", item.AssetID, relativePath)
			}
			return snapshot.Record{}, fmt.Errorf("stat media asset blob %s: %w", item.AssetID, err)
		}
	}
	if info.IsDir() {
		return snapshot.Record{}, fmt.Errorf("media asset blob %s resolves to a directory", item.AssetID)
	}
	if err := a.mediaHelper.DiscardStagedFiles(blobPath); err != nil {
		return snapshot.Record{}, fmt.Errorf("discard staged media asset blobs %s: %w", item.AssetID, err)
	}

	record, err := snapshot.NewRecordWithBlobFiles(a.Kind(), item.AssetID, values, map[string]string{
		mediaAssetBlobName: blobPath,
	})
	if err != nil {
		return snapshot.Record{}, fmt.Errorf("build media asset record %s: %w", item.AssetID, err)
	}
	return record, nil
}

type preparedMediaBlob struct {
	absPath string
	data    []byte
}

func (a *MediaAssetAdapter) prepareActiveRecordBlob(rootPath string, record snapshot.Record) (*preparedMediaBlob, error) {
	if !record.HasBlobs() {
		return nil, fmt.Errorf("active media asset record %s is missing blob", record.ID)
	}

	data, ok, err := record.BlobBytes(mediaAssetBlobName)
	if err != nil {
		return nil, fmt.Errorf("read media blob: %w", err)
	}
	if !ok {
		return nil, fmt.Errorf("active media asset record %s is missing blob", record.ID)
	}

	expectedAssetID := strings.TrimSpace(stringValue(record, mediaasset.FieldAssetID))
	if expectedAssetID != "" && expectedAssetID != record.ID {
		return nil, fmt.Errorf("media asset record id mismatch: %s != %s", expectedAssetID, record.ID)
	}

	relativePath, absPath, err := a.mediaHelper.ResolveManagedImagePath(rootPath, stringValue(record, mediaasset.FieldRelativePath), "")
	if err != nil {
		return nil, fmt.Errorf("resolve media blob path: %w", err)
	}

	payload, err := a.mediaHelper.InspectImagePayload(data, stringValue(record, mediaasset.FieldMimeType), filepath.Base(relativePath))
	if err != nil {
		return nil, fmt.Errorf("inspect media blob %s: %w", record.ID, err)
	}
	if payload.Digest != record.ID {
		return nil, fmt.Errorf("media asset %s blob digest mismatch", record.ID)
	}
	if expectedMime := strings.TrimSpace(stringValue(record, mediaasset.FieldMimeType)); expectedMime != "" && !strings.EqualFold(payload.MimeType, expectedMime) {
		return nil, fmt.Errorf("media asset %s blob mime mismatch", record.ID)
	}
	if expectedSize := int64Value(record, mediaasset.FieldSize); expectedSize != 0 && int64(len(data)) != expectedSize {
		return nil, fmt.Errorf("media asset %s blob size mismatch", record.ID)
	}
	if expectedWidth := intValue(record, mediaasset.FieldWidth); expectedWidth != 0 && payload.Width != expectedWidth {
		return nil, fmt.Errorf("media asset %s blob width mismatch", record.ID)
	}
	if expectedHeight := intValue(record, mediaasset.FieldHeight); expectedHeight != 0 && payload.Height != expectedHeight {
		return nil, fmt.Errorf("media asset %s blob height mismatch", record.ID)
	}

	return &preparedMediaBlob{
		absPath: absPath,
		data:    data,
	}, nil
}

func (a *MediaAssetAdapter) applyActiveBlob(absPath string, data []byte, action string, persist func(context.Context) error, ctx context.Context) error {
	stagedPath, err := a.mediaHelper.StageFile(absPath, time.Time{})
	if err != nil {
		return err
	}
	if err := a.mediaHelper.WriteBinaryFile(absPath, data); err != nil {
		rollbackErr := a.mediaHelper.RollbackFileChange(absPath, stagedPath)
		return helper.WrapRollbackError(action, err, rollbackErr)
	}
	if err := persist(ctx); err != nil {
		rollbackErr := a.mediaHelper.RollbackFileChange(absPath, stagedPath)
		return helper.WrapRollbackError(action, err, rollbackErr)
	}
	if err := a.mediaHelper.DiscardStagedFile(stagedPath); err != nil {
		return fmt.Errorf("discard staged media blob: %w", err)
	}
	return nil
}

func (a *MediaAssetAdapter) removeBlobAtPath(rootPath string, relativePath string) error {
	if strings.TrimSpace(relativePath) == "" {
		return nil
	}
	_, absPath, err := a.mediaHelper.ResolveManagedImagePath(rootPath, relativePath, "")
	if err != nil {
		return nil
	}
	if _, err := a.mediaHelper.RemoveImageArtifacts(absPath); err != nil {
		return err
	}
	if err := a.mediaHelper.DiscardStagedFiles(absPath); err != nil {
		return err
	}
	a.mediaHelper.TrimEmptyMediaDirs(rootPath, absPath)
	return nil
}

func nullableStringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func optionalStringValue(record snapshot.Record, key string) *string {
	value := strings.TrimSpace(stringValue(record, key))
	if value == "" {
		return nil
	}
	return &value
}

func int64Value(record snapshot.Record, key string) int64 {
	switch value := record.Values[key].(type) {
	case int64:
		return value
	case int:
		return int64(value)
	case float64:
		return int64(value)
	default:
		return 0
	}
}

func intValue(record snapshot.Record, key string) int {
	switch value := record.Values[key].(type) {
	case int:
		return value
	case int64:
		return int(value)
	case float64:
		return int(value)
	default:
		return 0
	}
}
