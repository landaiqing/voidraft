package resource

import (
	"context"
	"sort"
	"voidraft/internal/syncer/snapshot"
)

// Adapter 描述单类资源的导出与应用能力。
type Adapter interface {
	Kind() string
	Export(ctx context.Context) ([]snapshot.Record, error)
	Apply(ctx context.Context, records []snapshot.Record) error
}

// Registry 聚合所有资源适配器，并实现快照导入导出接口。
type Registry struct {
	adapters []Adapter
}

// NewRegistry 创建新的资源注册表。
func NewRegistry(adapters ...Adapter) *Registry {
	return &Registry{adapters: adapters}
}

// Export 导出所有已注册资源的快照。
func (r *Registry) Export(ctx context.Context) (*snapshot.Snapshot, error) {
	snap := snapshot.New()

	for _, adapter := range r.adapters {
		records, err := adapter.Export(ctx)
		if err != nil {
			return nil, err
		}
		if len(records) == 0 {
			continue
		}
		sort.Slice(records, func(i int, j int) bool {
			return records[i].ID < records[j].ID
		})
		snap.Resources[adapter.Kind()] = records
	}

	return snap, nil
}

// Apply 将快照内容应用到本地资源。
func (r *Registry) Apply(ctx context.Context, snap *snapshot.Snapshot) error {
	if snap == nil {
		return nil
	}

	for _, adapter := range r.adapters {
		records := snap.Resources[adapter.Kind()]
		if err := adapter.Apply(ctx, records); err != nil {
			return err
		}
	}

	return nil
}
