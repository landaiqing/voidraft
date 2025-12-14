package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"

	"voidraft/internal/models/schema/mixin"
)

// KeyBinding holds the schema definition for the KeyBinding entity.
type KeyBinding struct {
	ent.Schema
}

// Annotations of the KeyBinding.
func (KeyBinding) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "key_bindings"},
	}
}

// Mixin of the KeyBinding.
func (KeyBinding) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.UUIDMixin{},
		mixin.TimeMixin{},
		mixin.SoftDeleteMixin{},
	}
}

// Fields of the KeyBinding.
func (KeyBinding) Fields() []ent.Field {
	return []ent.Field{
		field.String("key").
			MaxLen(100).
			NotEmpty().
			Unique().
			StructTag(`json:"key"`).
			Comment("key binding key"),
		field.String("command").
			MaxLen(100).
			NotEmpty().
			StructTag(`json:"command"`).
			Comment("key binding command"),
		field.String("extension").
			MaxLen(100).
			Optional().
			StructTag(`json:"extension,omitempty"`).
			Comment("key binding extension"),
		field.Bool("enabled").
			Default(true).
			StructTag(`json:"enabled"`).
			Comment("key binding enabled"),
	}
}

// Edges of the KeyBinding.
func (KeyBinding) Edges() []ent.Edge {
	return nil
}

// Indexes of the KeyBinding.
func (KeyBinding) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("extension"),
		index.Fields("enabled"),
	}
}
