package resource

import (
	"context"
	"fmt"
	"voidraft/internal/models/ent"
	"voidraft/internal/models/ent/theme"
	"voidraft/internal/syncer/snapshot"
)

// ThemeAdapter 负责主题资源的快照导入导出。
type ThemeAdapter struct {
	client *ent.Client
}

// NewThemeAdapter 创建主题适配器。
func NewThemeAdapter(client *ent.Client) *ThemeAdapter {
	return &ThemeAdapter{client: client}
}

// Kind 返回适配器负责的资源类型。
func (a *ThemeAdapter) Kind() string {
	return "themes"
}

// Export 导出主题快照记录。
func (a *ThemeAdapter) Export(ctx context.Context) ([]snapshot.Record, error) {
	themes, err := a.client.Theme.Query().Order(theme.ByUUID()).All(exportContext(ctx))
	if err != nil {
		return nil, err
	}

	records := make([]snapshot.Record, 0, len(themes))
	for _, item := range themes {
		values := map[string]interface{}{
			theme.FieldUUID:      item.UUID,
			theme.FieldCreatedAt: item.CreatedAt,
			theme.FieldUpdatedAt: item.UpdatedAt,
			theme.FieldName:      item.Name,
			theme.FieldType:      item.Type.String(),
			theme.FieldColors:    cloneMap(item.Colors),
		}
		if item.DeletedAt != nil {
			values[theme.FieldDeletedAt] = *item.DeletedAt
		}

		record, err := snapshot.NewRecord(a.Kind(), item.UUID, values, nil)
		if err != nil {
			return nil, fmt.Errorf("build theme record %s: %w", item.UUID, err)
		}
		records = append(records, record)
	}

	return records, nil
}

// Apply 将快照记录应用到本地主题表。
func (a *ThemeAdapter) Apply(ctx context.Context, records []snapshot.Record) error {
	applyCtx := importContext(ctx)

	for _, record := range records {
		found, err := a.client.Theme.Query().Where(theme.UUIDEQ(record.ID)).First(applyCtx)
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

// create 创建新的主题记录。
func (a *ThemeAdapter) create(ctx context.Context, record snapshot.Record) error {
	builder := a.client.Theme.Create().
		SetUUID(record.ID).
		SetName(stringValue(record, theme.FieldName)).
		SetType(theme.Type(stringValue(record, theme.FieldType))).
		SetColors(mapValue(record, theme.FieldColors)).
		SetCreatedAt(stringValue(record, theme.FieldCreatedAt)).
		SetUpdatedAt(stringValue(record, theme.FieldUpdatedAt))

	if deletedAt := recordDeletedAtString(record); deletedAt != nil {
		builder.SetDeletedAt(*deletedAt)
	}

	return builder.Exec(ctx)
}

// update 更新已有主题记录。
func (a *ThemeAdapter) update(ctx context.Context, id int, record snapshot.Record) error {
	builder := a.client.Theme.UpdateOneID(id).
		SetName(stringValue(record, theme.FieldName)).
		SetType(theme.Type(stringValue(record, theme.FieldType))).
		SetColors(mapValue(record, theme.FieldColors)).
		SetUpdatedAt(stringValue(record, theme.FieldUpdatedAt))

	if deletedAt := recordDeletedAtString(record); deletedAt != nil {
		builder.SetDeletedAt(*deletedAt)
	} else {
		builder.ClearDeletedAt()
	}

	return builder.Exec(ctx)
}
