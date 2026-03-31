package resource

import (
	"context"
	"maps"
	"time"
	"voidraft/internal/common/syncer/snapshot"
	"voidraft/internal/models/schema/mixin"
)

// importContext builds the context used for sync imports.
func importContext(ctx context.Context) context.Context {
	return mixin.SkipAutoUpdate(mixin.SkipSoftDelete(ctx))
}

// exportContext builds the context used for sync exports.
func exportContext(ctx context.Context) context.Context {
	return mixin.SkipSoftDelete(ctx)
}

// cloneMap returns a safe copy of a map value.
func cloneMap(value map[string]interface{}) map[string]interface{} {
	if value == nil {
		return nil
	}
	return maps.Clone(value)
}

// recordDeletedAtString returns the record delete timestamp as RFC3339.
func recordDeletedAtString(record snapshot.Record) *string {
	if record.DeletedAt == nil {
		return nil
	}
	value := record.DeletedAt.Format(time.RFC3339)
	return &value
}

// shouldApplyRecord reports whether the incoming record should overwrite local data.
func shouldApplyRecord(localUpdatedAt string, record snapshot.Record) bool {
	if localUpdatedAt == "" {
		return true
	}
	localTime, err := time.Parse(time.RFC3339, localUpdatedAt)
	if err != nil {
		return true
	}
	return recordApplyTime(record).After(localTime) || recordApplyTime(record).Equal(localTime)
}

// stringValue reads a string field from the record values.
func stringValue(record snapshot.Record, key string) string {
	value, _ := record.Values[key].(string)
	return value
}

// boolValue reads a bool field from the record values.
func boolValue(record snapshot.Record, key string) bool {
	value, _ := record.Values[key].(bool)
	return value
}

// mapValue reads a map field from the record values.
func mapValue(record snapshot.Record, key string) map[string]interface{} {
	value, _ := record.Values[key].(map[string]interface{})
	return cloneMap(value)
}

// blobBytes reads one blob payload from the record.
func blobBytes(record snapshot.Record, name string) ([]byte, error) {
	value, ok, err := record.BlobBytes(name)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, nil
	}
	return value, nil
}

// blobString reads a text blob from the record.
func blobString(record snapshot.Record, name string) (string, error) {
	value, err := blobBytes(record, name)
	if err != nil {
		return "", err
	}
	if len(value) == 0 {
		return "", nil
	}
	return string(value), nil
}

// recordApplyTime returns the effective update time used during imports.
func recordApplyTime(record snapshot.Record) time.Time {
	if record.DeletedAt != nil && record.DeletedAt.After(record.UpdatedAt) {
		return *record.DeletedAt
	}
	return record.UpdatedAt
}
