package mixin

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"entgo.io/ent/schema/mixin"
	"github.com/google/uuid"
)

// UUIDMixin 添加 UUID 字段用于跨设备同步
// 使用 UUIDv7，具有时间有序性，索引性能更好
type UUIDMixin struct {
	mixin.Schema
}

// Fields of the UUIDMixin.
func (UUIDMixin) Fields() []ent.Field {
	return []ent.Field{
		field.String("uuid").
			DefaultFunc(func() string {
				return uuid.Must(uuid.NewV7()).String()
			}).
			Unique().
			Immutable().
			StructTag(`json:"uuid"`).
			Comment("UUID for cross-device sync (UUIDv7)"),
	}
}

// Indexes of the UUIDMixin.
func (UUIDMixin) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("uuid"),
	}
}
