package resource

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"voidraft/internal/models/ent"
	"voidraft/internal/models/ent/mediaasset"
	schemamixin "voidraft/internal/models/schema/mixin"
	"voidraft/internal/syncer/snapshot"
)

const mediaAssetBlobName = "original.bin"

const mediaAssetExportBatchSize = 256

// MediaAssetAdapter syncs indexed media assets and their original image blobs.
type MediaAssetAdapter struct {
	client           *ent.Client
	mediaRootResolve func() string
}

// NewMediaAssetAdapter creates a media asset adapter.
func NewMediaAssetAdapter(client *ent.Client, mediaRootResolve func() string) *MediaAssetAdapter {
	return &MediaAssetAdapter{
		client:           client,
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
	builder := a.client.MediaAsset.Create().
		SetAssetID(record.ID).
		SetRelativePath(stringValue(record, mediaasset.FieldRelativePath)).
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

	if !record.HasBlobs() {
		return fmt.Errorf("active media asset record %s is missing blob", record.ID)
	}
	if err := writeRecordBlob(rootPath, record); err != nil {
		return err
	}
	return builder.Exec(ctx)
}

func (a *MediaAssetAdapter) update(ctx context.Context, rootPath string, current *ent.MediaAsset, record snapshot.Record) error {
	nextRelativePath := stringValue(record, mediaasset.FieldRelativePath)
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
		removeBlobAtPath(rootPath, current.RelativePath)
		if current.RelativePath != nextRelativePath {
			removeBlobAtPath(rootPath, nextRelativePath)
		}
		return nil
	}

	update.ClearDeletedAt()
	if !record.HasBlobs() {
		return fmt.Errorf("active media asset record %s is missing blob", record.ID)
	}
	if err := writeRecordBlob(rootPath, record); err != nil {
		return err
	}
	if err := update.Exec(ctx); err != nil {
		return err
	}
	if current.RelativePath != nextRelativePath {
		removeBlobAtPath(rootPath, current.RelativePath)
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
	if item.DeletedAt != nil {
		record, err := snapshot.NewRecord(a.Kind(), item.AssetID, values, nil)
		if err != nil {
			return snapshot.Record{}, fmt.Errorf("build media asset record %s: %w", item.AssetID, err)
		}
		return record, nil
	}

	blobPath := filepath.Join(rootPath, filepath.FromSlash(item.RelativePath))
	info, err := os.Stat(blobPath)
	if err != nil {
		if os.IsNotExist(err) {
			_ = a.client.MediaAsset.DeleteOneID(item.ID).Exec(schemamixin.SkipSoftDelete(ctx))
			return snapshot.Record{}, nil
		}
		return snapshot.Record{}, fmt.Errorf("stat media asset blob %s: %w", item.AssetID, err)
	}
	if info.IsDir() {
		return snapshot.Record{}, fmt.Errorf("media asset blob %s resolves to a directory", item.AssetID)
	}

	record, err := snapshot.NewRecordWithBlobFiles(a.Kind(), item.AssetID, values, map[string]string{
		mediaAssetBlobName: blobPath,
	})
	if err != nil {
		return snapshot.Record{}, fmt.Errorf("build media asset record %s: %w", item.AssetID, err)
	}
	return record, nil
}

func writeRecordBlob(rootPath string, record snapshot.Record) error {
	data, ok, err := record.BlobBytes(mediaAssetBlobName)
	if err != nil {
		return fmt.Errorf("read media blob: %w", err)
	}
	if !ok {
		return nil
	}

	absPath := filepath.Join(rootPath, filepath.FromSlash(stringValue(record, mediaasset.FieldRelativePath)))
	if err := os.MkdirAll(filepath.Dir(absPath), 0755); err != nil {
		return fmt.Errorf("create media blob directory: %w", err)
	}
	if err := os.WriteFile(absPath, data, 0644); err != nil {
		return fmt.Errorf("write media blob: %w", err)
	}
	return nil
}

func removeBlobAtPath(rootPath string, relativePath string) {
	if strings.TrimSpace(relativePath) == "" {
		return
	}
	absPath := filepath.Join(rootPath, filepath.FromSlash(relativePath))
	_ = os.Remove(absPath)
	_ = os.Remove(strings.TrimSuffix(absPath, filepath.Ext(absPath)) + ".json")
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
