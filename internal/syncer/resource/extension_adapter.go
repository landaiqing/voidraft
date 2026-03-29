package resource

import (
	"context"
	"fmt"
	"voidraft/internal/models/ent"
	"voidraft/internal/models/ent/extension"
	"voidraft/internal/syncer/snapshot"
)

// ExtensionAdapter 负责扩展资源的快照导入导出。
type ExtensionAdapter struct {
	client *ent.Client
}

// NewExtensionAdapter 创建扩展适配器。
func NewExtensionAdapter(client *ent.Client) *ExtensionAdapter {
	return &ExtensionAdapter{client: client}
}

// Kind 返回适配器负责的资源类型。
func (a *ExtensionAdapter) Kind() string {
	return "extensions"
}

// Export 导出扩展快照记录。
func (a *ExtensionAdapter) Export(ctx context.Context) ([]snapshot.Record, error) {
	extensions, err := a.client.Extension.Query().Order(extension.ByUUID()).All(exportContext(ctx))
	if err != nil {
		return nil, err
	}

	records := make([]snapshot.Record, 0, len(extensions))
	for _, item := range extensions {
		values := map[string]interface{}{
			extension.FieldUUID:      item.UUID,
			extension.FieldCreatedAt: item.CreatedAt,
			extension.FieldUpdatedAt: item.UpdatedAt,
			extension.FieldName:      item.Name,
			extension.FieldEnabled:   item.Enabled,
			extension.FieldConfig:    cloneMap(item.Config),
		}
		if item.DeletedAt != nil {
			values[extension.FieldDeletedAt] = *item.DeletedAt
		}

		record, err := snapshot.NewRecord(a.Kind(), item.UUID, values, nil)
		if err != nil {
			return nil, fmt.Errorf("build extension record %s: %w", item.UUID, err)
		}
		records = append(records, record)
	}

	return records, nil
}

// Apply 将快照记录应用到本地扩展表。
func (a *ExtensionAdapter) Apply(ctx context.Context, records []snapshot.Record) error {
	applyCtx := importContext(ctx)

	for _, record := range records {
		found, err := a.client.Extension.Query().Where(extension.UUIDEQ(record.ID)).First(applyCtx)
		switch {
		case ent.IsNotFound(err):
			if err := a.create(applyCtx, record); err != nil {
				return err
			}
		case err != nil:
			return err
		default:
			if shouldApplyRecord(found.UpdatedAt, record) {
				if err := a.update(applyCtx, found.ID, record); err != nil {
					return err
				}
			}
		}
	}

	return nil
}

// create 创建新的扩展记录。
func (a *ExtensionAdapter) create(ctx context.Context, record snapshot.Record) error {
	builder := a.client.Extension.Create().
		SetUUID(record.ID).
		SetName(stringValue(record, extension.FieldName)).
		SetEnabled(boolValue(record, extension.FieldEnabled)).
		SetConfig(mapValue(record, extension.FieldConfig)).
		SetCreatedAt(stringValue(record, extension.FieldCreatedAt)).
		SetUpdatedAt(stringValue(record, extension.FieldUpdatedAt))

	if deletedAt := recordDeletedAtString(record); deletedAt != nil {
		builder.SetDeletedAt(*deletedAt)
	}

	return builder.Exec(ctx)
}

// update 更新已有扩展记录。
func (a *ExtensionAdapter) update(ctx context.Context, id int, record snapshot.Record) error {
	builder := a.client.Extension.UpdateOneID(id).
		SetName(stringValue(record, extension.FieldName)).
		SetEnabled(boolValue(record, extension.FieldEnabled)).
		SetConfig(mapValue(record, extension.FieldConfig)).
		SetUpdatedAt(stringValue(record, extension.FieldUpdatedAt))

	if deletedAt := recordDeletedAtString(record); deletedAt != nil {
		builder.SetDeletedAt(*deletedAt)
	} else {
		builder.ClearDeletedAt()
	}

	return builder.Exec(ctx)
}
