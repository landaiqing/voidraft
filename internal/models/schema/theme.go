package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"

	"voidraft/internal/models/schema/mixin"
)

// Theme holds the schema definition for the Theme entity.
type Theme struct {
	ent.Schema
}

// Annotations of the Theme.
func (Theme) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "themes"},
	}
}

// Mixin of the Theme.
func (Theme) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.UUIDMixin{},
		mixin.TimeMixin{},
		mixin.SoftDeleteMixin{},
	}
}

// Fields of the Theme.
func (Theme) Fields() []ent.Field {
	return []ent.Field{
		field.String("name").
			MaxLen(100).
			NotEmpty().
			Unique().
			StructTag(`json:"name"`).
			Comment("theme name"),
		field.Enum("type").
			Values("dark", "light").
			StructTag(`json:"type"`).
			Comment("theme type"),
		field.JSON("colors", map[string]interface{}{}).
			Optional().
			StructTag(`json:"colors"`).
			Comment("theme colors"),
	}
}

// Edges of the Theme.
func (Theme) Edges() []ent.Edge {
	return nil
}
