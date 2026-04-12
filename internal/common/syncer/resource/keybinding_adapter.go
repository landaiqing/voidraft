package resource

import (
	"context"
	"fmt"
	"voidraft/internal/common/syncer/snapshot"
	"voidraft/internal/models/ent"
	"voidraft/internal/models/ent/keybinding"
)

// KeyBindingAdapter 负责快捷键资源的快照导入导出。
type KeyBindingAdapter struct {
	client *ent.Client
}

// NewKeyBindingAdapter 创建快捷键适配器。
func NewKeyBindingAdapter(client *ent.Client) *KeyBindingAdapter {
	return &KeyBindingAdapter{client: client}
}

// Kind 返回适配器负责的资源类型。
func (a *KeyBindingAdapter) Kind() string {
	return "keybindings"
}

// Export 导出快捷键快照记录。
func (a *KeyBindingAdapter) Export(ctx context.Context) ([]snapshot.Record, error) {
	keyBindings, err := a.client.KeyBinding.Query().Order(keybinding.ByUUID()).All(exportContext(ctx))
	if err != nil {
		return nil, err
	}

	records := make([]snapshot.Record, 0, len(keyBindings))
	for _, item := range keyBindings {
		values := map[string]interface{}{
			keybinding.FieldCreatedAt:      item.CreatedAt,
			keybinding.FieldUpdatedAt:      item.UpdatedAt,
			keybinding.FieldName:           item.Name,
			keybinding.FieldType:           item.Type,
			keybinding.FieldKey:            item.Key,
			keybinding.FieldMacos:          item.Macos,
			keybinding.FieldWindows:        item.Windows,
			keybinding.FieldLinux:          item.Linux,
			keybinding.FieldExtension:      item.Extension,
			keybinding.FieldEnabled:        item.Enabled,
			keybinding.FieldPreventDefault: item.PreventDefault,
			keybinding.FieldScope:          item.Scope,
		}
		if item.DeletedAt != nil {
			values[keybinding.FieldDeletedAt] = *item.DeletedAt
		}

		recordID := keyBindingSyncID(item.Type, item.Name)
		record, err := snapshot.NewRecord(a.Kind(), recordID, values, nil)
		if err != nil {
			return nil, fmt.Errorf("build keybinding record %s: %w", recordID, err)
		}
		records = append(records, record)
	}

	return records, nil
}

// Apply 将快照记录应用到本地快捷键表。
func (a *KeyBindingAdapter) Apply(ctx context.Context, records []snapshot.Record) error {
	applyCtx := importContext(ctx)

	for _, record := range records {
		name := stringValue(record, keybinding.FieldName)
		bindingType := stringValue(record, keybinding.FieldType)
		found, err := a.client.KeyBinding.Query().
			Where(keybinding.TypeEQ(bindingType), keybinding.NameEQ(name)).
			First(applyCtx)
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

// create 创建新的快捷键记录。
func (a *KeyBindingAdapter) create(ctx context.Context, record snapshot.Record) error {
	builder := a.client.KeyBinding.Create().
		SetName(stringValue(record, keybinding.FieldName)).
		SetType(stringValue(record, keybinding.FieldType)).
		SetKey(stringValue(record, keybinding.FieldKey)).
		SetMacos(stringValue(record, keybinding.FieldMacos)).
		SetWindows(stringValue(record, keybinding.FieldWindows)).
		SetLinux(stringValue(record, keybinding.FieldLinux)).
		SetExtension(stringValue(record, keybinding.FieldExtension)).
		SetEnabled(boolValue(record, keybinding.FieldEnabled)).
		SetPreventDefault(boolValue(record, keybinding.FieldPreventDefault)).
		SetScope(stringValue(record, keybinding.FieldScope)).
		SetCreatedAt(stringValue(record, keybinding.FieldCreatedAt)).
		SetUpdatedAt(stringValue(record, keybinding.FieldUpdatedAt))

	if deletedAt := recordDeletedAtString(record); deletedAt != nil {
		builder.SetDeletedAt(*deletedAt)
	}

	return builder.Exec(ctx)
}

// update 更新已有快捷键记录。
func (a *KeyBindingAdapter) update(ctx context.Context, id int, record snapshot.Record) error {
	builder := a.client.KeyBinding.UpdateOneID(id).
		SetName(stringValue(record, keybinding.FieldName)).
		SetType(stringValue(record, keybinding.FieldType)).
		SetKey(stringValue(record, keybinding.FieldKey)).
		SetMacos(stringValue(record, keybinding.FieldMacos)).
		SetWindows(stringValue(record, keybinding.FieldWindows)).
		SetLinux(stringValue(record, keybinding.FieldLinux)).
		SetExtension(stringValue(record, keybinding.FieldExtension)).
		SetEnabled(boolValue(record, keybinding.FieldEnabled)).
		SetPreventDefault(boolValue(record, keybinding.FieldPreventDefault)).
		SetScope(stringValue(record, keybinding.FieldScope)).
		SetUpdatedAt(stringValue(record, keybinding.FieldUpdatedAt))

	if deletedAt := recordDeletedAtString(record); deletedAt != nil {
		builder.SetDeletedAt(*deletedAt)
	} else {
		builder.ClearDeletedAt()
	}

	return builder.Exec(ctx)
}
