package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/mixin"
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
		mixin.Time{},
	}
}

// Fields of the Theme.
func (Theme) Fields() []ent.Field {
	return []ent.Field{
		field.String("key").
			MaxLen(100).
			NotEmpty().
			Unique().
			Comment("主题标识符"),
		field.Enum("type").
			Values("dark", "light").
			Comment("主题类型"),
		field.JSON("colors", map[string]interface{}{}).
			Optional().
			Comment("主题颜色配置"),
		field.Time("deleted_at").
			Optional().
			Nillable().
			Comment("软删除时间"),
	}
}

// Edges of the Theme.
func (Theme) Edges() []ent.Edge {
	return nil
}
