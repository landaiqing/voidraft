package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"

	"voidraft/internal/models/schema/mixin"
)

// Extension holds the schema definition for the Extension entity.
type Extension struct {
	ent.Schema
}

// Annotations of the Extension.
func (Extension) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "extensions"},
	}
}

// Mixin of the Extension.
func (Extension) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.UUIDMixin{},
		mixin.TimeMixin{},
		mixin.SoftDeleteMixin{},
	}
}

// Fields of the Extension.
func (Extension) Fields() []ent.Field {
	return []ent.Field{
		field.String("key").
			MaxLen(100).
			NotEmpty().
			Unique().
			StructTag(`json:"key"`).
			Comment("extension key"),
		field.Bool("enabled").
			Default(true).
			StructTag(`json:"enabled"`).
			Comment("extension enabled or not"),
		field.JSON("config", map[string]interface{}{}).
			Optional().
			StructTag(`json:"config"`).
			Comment("extension config"),
	}
}

// Edges of the Extension.
func (Extension) Edges() []ent.Edge {
	return nil
}

// Indexes of the Extension.
func (Extension) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("enabled"),
	}
}
