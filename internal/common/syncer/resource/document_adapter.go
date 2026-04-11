package resource

import (
	"context"
	"fmt"
	"voidraft/internal/common/syncer/snapshot"
	"voidraft/internal/models"
	"voidraft/internal/models/ent"
	"voidraft/internal/models/ent/document"
)

const documentContentBlob = "content.md"

// DocumentAdapter 负责文档资源的快照导入导出。
type DocumentAdapter struct {
	client *ent.Client
}

// NewDocumentAdapter 创建文档适配器。
func NewDocumentAdapter(client *ent.Client) *DocumentAdapter {
	return &DocumentAdapter{client: client}
}

// Kind 返回适配器负责的资源类型。
func (a *DocumentAdapter) Kind() string {
	return "documents"
}

// Export 导出文档快照记录。
func (a *DocumentAdapter) Export(ctx context.Context) ([]snapshot.Record, error) {
	documents, err := a.client.Document.Query().Order(document.ByUUID()).All(exportContext(ctx))
	if err != nil {
		return nil, err
	}

	records := make([]snapshot.Record, 0, len(documents))
	for _, item := range documents {
		values := map[string]interface{}{
			document.FieldUUID:      item.UUID,
			document.FieldCreatedAt: item.CreatedAt,
			document.FieldUpdatedAt: item.UpdatedAt,
			document.FieldTitle:     item.Title,
			document.FieldLocked:    item.Locked,
		}
		if item.DeletedAt != nil {
			values[document.FieldDeletedAt] = *item.DeletedAt
		}

		record, err := snapshot.NewRecord(a.Kind(), item.UUID, values, map[string][]byte{
			documentContentBlob: []byte(models.NormalizeDocumentContent(item.Content)),
		})
		if err != nil {
			return nil, fmt.Errorf("build document record %s: %w", item.UUID, err)
		}
		records = append(records, record)
	}

	return records, nil
}

// Apply 将快照记录应用到本地文档表。
func (a *DocumentAdapter) Apply(ctx context.Context, records []snapshot.Record) error {
	applyCtx := importContext(ctx)

	for _, record := range records {
		found, err := a.client.Document.Query().Where(document.UUIDEQ(record.ID)).First(applyCtx)
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

// create 创建新的文档记录。
func (a *DocumentAdapter) create(ctx context.Context, record snapshot.Record) error {
	content, err := blobString(record, documentContentBlob)
	if err != nil {
		return err
	}
	content = models.NormalizeDocumentContent(content)

	builder := a.client.Document.Create().
		SetUUID(record.ID).
		SetTitle(stringValue(record, document.FieldTitle)).
		SetContent(content).
		SetLocked(boolValue(record, document.FieldLocked)).
		SetCreatedAt(stringValue(record, document.FieldCreatedAt)).
		SetUpdatedAt(stringValue(record, document.FieldUpdatedAt))

	if deletedAt := recordDeletedAtString(record); deletedAt != nil {
		builder.SetDeletedAt(*deletedAt)
	}

	return builder.Exec(ctx)
}

// update 更新已有文档记录。
func (a *DocumentAdapter) update(ctx context.Context, id int, record snapshot.Record) error {
	content, err := blobString(record, documentContentBlob)
	if err != nil {
		return err
	}
	content = models.NormalizeDocumentContent(content)

	builder := a.client.Document.UpdateOneID(id).
		SetTitle(stringValue(record, document.FieldTitle)).
		SetContent(content).
		SetLocked(boolValue(record, document.FieldLocked)).
		SetUpdatedAt(stringValue(record, document.FieldUpdatedAt))

	if deletedAt := recordDeletedAtString(record); deletedAt != nil {
		builder.SetDeletedAt(*deletedAt)
	} else {
		builder.ClearDeletedAt()
	}

	return builder.Exec(ctx)
}
