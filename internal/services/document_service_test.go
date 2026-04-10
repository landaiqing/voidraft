package services

import (
	"context"
	"fmt"
	"testing"
	"voidraft/internal/common/syncer/resource"
	"voidraft/internal/models/ent"
	"voidraft/internal/models/ent/document"
	"voidraft/internal/models/ent/enttest"
	"voidraft/internal/models/schema/mixin"
)

func TestDeleteDocumentUsesSoftDeleteAndExportsTombstone(t *testing.T) {
	ctx := context.Background()
	dsnName := fmt.Sprintf("file:%s?mode=memory&cache=shared&_fk=1", t.Name())
	client := enttest.Open(t, "sqlite3", dsnName)
	defer client.Close()

	service := NewDocumentService(&DatabaseService{Client: client}, nil, nil)

	first, err := service.CreateDocument(ctx, "first")
	if err != nil {
		t.Fatalf("create first document: %v", err)
	}
	if _, err := service.CreateDocument(ctx, "second"); err != nil {
		t.Fatalf("create second document: %v", err)
	}

	if err := service.DeleteDocument(ctx, first.ID); err != nil {
		t.Fatalf("delete document: %v", err)
	}

	_, err = client.Document.Query().Where(document.IDEQ(first.ID)).Only(ctx)
	if err == nil {
		t.Fatalf("expected deleted document to be hidden from normal queries")
	}
	if !ent.IsNotFound(err) {
		t.Fatalf("expected not found for deleted document, got %v", err)
	}

	hidden, err := client.Document.Query().Where(document.IDEQ(first.ID)).Only(mixin.SkipSoftDelete(ctx))
	if err != nil {
		t.Fatalf("query hidden document: %v", err)
	}
	if hidden.DeletedAt == nil || *hidden.DeletedAt == "" {
		t.Fatalf("expected deleted document to keep deleted_at tombstone")
	}

	records, err := resource.NewDocumentAdapter(client).Export(ctx)
	if err != nil {
		t.Fatalf("export documents: %v", err)
	}

	var deletedRecordFound bool
	for _, record := range records {
		if record.ID != first.UUID {
			continue
		}
		deletedRecordFound = true
		if record.DeletedAt == nil {
			t.Fatalf("expected exported deleted document to include deleted_at tombstone")
		}
	}
	if !deletedRecordFound {
		t.Fatalf("expected exported snapshot to contain deleted document record")
	}
}
