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
		field.String("name").
			MaxLen(100).
			NotEmpty().
			StructTag(`json:"name"`).
			Comment("command identifier"),

		field.String("type").
			MaxLen(20).
			Default("standard").
			StructTag(`json:"type"`).
			Comment("keybinding type: standard or emacs"),

		field.String("key").
			MaxLen(100).
			Optional().
			StructTag(`json:"key,omitempty"`).
			Comment("universal keybinding (cross-platform)"),
		field.String("macos").
			MaxLen(100).
			Optional().
			StructTag(`json:"macos,omitempty"`).
			Comment("macOS specific keybinding"),
		field.String("windows").
			MaxLen(100).
			Optional().
			StructTag(`json:"windows,omitempty"`).
			Comment("Windows specific keybinding"),
		field.String("linux").
			MaxLen(100).
			Optional().
			StructTag(`json:"linux,omitempty"`).
			Comment("Linux specific keybinding"),

		field.String("extension").
			MaxLen(100).
			NotEmpty().
			StructTag(`json:"extension"`).
			Comment("extension name (functional category)"),
		field.Bool("enabled").
			Default(true).
			StructTag(`json:"enabled"`).
			Comment("whether this keybinding is enabled"),

		field.Bool("prevent_default").
			Default(true).
			StructTag(`json:"preventDefault"`).
			Comment("prevent browser default behavior"),
		field.String("scope").
			MaxLen(100).
			Default("editor").
			StructTag(`json:"scope,omitempty"`).
			Comment("keybinding scope (default: editor)"),
	}
}

// Edges of the KeyBinding.
func (KeyBinding) Edges() []ent.Edge {
	return nil
}

// Indexes of the KeyBinding.
func (KeyBinding) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("name"),                  // 命令标识符索引
		index.Fields("type"),                  // 类型索引
		index.Fields("type", "name").Unique(), // 类型+命令的联合唯一索引
		index.Fields("extension"),             // 扩展索引
		index.Fields("enabled"),               // 启用状态索引
	}
}
