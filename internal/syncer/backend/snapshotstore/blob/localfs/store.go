package localfs

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"voidraft/internal/syncer/backend/snapshotstore/blob"
)

// Store 提供基于本地目录的 blob 存储实现。
type Store struct {
	rootPath string
}

// New 创建新的 localfs blob 存储。
func New(rootPath string) (*Store, error) {
	if strings.TrimSpace(rootPath) == "" {
		return nil, errors.New("localfs root path is required")
	}
	if err := os.MkdirAll(rootPath, 0755); err != nil {
		return nil, fmt.Errorf("create localfs root path: %w", err)
	}
	return &Store{rootPath: rootPath}, nil
}

// Get 读取对象内容。
func (s *Store) Get(ctx context.Context, key string) (io.ReadCloser, blob.ObjectInfo, error) {
	_ = ctx

	info, err := s.Stat(ctx, key)
	if err != nil {
		return nil, blob.ObjectInfo{}, err
	}

	path, err := s.resolvePath(key)
	if err != nil {
		return nil, blob.ObjectInfo{}, err
	}

	reader, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, blob.ObjectInfo{}, blob.ErrObjectNotFound
		}
		return nil, blob.ObjectInfo{}, err
	}

	return reader, info, nil
}

// Put 写入对象内容。
func (s *Store) Put(ctx context.Context, key string, body io.Reader, options blob.PutOptions) (blob.ObjectInfo, error) {
	_ = ctx

	path, err := s.resolvePath(key)
	if err != nil {
		return blob.ObjectInfo{}, err
	}

	if options.IfMatch != "" {
		currentInfo, err := s.Stat(ctx, key)
		if err != nil {
			if errors.Is(err, blob.ErrObjectNotFound) {
				return blob.ObjectInfo{}, blob.ErrConditionNotMet
			}
			return blob.ObjectInfo{}, err
		}
		if currentInfo.Revision != options.IfMatch {
			return blob.ObjectInfo{}, blob.ErrConditionNotMet
		}
	}

	data, err := io.ReadAll(body)
	if err != nil {
		return blob.ObjectInfo{}, err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return blob.ObjectInfo{}, err
	}

	tempFile, err := os.CreateTemp(filepath.Dir(path), "blob-put-*")
	if err != nil {
		return blob.ObjectInfo{}, err
	}
	tempName := tempFile.Name()

	if _, err := tempFile.Write(data); err != nil {
		tempFile.Close()
		_ = os.Remove(tempName)
		return blob.ObjectInfo{}, err
	}
	if err := tempFile.Close(); err != nil {
		_ = os.Remove(tempName)
		return blob.ObjectInfo{}, err
	}
	if err := os.Rename(tempName, path); err != nil {
		_ = os.Remove(tempName)
		return blob.ObjectInfo{}, err
	}

	return blob.ObjectInfo{
		Key:      key,
		Revision: digest(data),
		Size:     int64(len(data)),
	}, nil
}

// Stat 返回对象元信息。
func (s *Store) Stat(ctx context.Context, key string) (blob.ObjectInfo, error) {
	_ = ctx

	path, err := s.resolvePath(key)
	if err != nil {
		return blob.ObjectInfo{}, err
	}

	file, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return blob.ObjectInfo{}, blob.ErrObjectNotFound
		}
		return blob.ObjectInfo{}, err
	}
	defer file.Close()

	hash := sha256.New()
	size, err := io.Copy(hash, file)
	if err != nil {
		return blob.ObjectInfo{}, err
	}

	return blob.ObjectInfo{
		Key:      key,
		Revision: hex.EncodeToString(hash.Sum(nil)),
		Size:     size,
	}, nil
}

// Delete 删除指定对象。
func (s *Store) Delete(ctx context.Context, key string) error {
	_ = ctx

	path, err := s.resolvePath(key)
	if err != nil {
		return err
	}
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

// resolvePath 将对象键转换为安全路径。
func (s *Store) resolvePath(key string) (string, error) {
	normalized := filepath.Clean(filepath.FromSlash(key))
	if normalized == "." || normalized == string(filepath.Separator) {
		return "", errors.New("invalid blob key")
	}

	path := filepath.Join(s.rootPath, normalized)
	rel, err := filepath.Rel(s.rootPath, path)
	if err != nil {
		return "", err
	}
	if strings.HasPrefix(rel, "..") {
		return "", errors.New("blob key escapes root path")
	}
	return path, nil
}

// digest 计算内容摘要。
func digest(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}
