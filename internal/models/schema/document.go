package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"

	"voidraft/internal/models/schema/mixin"
)

// Document holds the schema definition for the Document entity.
type Document struct {
	ent.Schema
}

// Annotations of the Document.
func (Document) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "documents"},
	}
}

// Mixin of the Document.
func (Document) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.UUIDMixin{},
		mixin.TimeMixin{},
		mixin.SoftDeleteMixin{},
	}
}

// Fields of the Document.
func (Document) Fields() []ent.Field {
	return []ent.Field{
		field.String("title").
			MaxLen(255).
			NotEmpty().
			StructTag(`json:"title"`).
			Comment("document title"),
		field.Text("content").
			Optional().
			Default("\n∞∞∞text-a\n").
			StructTag(`json:"content"`).
			Comment("document content"),
		field.Bool("locked").
			Default(false).
			StructTag(`json:"locked"`).
			Comment("document locked status"),
	}
}

// Edges of the Document.
func (Document) Edges() []ent.Edge {
	return nil
}

// Indexes of the Document.
func (Document) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("title"),
		index.Fields("created_at"),
		index.Fields("updated_at"),
	}
}
