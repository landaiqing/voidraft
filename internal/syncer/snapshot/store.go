package snapshot

import (
	"context"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const manifestFileName = "manifest.json"

// Store 描述快照落盘与读取能力。
type Store interface {
	Read(ctx context.Context, root string) (*Snapshot, error)
	Write(ctx context.Context, root string, snap *Snapshot) error
}

// FileStore 提供基于目录树的快照读写实现。
type FileStore struct{}

type manifest struct {
	Version   int    `json:"version"`
	CreatedAt string `json:"created_at"`
}

// NewFileStore 创建新的文件快照存储。
func NewFileStore() *FileStore {
	return &FileStore{}
}

// Read 从目录树读取快照。
func (s *FileStore) Read(ctx context.Context, root string) (*Snapshot, error) {
	_ = ctx

	info, err := os.Stat(root)
	if os.IsNotExist(err) {
		return New(), nil
	}
	if err != nil {
		return nil, err
	}
	if !info.IsDir() {
		return New(), nil
	}

	snap := New()
	if err := s.readManifest(root, snap); err != nil {
		return nil, err
	}

	entries, err := os.ReadDir(root)
	if err != nil {
		return nil, err
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		kind := entry.Name()
		records, err := s.readKind(filepath.Join(root, kind), kind)
		if err != nil {
			return nil, err
		}
		if len(records) == 0 {
			continue
		}
		sort.Slice(records, func(i int, j int) bool {
			return records[i].ID < records[j].ID
		})
		snap.Resources[kind] = records
	}

	return snap, nil
}

// Write 将快照写入目录树。
func (s *FileStore) Write(ctx context.Context, root string, snap *Snapshot) error {
	_ = ctx

	if err := os.RemoveAll(root); err != nil {
		return err
	}
	if err := os.MkdirAll(root, 0755); err != nil {
		return err
	}

	if err := s.writeManifest(root, snap); err != nil {
		return err
	}

	for _, kind := range sortedKinds(snap.Resources) {
		kindDir := filepath.Join(root, kind)
		if err := os.MkdirAll(kindDir, 0755); err != nil {
			return err
		}

		records := append([]Record(nil), snap.Resources[kind]...)
		sort.Slice(records, func(i int, j int) bool {
			return records[i].ID < records[j].ID
		})

		for _, record := range records {
			if !record.HasBlobs() {
				if err := writeJSON(filepath.Join(kindDir, record.ID+".json"), record.Values); err != nil {
					return err
				}
				continue
			}

			recordDir := filepath.Join(kindDir, record.ID)
			if err := os.MkdirAll(recordDir, 0755); err != nil {
				return err
			}
			if err := writeJSON(filepath.Join(recordDir, "record.json"), record.Values); err != nil {
				return err
			}

			for _, blobName := range record.BlobNames() {
				targetPath := filepath.Join(recordDir, blobName)
				if sourcePath, ok := record.BlobFilePath(blobName); ok {
					if err := copyFile(targetPath, sourcePath); err != nil {
						return err
					}
					continue
				}

				content, ok, err := record.BlobBytes(blobName)
				if err != nil {
					return err
				}
				if !ok {
					continue
				}
				if err := os.WriteFile(targetPath, content, 0644); err != nil {
					return err
				}
			}
		}
	}

	return nil
}

// readManifest 读取快照 manifest。
func (s *FileStore) readManifest(root string, snap *Snapshot) error {
	data, err := os.ReadFile(filepath.Join(root, manifestFileName))
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}

	var current manifest
	if err := json.Unmarshal(data, &current); err != nil {
		return err
	}

	snap.Version = current.Version
	if current.CreatedAt != "" {
		createdAt, err := time.Parse(time.RFC3339, current.CreatedAt)
		if err != nil {
			return err
		}
		snap.CreatedAt = createdAt
	}
	return nil
}

// writeManifest 写入快照 manifest。
func (s *FileStore) writeManifest(root string, snap *Snapshot) error {
	payload := manifest{
		Version:   snap.Version,
		CreatedAt: snap.CreatedAt.Format(time.RFC3339),
	}
	return writeJSON(filepath.Join(root, manifestFileName), payload)
}

// readKind 读取单类资源目录。
func (s *FileStore) readKind(root string, kind string) ([]Record, error) {
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil, err
	}

	records := make([]Record, 0, len(entries))
	for _, entry := range entries {
		switch {
		case entry.IsDir():
			record, err := s.readBlobRecord(filepath.Join(root, entry.Name()), kind)
			if err != nil {
				return nil, err
			}
			records = append(records, record)
		case strings.HasSuffix(entry.Name(), ".json"):
			record, err := s.readFlatRecord(filepath.Join(root, entry.Name()), kind)
			if err != nil {
				return nil, err
			}
			records = append(records, record)
		}
	}
	return records, nil
}

// readFlatRecord 读取单文件记录。
func (s *FileStore) readFlatRecord(path string, kind string) (Record, error) {
	values, err := readValues(path)
	if err != nil {
		return Record{}, err
	}

	id := strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))
	return NewRecord(kind, id, values, nil)
}

// readBlobRecord 读取目录型记录。
func (s *FileStore) readBlobRecord(root string, kind string) (Record, error) {
	values, err := readValues(filepath.Join(root, "record.json"))
	if err != nil {
		return Record{}, err
	}

	entries, err := os.ReadDir(root)
	if err != nil {
		return Record{}, err
	}

	blobFiles := make(map[string]string)
	for _, entry := range entries {
		if entry.IsDir() || entry.Name() == "record.json" {
			continue
		}
		blobFiles[entry.Name()] = filepath.Join(root, entry.Name())
	}

	return NewRecordWithBlobFiles(kind, filepath.Base(root), values, blobFiles)
}

// readValues 读取 JSON 字段集合。
func readValues(path string) (map[string]interface{}, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	values := make(map[string]interface{})
	if err := json.Unmarshal(data, &values); err != nil {
		return nil, err
	}
	return values, nil
}

// writeJSON 将结构体格式化写入 JSON 文件。
func writeJSON(path string, value interface{}) error {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')

	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func copyFile(targetPath string, sourcePath string) error {
	source, err := os.Open(sourcePath)
	if err != nil {
		return err
	}
	defer source.Close()

	if err := os.MkdirAll(filepath.Dir(targetPath), 0755); err != nil {
		return err
	}

	target, err := os.Create(targetPath)
	if err != nil {
		return err
	}
	closed := false
	defer func() {
		if !closed {
			_ = target.Close()
		}
	}()

	if _, err := io.Copy(target, source); err != nil {
		return err
	}
	if err := target.Close(); err != nil {
		return err
	}
	closed = true
	return nil
}
