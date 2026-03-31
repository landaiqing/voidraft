package merge

import (
	"context"
	"sort"
	"time"
	"voidraft/internal/syncer/snapshot"
)

// UpdatedAtWinsMerger merges snapshots using the latest event time.
type UpdatedAtWinsMerger struct{}

// NewUpdatedAtWinsMerger creates the default merger.
func NewUpdatedAtWinsMerger() *UpdatedAtWinsMerger {
	return &UpdatedAtWinsMerger{}
}

// Merge merges the local and remote snapshots.
func (m *UpdatedAtWinsMerger) Merge(ctx context.Context, local *snapshot.Snapshot, remote *snapshot.Snapshot) (*snapshot.Snapshot, Report, error) {
	_ = ctx

	localSnapshot := snapshot.Clone(local)
	remoteSnapshot := snapshot.Clone(remote)

	merged := snapshot.New()
	report := Report{}

	for _, kind := range sortedKinds(localSnapshot, remoteSnapshot) {
		records := m.mergeKind(localSnapshot.Resources[kind], remoteSnapshot.Resources[kind], &report)
		if len(records) == 0 {
			continue
		}

		sort.Slice(records, func(i int, j int) bool {
			return records[i].ID < records[j].ID
		})
		merged.Resources[kind] = records
	}

	merged.CreatedAt = time.Now()
	return merged, report, nil
}

// mergeKind merges all records for one resource kind.
func (m *UpdatedAtWinsMerger) mergeKind(localRecords []snapshot.Record, remoteRecords []snapshot.Record, report *Report) []snapshot.Record {
	localIndex := make(map[string]snapshot.Record, len(localRecords))
	for _, record := range localRecords {
		localIndex[record.ID] = snapshot.CloneRecord(record)
	}

	remoteIndex := make(map[string]snapshot.Record, len(remoteRecords))
	for _, record := range remoteRecords {
		remoteIndex[record.ID] = snapshot.CloneRecord(record)
	}

	ids := sortedRecordIDs(localIndex, remoteIndex)
	merged := make([]snapshot.Record, 0, len(ids))

	for _, id := range ids {
		localRecord, hasLocal := localIndex[id]
		remoteRecord, hasRemote := remoteIndex[id]

		switch {
		case !hasLocal:
			report.Added++
			merged = append(merged, snapshot.CloneRecord(remoteRecord))
		case !hasRemote:
			merged = append(merged, snapshot.CloneRecord(localRecord))
		default:
			record, delta := m.mergePair(localRecord, remoteRecord)
			merged = append(merged, record)
			report.Added += delta.Added
			report.Updated += delta.Updated
			report.Deleted += delta.Deleted
		}
	}

	return merged
}

// mergePair merges one local and remote record pair.
func (m *UpdatedAtWinsMerger) mergePair(localRecord snapshot.Record, remoteRecord snapshot.Record) (snapshot.Record, Report) {
	report := Report{}
	localEventAt := recordEventAt(localRecord)
	remoteEventAt := recordEventAt(remoteRecord)

	switch {
	case remoteEventAt.After(localEventAt):
		report.Updated = 1
		if remoteRecord.DeletedAt != nil && localRecord.DeletedAt == nil {
			report.Deleted = 1
		}
		return snapshot.CloneRecord(remoteRecord), report
	case localEventAt.After(remoteEventAt):
		if localRecord.DeletedAt != nil && remoteRecord.DeletedAt == nil {
			report.Deleted = 1
		}
		return snapshot.CloneRecord(localRecord), report
	default:
		localDigest, localErr := snapshot.RecordDigest(localRecord)
		remoteDigest, remoteErr := snapshot.RecordDigest(remoteRecord)
		if localErr == nil && remoteErr == nil && localDigest == remoteDigest {
			return snapshot.CloneRecord(localRecord), report
		}

		report.Updated = 1
		if remoteRecord.DeletedAt != nil && localRecord.DeletedAt == nil {
			report.Deleted = 1
		}
		return snapshot.CloneRecord(remoteRecord), report
	}
}

// recordEventAt returns the timestamp used to compare update and delete events.
func recordEventAt(record snapshot.Record) time.Time {
	if record.DeletedAt != nil && record.DeletedAt.After(record.UpdatedAt) {
		return *record.DeletedAt
	}
	return record.UpdatedAt
}

// sortedKinds returns all resource kinds from both snapshots in stable order.
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

// sortedRecordIDs returns the union of local and remote record IDs in stable order.
func sortedRecordIDs(local map[string]snapshot.Record, remote map[string]snapshot.Record) []string {
	ids := make([]string, 0, len(local)+len(remote))
	seen := make(map[string]struct{}, len(local)+len(remote))

	for id := range local {
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	for id := range remote {
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}

	sort.Strings(ids)
	return ids
}
