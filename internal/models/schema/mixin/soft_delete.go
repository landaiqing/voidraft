package mixin

import (
	"context"
	"fmt"
	entmodel "voidraft/internal/models/ent"
	entintercept "voidraft/internal/models/ent/intercept"

	"entgo.io/ent"
	"entgo.io/ent/dialect/sql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"entgo.io/ent/schema/mixin"
)

// SoftDeleteMixin 实现软删除模式
// 使用方法：
//   - 正常删除（软删除）: client.User.DeleteOneID(id).Exec(ctx)
//   - 永久删除: client.User.DeleteOneID(id).Exec(SkipSoftDelete(ctx))
//   - 查询包含已删除: client.User.Query().All(SkipSoftDelete(ctx))
//
// 参考：https://entgo.io/docs/interceptors/#soft-delete
type SoftDeleteMixin struct {
	mixin.Schema
}

// Fields of the SoftDeleteMixin.
func (SoftDeleteMixin) Fields() []ent.Field {
	return []ent.Field{
		field.String("deleted_at").
			Optional().
			Nillable().
			Comment("deleted at"),
	}
}

// Indexes of the SoftDeleteMixin.
func (SoftDeleteMixin) Indexes() []ent.Index {
	return []ent.Index{
		// 注意：部分索引 WHERE deleted_at IS NOT NULL 已在各表中单独定义
		index.Fields("deleted_at"),
	}
}

// softDeleteKey 用于在 context 中传递是否跳过软删除的标志
type softDeleteKey struct{}

// SkipSoftDelete 返回一个新的 context，跳过软删除拦截器和钩子
func SkipSoftDelete(parent context.Context) context.Context {
	return context.WithValue(parent, softDeleteKey{}, true)
}

// Interceptors of the SoftDeleteMixin.
func (d SoftDeleteMixin) Interceptors() []ent.Interceptor {
	return []ent.Interceptor{
		entintercept.Func(func(ctx context.Context, q entintercept.Query) error {
			// 如果 context 中设置了跳过软删除标志，则不过滤
			if skip, _ := ctx.Value(softDeleteKey{}).(bool); skip {
				return nil
			}
			// 添加 WHERE deleted_at IS NULL 条件
			d.P(q)
			return nil
		}),
	}
}

// Hooks of the SoftDeleteMixin.
func (d SoftDeleteMixin) Hooks() []ent.Hook {
	return []ent.Hook{
		func(next ent.Mutator) ent.Mutator {
			return ent.MutateFunc(func(ctx context.Context, m ent.Mutation) (ent.Value, error) {
				originalOp := m.Op()

				// 只处理删除操作
				if originalOp != ent.OpDeleteOne && originalOp != ent.OpDelete {
					return next.Mutate(ctx, m)
				}

				// 如果 context 中设置了跳过软删除标志，则执行真正的删除
				if skip, _ := ctx.Value(softDeleteKey{}).(bool); skip {
					return next.Mutate(ctx, m)
				}

				// 类型断言，确保 mutation 支持软删除所需的方法
				mx, ok := m.(interface {
					SetOp(ent.Op)
					SetDeletedAt(string)
					WhereP(...func(*sql.Selector))
					Client() *entmodel.Client
				})
				if !ok {
					return nil, fmt.Errorf("SoftDeleteMixin: unexpected mutation type %T", m)
				}

				// 添加 WHERE deleted_at IS NULL 条件（确保不会重复软删除）
				d.P(mx)

				// 将删除操作转换为更新操作
				if originalOp == ent.OpDeleteOne {
					mx.SetOp(ent.OpUpdateOne)
				} else {
					mx.SetOp(ent.OpUpdate)
				}
				mx.SetDeletedAt(NowString())

				// 使用客户端重新分发 mutation，让 ent 按 Update/UpdateOne 执行。
				// 不能继续调用 next.Mutate，因为当前 builder 仍然是 Delete builder，
				// 最终会落到物理删除 SQL。
				value, err := mx.Client().Mutate(ctx, m)
				if err != nil {
					return nil, err
				}
				if originalOp == ent.OpDeleteOne {
					return 1, nil
				}
				return value, nil
			})
		},
	}
}

// P 添加存储层级的过滤条件到查询和变更操作
func (d SoftDeleteMixin) P(w interface{ WhereP(...func(*sql.Selector)) }) {
	w.WhereP(
		sql.FieldIsNull(d.Fields()[0].Descriptor().Name),
	)
}
