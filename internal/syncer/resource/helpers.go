package resource

import (
	"context"
	"maps"
	"time"
	"voidraft/internal/models/schema/mixin"
	"voidraft/internal/syncer/snapshot"
)

// importContext 构造同步导入所需的上下文。
func importContext(ctx context.Context) context.Context {
	return mixin.SkipAutoUpdate(mixin.SkipSoftDelete(ctx))
}

// exportContext 构造同步导出所需的上下文。
func exportContext(ctx context.Context) context.Context {
	return mixin.SkipSoftDelete(ctx)
}

// cloneMap 返回 map 的安全副本。
func cloneMap(value map[string]interface{}) map[string]interface{} {
	if value == nil {
		return nil
	}
	return maps.Clone(value)
}

// recordDeletedAtString 返回记录中的删除时间字符串。
func recordDeletedAtString(record snapshot.Record) *string {
	if record.DeletedAt == nil {
		return nil
	}
	value := record.DeletedAt.Format(time.RFC3339)
	return &value
}

// shouldApplyRecord 判断记录是否应该覆盖本地数据。
func shouldApplyRecord(localUpdatedAt string, record snapshot.Record) bool {
	if localUpdatedAt == "" {
		return true
	}
	localTime, err := time.Parse(time.RFC3339, localUpdatedAt)
	if err != nil {
		return true
	}
	return record.UpdatedAt.After(localTime)
}

// stringValue 从记录字段中读取字符串。
func stringValue(record snapshot.Record, key string) string {
	value, _ := record.Values[key].(string)
	return value
}

// boolValue 从记录字段中读取布尔值。
func boolValue(record snapshot.Record, key string) bool {
	value, _ := record.Values[key].(bool)
	return value
}

// mapValue 从记录字段中读取 map 值。
func mapValue(record snapshot.Record, key string) map[string]interface{} {
	value, _ := record.Values[key].(map[string]interface{})
	return cloneMap(value)
}

// blobString 读取记录中的文本 blob。
func blobString(record snapshot.Record, name string) string {
	value, ok := record.Blobs[name]
	if !ok {
		return ""
	}
	return string(value)
}
