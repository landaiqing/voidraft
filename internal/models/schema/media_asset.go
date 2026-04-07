package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"

	"voidraft/internal/models/schema/mixin"
)

// MediaAsset holds the schema definition for the MediaAsset entity.
type MediaAsset struct {
	ent.Schema
}

// Annotations of the MediaAsset.
func (MediaAsset) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "media_assets"},
	}
}

// Mixin of the MediaAsset.
func (MediaAsset) Mixin() []ent.Mixin {
	return []ent.Mixin{
		mixin.TimeMixin{},
		mixin.UUIDMixin{},
	}
}

// Fields of the MediaAsset.
func (MediaAsset) Fields() []ent.Field {
	return []ent.Field{
		field.String("asset_id").
			MaxLen(64).
			NotEmpty().
			Unique().
			Immutable().
			StructTag(`json:"asset_id"`).
			Comment("stable media asset id derived from content sha256"),
		field.String("filename").
			MaxLen(255).
			Optional().
			Nillable().
			StructTag(`json:"filename,omitempty"`).
			Comment("imported filename"),
		field.String("path").
			MaxLen(1024).
			NotEmpty().
			Unique().
			StructTag(`json:"path"`).
			Comment("media path relative to media root"),
		field.String("mime_type").
			MaxLen(128).
			NotEmpty().
			StructTag(`json:"mime_type"`).
			Comment("image mime type"),
		field.Int64("size").
			NonNegative().
			StructTag(`json:"size"`).
			Comment("image byte size"),
		field.Int("width").
			NonNegative().
			StructTag(`json:"width"`).
			Comment("image width"),
		field.Int("height").
			NonNegative().
			StructTag(`json:"height"`).
			Comment("image height"),
	}
}

// Edges of the MediaAsset.
func (MediaAsset) Edges() []ent.Edge {
	return nil
}

// Indexes of the MediaAsset.
func (MediaAsset) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("asset_id"),
		index.Fields("path"),
		index.Fields("created_at"),
		index.Fields("updated_at"),
	}
}
