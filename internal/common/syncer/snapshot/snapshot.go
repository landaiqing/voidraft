package snapshot

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"hash"
	"io"
	"maps"
	"os"
	"sort"
	"strings"
	"sync"
	"time"
)

const (
	// CurrentVersion 是当前快照格式版本。
	CurrentVersion  = 1
	timestampFormat = time.RFC3339Nano
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
	BlobFiles map[string]string
}

type blobDigestCacheKey struct {
	path    string
	size    int64
	modTime int64
}

type blobSummary struct {
	size   int64
	digest string
}

var blobDigestCache sync.Map

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
	return newRecord(kind, id, values, blobs, nil)
}

// NewRecordWithBlobFiles builds one normalized record with blob file references.
func NewRecordWithBlobFiles(kind string, id string, values map[string]interface{}, blobFiles map[string]string) (Record, error) {
	return newRecord(kind, id, values, nil, blobFiles)
}

func newRecord(kind string, id string, values map[string]interface{}, blobs map[string][]byte, blobFiles map[string]string) (Record, error) {
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
		BlobFiles: cloneBlobFiles(blobFiles),
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
		BlobFiles: cloneBlobFiles(record.BlobFiles),
	}
}

// Digest 计算快照的稳定摘要。
func Digest(snap *Snapshot) (string, error) {
	normalized := Clone(snap)
	hasher := sha256.New()

	writeDigestUint64(hasher, uint64(normalized.Version))
	for _, kind := range sortedKinds(normalized.Resources) {
		writeDigestString(hasher, kind)

		records := normalized.Resources[kind]
		sort.Slice(records, func(i int, j int) bool {
			return records[i].ID < records[j].ID
		})
		writeDigestUint64(hasher, uint64(len(records)))

		for _, record := range records {
			recordDigest, err := RecordDigest(record)
			if err != nil {
				return "", err
			}
			writeDigestString(hasher, recordDigest)
		}
	}

	return hex.EncodeToString(hasher.Sum(nil)), nil
}

// RecordDigest 计算单条记录的稳定摘要。
func RecordDigest(record Record) (string, error) {
	type digestRecord struct {
		Kind      string                 `json:"kind"`
		ID        string                 `json:"id"`
		UpdatedAt string                 `json:"updated_at"`
		DeletedAt *string                `json:"deleted_at,omitempty"`
		Values    map[string]interface{} `json:"values"`
	}

	var deletedAt *string
	if record.DeletedAt != nil {
		value := record.DeletedAt.Format(timestampFormat)
		deletedAt = &value
	}

	payload, err := json.Marshal(digestRecord{
		Kind:      record.Kind,
		ID:        record.ID,
		UpdatedAt: record.UpdatedAt.Format(timestampFormat),
		DeletedAt: deletedAt,
		Values:    cloneValues(record.Values),
	})
	if err != nil {
		return "", err
	}

	hasher := sha256.New()
	writeDigestUint64(hasher, uint64(len(payload)))
	_, _ = hasher.Write(payload)

	for _, name := range record.BlobNames() {
		summary, err := recordBlobSummary(record, name)
		if err != nil {
			return "", err
		}
		writeDigestString(hasher, name)
		writeDigestUint64(hasher, uint64(summary.size))
		writeDigestString(hasher, summary.digest)
	}

	return hex.EncodeToString(hasher.Sum(nil)), nil
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

// cloneBlobFiles 复制 blob 文件引用集合。
func cloneBlobFiles(blobFiles map[string]string) map[string]string {
	if len(blobFiles) == 0 {
		return nil
	}
	return maps.Clone(blobFiles)
}

// cloneTime 复制时间指针。
func cloneTime(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}
	cloned := *value
	return &cloned
}

// HasBlobs reports whether the record includes any blob payload or blob file references.
func (r Record) HasBlobs() bool {
	return len(r.Blobs) > 0 || len(r.BlobFiles) > 0
}

// BlobNames returns all blob names in stable order.
func (r Record) BlobNames() []string {
	if !r.HasBlobs() {
		return nil
	}

	index := make(map[string]struct{}, len(r.Blobs)+len(r.BlobFiles))
	for name := range r.Blobs {
		index[name] = struct{}{}
	}
	for name := range r.BlobFiles {
		index[name] = struct{}{}
	}

	names := make([]string, 0, len(index))
	for name := range index {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

// BlobBytes reads one blob either from memory or from a referenced file.
func (r Record) BlobBytes(name string) ([]byte, bool, error) {
	if data, ok := r.Blobs[name]; ok {
		return append([]byte(nil), data...), true, nil
	}

	path, ok := r.BlobFiles[name]
	if !ok {
		return nil, false, nil
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, true, err
	}
	return data, true, nil
}

// BlobFilePath returns the on-disk blob path when the record references a file directly.
func (r Record) BlobFilePath(name string) (string, bool) {
	value, ok := r.BlobFiles[name]
	return value, ok
}

// parseRequiredTime 解析必填时间字段。
func parseRequiredTime(value interface{}) (time.Time, error) {
	text, _ := value.(string)
	if text == "" {
		return time.Time{}, errors.New("time value is required")
	}
	return time.Parse(timestampFormat, text)
}

// parseOptionalTime 解析可选时间字段。
func parseOptionalTime(value interface{}) (*time.Time, error) {
	text, _ := value.(string)
	if text == "" {
		return nil, nil
	}
	parsed, err := time.Parse(timestampFormat, text)
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

func recordBlobSummary(record Record, name string) (blobSummary, error) {
	if data, ok := record.Blobs[name]; ok {
		sum := sha256.Sum256(data)
		return blobSummary{
			size:   int64(len(data)),
			digest: hex.EncodeToString(sum[:]),
		}, nil
	}

	path, ok := record.BlobFiles[name]
	if !ok {
		return blobSummary{}, nil
	}
	return fileBlobSummary(path)
}

func fileBlobSummary(path string) (blobSummary, error) {
	info, err := os.Stat(path)
	if err != nil {
		return blobSummary{}, err
	}
	if info.IsDir() {
		return blobSummary{}, fmt.Errorf("blob path is a directory: %s", path)
	}

	cacheKey := blobDigestCacheKey{
		path:    path,
		size:    info.Size(),
		modTime: info.ModTime().UnixNano(),
	}
	if cached, ok := blobDigestCache.Load(cacheKey); ok {
		return blobSummary{
			size:   info.Size(),
			digest: cached.(string),
		}, nil
	}

	file, err := os.Open(path)
	if err != nil {
		return blobSummary{}, err
	}
	defer file.Close()

	hasher := sha256.New()
	size, err := io.Copy(hasher, file)
	if err != nil {
		return blobSummary{}, err
	}

	digest := hex.EncodeToString(hasher.Sum(nil))
	if size == info.Size() {
		blobDigestCache.Store(cacheKey, digest)
	}
	return blobSummary{
		size:   size,
		digest: digest,
	}, nil
}

func writeDigestString(hasher hash.Hash, value string) {
	writeDigestUint64(hasher, uint64(len(value)))
	_, _ = hasher.Write([]byte(value))
}

func writeDigestUint64(hasher hash.Hash, value uint64) {
	var buffer [8]byte
	binary.BigEndian.PutUint64(buffer[:], value)
	_, _ = hasher.Write(buffer[:])
}
