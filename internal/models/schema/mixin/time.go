package mixin

import (
	"context"
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/mixin"
)

// TimeFormat ISO 8601 时间格式
const TimeFormat = time.RFC3339

// NowString 返回当前时间的 ISO 8601 格式字符串
func NowString() string {
	return time.Now().Format(TimeFormat)
}

// skipAutoUpdateKey context key for skipping auto update
type skipAutoUpdateKey struct{}

// SkipAutoUpdate 返回跳过自动更新 updated_at 的 context
func SkipAutoUpdate(ctx context.Context) context.Context {
	return context.WithValue(ctx, skipAutoUpdateKey{}, true)
}

// TimeMixin 时间字段混入
// created_at: 创建时间
// updated_at: 更新时间（自动更新）
type TimeMixin struct {
	mixin.Schema
}

// Fields of the TimeMixin.
func (TimeMixin) Fields() []ent.Field {
	return []ent.Field{
		field.String("created_at").
			DefaultFunc(NowString).
			Immutable().
			StructTag(`json:"created_at"`).
			Comment("creation time"),
		field.String("updated_at").
			DefaultFunc(NowString).
			StructTag(`json:"updated_at"`).
			Comment("update time"),
	}
}

// Hooks of the TimeMixin.
func (TimeMixin) Hooks() []ent.Hook {
	return []ent.Hook{
		func(next ent.Mutator) ent.Mutator {
			return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
				// 跳过自动更新（用于同步导入场景）
				if ctx.Value(skipAutoUpdateKey{}) != nil {
					return next.Mutate(ctx, m)
				}
				// 只在更新操作时设置 updated_at
				if m.Op().Is(ent.OpUpdate | ent.OpUpdateOne) {
					if setter, ok := m.(interface{ SetUpdatedAt(string) }); ok {
						setter.SetUpdatedAt(NowString())
					}
				}
				return next.Mutate(ctx, m)
			})
		},
	}
}
