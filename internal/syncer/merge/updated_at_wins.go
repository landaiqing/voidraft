package merge

import (
	"bytes"
	"context"
	"fmt"
	"reflect"
	"sort"
	"strings"
	"time"
	"voidraft/internal/syncer/snapshot"

	"github.com/google/uuid"
)

const (
	documentKind      = "documents"
	recordUUIDKey     = "uuid"
	recordTitleKey    = "title"
	recordCreatedAt   = "created_at"
	recordUpdatedAt   = "updated_at"
	recordDeletedAt   = "deleted_at"
	conflictTimeLabel = "2006-01-02 15:04:05"
)

// UpdatedAtWinsMerger merges snapshots using timestamps as the primary signal.
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
		records := m.mergeKind(kind, localSnapshot.Resources[kind], remoteSnapshot.Resources[kind], &report)
		if len(records) == 0 {
			continue
		}

		sort.Slice(records, func(i int, j int) bool {
			return records[i].ID < records[j].ID
		})
		merged.Resources[kind] = records
	}

	merged.CreatedAt = time.Now()
	return merged, report.Normalize(), nil
}

// mergeKind merges all records for one resource kind.
func (m *UpdatedAtWinsMerger) mergeKind(kind string, localRecords []snapshot.Record, remoteRecords []snapshot.Record, report *Report) []snapshot.Record {
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
			records, delta := m.mergePair(kind, localRecord, remoteRecord)
			merged = append(merged, records...)
			report.Added += delta.Added
			report.Updated += delta.Updated
			report.Deleted += delta.Deleted
			report.Conflicts += delta.Conflicts
			report.ConflictIDs = append(report.ConflictIDs, delta.ConflictIDs...)
		}
	}

	return merged
}

// mergePair merges one local/remote record pair.
func (m *UpdatedAtWinsMerger) mergePair(kind string, localRecord snapshot.Record, remoteRecord snapshot.Record) ([]snapshot.Record, Report) {
	report := Report{}
	localEventAt := recordEventAt(localRecord)
	remoteEventAt := recordEventAt(remoteRecord)

	switch {
	case remoteEventAt.After(localEventAt):
		report.Updated = 1
		if remoteRecord.DeletedAt != nil && localRecord.DeletedAt == nil {
			report.Deleted = 1
		}
		return []snapshot.Record{snapshot.CloneRecord(remoteRecord)}, report
	case localEventAt.After(remoteEventAt):
		if localRecord.DeletedAt != nil && remoteRecord.DeletedAt == nil {
			report.Deleted = 1
		}
		return []snapshot.Record{snapshot.CloneRecord(localRecord)}, report
	}

	if localRecord.DeletedAt != nil || remoteRecord.DeletedAt != nil {
		winner := snapshot.CloneRecord(localRecord)
		if localRecord.DeletedAt == nil && remoteRecord.DeletedAt != nil {
			winner = snapshot.CloneRecord(remoteRecord)
		}
		if winner.DeletedAt != nil && (localRecord.DeletedAt == nil || remoteRecord.DeletedAt == nil) {
			report.Deleted = 1
		}
		return []snapshot.Record{winner}, report
	}

	if snapshot.RecordDigest(localRecord) == snapshot.RecordDigest(remoteRecord) {
		return []snapshot.Record{snapshot.CloneRecord(localRecord)}, report
	}

	report.Conflicts = 1
	report.ConflictIDs = []string{localRecord.ID}

	if kind == documentKind {
		report.Added = 1
		return []snapshot.Record{
			snapshot.CloneRecord(localRecord),
			buildDocumentConflictCopy(remoteRecord),
		}, report
	}

	return []snapshot.Record{mergeRecordFields(localRecord, remoteRecord)}, report
}

// buildDocumentConflictCopy creates an extra document record for the remote variant.
func buildDocumentConflictCopy(record snapshot.Record) snapshot.Record {
	conflict := snapshot.CloneRecord(record)
	now := time.Now().UTC()
	conflictID := uuid.NewString()
	title, _ := conflict.Values[recordTitleKey].(string)
	title = strings.TrimSpace(title)
	if title == "" {
		title = conflict.ID
	}

	conflict.ID = conflictID
	conflict.UpdatedAt = now
	conflict.DeletedAt = nil
	conflict.Values[recordUUIDKey] = conflictID
	conflict.Values[recordTitleKey] = fmt.Sprintf("%s (Conflict %s)", title, now.Format(conflictTimeLabel))
	conflict.Values[recordCreatedAt] = now.Format(time.RFC3339)
	conflict.Values[recordUpdatedAt] = now.Format(time.RFC3339)
	delete(conflict.Values, recordDeletedAt)

	return conflict
}

// mergeRecordFields merges non-document records field by field.
func mergeRecordFields(localRecord snapshot.Record, remoteRecord snapshot.Record) snapshot.Record {
	merged := snapshot.CloneRecord(localRecord)
	merged.Values = mergeValueMaps(localRecord.Values, remoteRecord.Values)
	merged.Blobs = mergeBlobMaps(localRecord.Blobs, remoteRecord.Blobs)
	merged.DeletedAt = nil
	return merged
}

// mergeValueMaps merges nested maps while keeping local values on direct conflicts.
func mergeValueMaps(local map[string]interface{}, remote map[string]interface{}) map[string]interface{} {
	merged := make(map[string]interface{}, len(local)+len(remote))
	for key, value := range local {
		merged[key] = cloneValue(value)
	}

	for key, remoteValue := range remote {
		localValue, exists := merged[key]
		if !exists {
			merged[key] = cloneValue(remoteValue)
			continue
		}
		merged[key] = mergeValue(localValue, remoteValue)
	}

	return merged
}

// mergeValue merges one field value, recursively handling nested maps.
func mergeValue(localValue interface{}, remoteValue interface{}) interface{} {
	localMap, localIsMap := localValue.(map[string]interface{})
	remoteMap, remoteIsMap := remoteValue.(map[string]interface{})
	if localIsMap && remoteIsMap {
		return mergeValueMaps(localMap, remoteMap)
	}

	if reflect.DeepEqual(localValue, remoteValue) {
		return cloneValue(localValue)
	}

	if localValue == nil {
		return cloneValue(remoteValue)
	}

	return cloneValue(localValue)
}

// mergeBlobMaps keeps all unique blob keys and preserves local data on collisions.
func mergeBlobMaps(local map[string][]byte, remote map[string][]byte) map[string][]byte {
	if len(local) == 0 && len(remote) == 0 {
		return nil
	}

	merged := make(map[string][]byte, len(local)+len(remote))
	for key, value := range local {
		merged[key] = append([]byte(nil), value...)
	}
	for key, value := range remote {
		if localValue, exists := merged[key]; exists && !bytes.Equal(localValue, value) {
			continue
		}
		merged[key] = append([]byte(nil), value...)
	}

	return merged
}

// cloneValue deep-clones JSON-like values used in snapshot records.
func cloneValue(value interface{}) interface{} {
	switch typed := value.(type) {
	case map[string]interface{}:
		cloned := make(map[string]interface{}, len(typed))
		for key, item := range typed {
			cloned[key] = cloneValue(item)
		}
		return cloned
	case []interface{}:
		cloned := make([]interface{}, len(typed))
		for index, item := range typed {
			cloned[index] = cloneValue(item)
		}
		return cloned
	default:
		return typed
	}
}

// recordEventAt returns the timestamp used to compare delete/modify events.
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
