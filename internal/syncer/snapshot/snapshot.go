package snapshot

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"sort"
	"strings"
	"time"
)

const (
	// CurrentVersion 是当前快照格式版本。
	CurrentVersion = 1
)

// Snapshot 描述一次完整的数据快照。
type Snapshot struct {
	Version   int
	CreatedAt time.Time
	Resources map[string][]Record
}

// Record 描述单条资源记录。
type Record struct {
	Kind      string
	ID        string
	UpdatedAt time.Time
	DeletedAt *time.Time
	Values    map[string]interface{}
	Blobs     map[string][]byte
}

// Snapshotter 描述快照导出与应用接口。
type Snapshotter interface {
	Export(ctx context.Context) (*Snapshot, error)
	Apply(ctx context.Context, snap *Snapshot) error
}

// New 创建新的空快照。
func New() *Snapshot {
	return &Snapshot{
		Version:   CurrentVersion,
		CreatedAt: time.Now(),
		Resources: make(map[string][]Record),
	}
}

// NewRecord 根据业务字段构造规范化记录。
func NewRecord(kind string, id string, values map[string]interface{}, blobs map[string][]byte) (Record, error) {
	if strings.TrimSpace(kind) == "" {
		return Record{}, errors.New("record kind is required")
	}

	normalizedValues := cloneValues(values)
	if id == "" {
		uuid, _ := normalizedValues["uuid"].(string)
		id = uuid
	}
	if id == "" {
		return Record{}, errors.New("record id is required")
	}
	normalizedValues["uuid"] = id

	updatedAt, err := parseRequiredTime(normalizedValues["updated_at"])
	if err != nil {
		return Record{}, fmt.Errorf("record %s updated_at: %w", id, err)
	}

	deletedAt, err := parseOptionalTime(normalizedValues["deleted_at"])
	if err != nil {
		return Record{}, fmt.Errorf("record %s deleted_at: %w", id, err)
	}

	return Record{
		Kind:      kind,
		ID:        id,
		UpdatedAt: updatedAt,
		DeletedAt: deletedAt,
		Values:    normalizedValues,
		Blobs:     cloneBlobs(blobs),
	}, nil
}

// Clone 返回快照的深拷贝。
func Clone(snap *Snapshot) *Snapshot {
	if snap == nil {
		return New()
	}

	cloned := &Snapshot{
		Version:   snap.Version,
		CreatedAt: snap.CreatedAt,
		Resources: make(map[string][]Record, len(snap.Resources)),
	}
	for kind, records := range snap.Resources {
		copied := make([]Record, 0, len(records))
		for _, record := range records {
			copied = append(copied, CloneRecord(record))
		}
		cloned.Resources[kind] = copied
	}
	return cloned
}

// CloneRecord 返回记录的深拷贝。
func CloneRecord(record Record) Record {
	return Record{
		Kind:      record.Kind,
		ID:        record.ID,
		UpdatedAt: record.UpdatedAt,
		DeletedAt: cloneTime(record.DeletedAt),
		Values:    cloneValues(record.Values),
		Blobs:     cloneBlobs(record.Blobs),
	}
}

// Digest 计算快照的稳定摘要。
func Digest(snap *Snapshot) (string, error) {
	normalized := Clone(snap)

	type digestRecord struct {
		ID        string                 `json:"id"`
		UpdatedAt string                 `json:"updated_at"`
		DeletedAt *string                `json:"deleted_at,omitempty"`
		Values    map[string]interface{} `json:"values"`
		Blobs     map[string][]byte      `json:"blobs,omitempty"`
	}

	payload := struct {
		Version   int                       `json:"version"`
		Resources map[string][]digestRecord `json:"resources"`
	}{
		Version:   normalized.Version,
		Resources: make(map[string][]digestRecord, len(normalized.Resources)),
	}

	for _, kind := range sortedKinds(normalized.Resources) {
		records := normalized.Resources[kind]
		sort.Slice(records, func(i int, j int) bool {
			return records[i].ID < records[j].ID
		})

		items := make([]digestRecord, 0, len(records))
		for _, record := range records {
			var deletedAt *string
			if record.DeletedAt != nil {
				value := record.DeletedAt.Format(time.RFC3339)
				deletedAt = &value
			}
			items = append(items, digestRecord{
				ID:        record.ID,
				UpdatedAt: record.UpdatedAt.Format(time.RFC3339),
				DeletedAt: deletedAt,
				Values:    record.Values,
				Blobs:     record.Blobs,
			})
		}
		payload.Resources[kind] = items
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:]), nil
}

// RecordDigest 计算单条记录的稳定摘要。
func RecordDigest(record Record) string {
	sum, err := Digest(&Snapshot{
		Version: CurrentVersion,
		Resources: map[string][]Record{
			record.Kind: {CloneRecord(record)},
		},
	})
	if err != nil {
		return ""
	}
	return sum
}

// cloneValues 复制字段 map。
func cloneValues(values map[string]interface{}) map[string]interface{} {
	if values == nil {
		return map[string]interface{}{}
	}
	return maps.Clone(values)
}

// cloneBlobs 复制二进制 blob 集合。
func cloneBlobs(blobs map[string][]byte) map[string][]byte {
	if len(blobs) == 0 {
		return nil
	}
	copied := make(map[string][]byte, len(blobs))
	for name, blob := range blobs {
		copied[name] = append([]byte(nil), blob...)
	}
	return copied
}

// cloneTime 复制时间指针。
func cloneTime(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}
	cloned := *value
	return &cloned
}

// parseRequiredTime 解析必填时间字段。
func parseRequiredTime(value interface{}) (time.Time, error) {
	text, _ := value.(string)
	if text == "" {
		return time.Time{}, errors.New("time value is required")
	}
	return time.Parse(time.RFC3339, text)
}

// parseOptionalTime 解析可选时间字段。
func parseOptionalTime(value interface{}) (*time.Time, error) {
	text, _ := value.(string)
	if text == "" {
		return nil, nil
	}
	parsed, err := time.Parse(time.RFC3339, text)
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}

// sortedKinds 返回稳定排序后的资源类型列表。
func sortedKinds(resources map[string][]Record) []string {
	kinds := make([]string, 0, len(resources))
	for kind := range resources {
		kinds = append(kinds, kind)
	}
	sort.Strings(kinds)
	return kinds
}
