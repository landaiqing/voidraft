package merge

import (
	"context"
	"sort"
	"time"
	"voidraft/internal/syncer/snapshot"
)

// UpdatedAtWinsMerger 使用 updated_at 作为默认冲突解决依据。
type UpdatedAtWinsMerger struct{}

// NewUpdatedAtWinsMerger 创建新的默认合并器。
func NewUpdatedAtWinsMerger() *UpdatedAtWinsMerger {
	return &UpdatedAtWinsMerger{}
}

// Merge 合并本地与远端快照。
func (m *UpdatedAtWinsMerger) Merge(ctx context.Context, local *snapshot.Snapshot, remote *snapshot.Snapshot) (*snapshot.Snapshot, Report, error) {
	_ = ctx

	localSnapshot := snapshot.Clone(local)
	remoteSnapshot := snapshot.Clone(remote)

	index := make(map[string]snapshot.Record)
	report := Report{}

	for _, kind := range sortedKinds(localSnapshot, remoteSnapshot) {
		for _, record := range localSnapshot.Resources[kind] {
			index[recordKey(kind, record.ID)] = snapshot.CloneRecord(record)
		}
		for _, remoteRecord := range remoteSnapshot.Resources[kind] {
			key := recordKey(kind, remoteRecord.ID)
			localRecord, exists := index[key]
			if !exists {
				index[key] = snapshot.CloneRecord(remoteRecord)
				report.Added++
				continue
			}

			switch {
			case remoteRecord.UpdatedAt.After(localRecord.UpdatedAt):
				index[key] = snapshot.CloneRecord(remoteRecord)
				report.Updated++
			case remoteRecord.UpdatedAt.Equal(localRecord.UpdatedAt):
				if snapshot.RecordDigest(localRecord) != snapshot.RecordDigest(remoteRecord) {
					report.Conflicts++
				}
			default:
				if remoteRecord.DeletedAt != nil && localRecord.DeletedAt == nil {
					report.Deleted++
				}
			}
		}
	}

	merged := snapshot.New()
	for _, key := range sortedKeys(index) {
		record := index[key]
		merged.Resources[record.Kind] = append(merged.Resources[record.Kind], snapshot.CloneRecord(record))
	}
	merged.CreatedAt = time.Now()

	return merged, report, nil
}

// sortedKinds 返回两个快照内的全部资源类型集合。
func sortedKinds(local *snapshot.Snapshot, remote *snapshot.Snapshot) []string {
	index := make(map[string]struct{})
	for kind := range local.Resources {
		index[kind] = struct{}{}
	}
	for kind := range remote.Resources {
		index[kind] = struct{}{}
	}

	kinds := make([]string, 0, len(index))
	for kind := range index {
		kinds = append(kinds, kind)
	}
	sort.Strings(kinds)
	return kinds
}

// sortedKeys 返回稳定排序后的索引键集合。
func sortedKeys(index map[string]snapshot.Record) []string {
	keys := make([]string, 0, len(index))
	for key := range index {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

// recordKey 生成 record 的稳定索引键。
func recordKey(kind string, id string) string {
	return kind + ":" + id
}
