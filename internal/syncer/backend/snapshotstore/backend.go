package snapshotstore

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"time"
	"voidraft/internal/syncer/backend"
	"voidraft/internal/syncer/backend/snapshotstore/blob"
)

const (
	defaultNamespace = "sync"
	defaultHeadKey   = "head.json"
	bundleDirName    = "bundles"
)

var stableBundleTime = time.Unix(0, 0).UTC()

// Config 描述 snapshot_store 后端配置。
type Config struct {
	Store     blob.Store
	Namespace string
	HeadKey   string
}

type headDocument struct {
	Revision  string `json:"revision"`
	BundleKey string `json:"bundle_key"`
	UpdatedAt string `json:"updated_at"`
}

type headState struct {
	Document headDocument
	Info     blob.ObjectInfo
}

// Backend 提供基于对象/文件存储的快照后端实现。
type Backend struct {
	config Config
}

// New 创建新的 snapshot_store 后端。
func New(config Config) (*Backend, error) {
	if config.Store == nil {
		return nil, errors.New("snapshot store blob backend is required")
	}
	if strings.TrimSpace(config.Namespace) == "" {
		config.Namespace = defaultNamespace
	}
	if strings.TrimSpace(config.HeadKey) == "" {
		config.HeadKey = defaultHeadKey
	}
	return &Backend{config: config}, nil
}

// Verify 校验后端是否可读。
func (b *Backend) Verify(ctx context.Context) error {
	_, _, err := b.readHead(ctx)
	return err
}

// DownloadLatest 下载远端最新快照包并解压到目标目录。
func (b *Backend) DownloadLatest(ctx context.Context, dst string) (backend.RemoteState, error) {
	head, exists, err := b.readHead(ctx)
	if err != nil {
		return backend.RemoteState{}, err
	}
	if !exists {
		return backend.RemoteState{}, nil
	}

	reader, _, err := b.config.Store.Get(ctx, head.Document.BundleKey)
	if err != nil {
		if errors.Is(err, blob.ErrObjectNotFound) {
			return backend.RemoteState{}, nil
		}
		return backend.RemoteState{}, err
	}
	defer reader.Close()

	if err := recreateDir(dst); err != nil {
		return backend.RemoteState{}, err
	}
	if err := extractBundle(reader, dst); err != nil {
		return backend.RemoteState{}, err
	}

	return backend.RemoteState{
		Exists:   true,
		Revision: head.Document.Revision,
	}, nil
}

// Upload 打包并发布本地快照目录。
func (b *Backend) Upload(ctx context.Context, src string, options backend.PublishOptions) (backend.RemoteState, error) {
	currentHead, exists, err := b.readHead(ctx)
	if err != nil {
		return backend.RemoteState{}, err
	}

	switch {
	case options.ExpectedRevision != "" && !exists:
		return backend.RemoteState{}, backend.ErrRevisionConflict
	case options.ExpectedRevision != "" && currentHead.Document.Revision != options.ExpectedRevision:
		return backend.RemoteState{}, backend.ErrRevisionConflict
	}

	bundlePath, revision, err := createBundle(src)
	if err != nil {
		return backend.RemoteState{}, err
	}
	defer os.Remove(bundlePath)

	if exists && currentHead.Document.Revision == revision {
		return backend.RemoteState{
			Exists:   true,
			Revision: revision,
		}, nil
	}

	bundleKey := b.bundleKey(revision)
	file, err := os.Open(bundlePath)
	if err != nil {
		return backend.RemoteState{}, err
	}
	defer file.Close()

	if _, err := b.config.Store.Put(ctx, bundleKey, file, blob.PutOptions{}); err != nil {
		return backend.RemoteState{}, err
	}

	nextHead := headDocument{
		Revision:  revision,
		BundleKey: bundleKey,
		UpdatedAt: time.Now().Format(time.RFC3339),
	}
	headPayload, err := json.MarshalIndent(nextHead, "", "  ")
	if err != nil {
		return backend.RemoteState{}, err
	}
	headPayload = append(headPayload, '\n')

	putOptions := blob.PutOptions{}
	if exists {
		putOptions.IfMatch = currentHead.Info.Revision
	}

	if _, err := b.config.Store.Put(ctx, b.headKey(), bytes.NewReader(headPayload), putOptions); err != nil {
		if head, headExists, readErr := b.readHead(ctx); readErr == nil && (!headExists || head.Document.BundleKey != bundleKey) {
			_ = b.config.Store.Delete(ctx, bundleKey)
		}
		if errors.Is(err, blob.ErrConditionNotMet) {
			return backend.RemoteState{}, backend.ErrRevisionConflict
		}
		return backend.RemoteState{}, err
	}

	if exists && currentHead.Document.BundleKey != "" && currentHead.Document.BundleKey != bundleKey {
		_ = b.config.Store.Delete(ctx, currentHead.Document.BundleKey)
	}

	return backend.RemoteState{
		Exists:   true,
		Revision: revision,
	}, nil
}

// Close 关闭后端。
func (b *Backend) Close() error {
	return nil
}

// readHead 读取远端 head 指针。
func (b *Backend) readHead(ctx context.Context) (headState, bool, error) {
	reader, info, err := b.config.Store.Get(ctx, b.headKey())
	if err != nil {
		if errors.Is(err, blob.ErrObjectNotFound) {
			return headState{}, false, nil
		}
		return headState{}, false, err
	}
	defer reader.Close()

	data, err := io.ReadAll(reader)
	if err != nil {
		return headState{}, false, err
	}

	var document headDocument
	if err := json.Unmarshal(data, &document); err != nil {
		return headState{}, false, err
	}
	if document.Revision == "" || document.BundleKey == "" {
		return headState{}, false, errors.New("snapshot store head is invalid")
	}

	return headState{
		Document: document,
		Info:     info,
	}, true, nil
}

// headKey 返回完整的 head 对象键。
func (b *Backend) headKey() string {
	return path.Join(b.config.Namespace, b.config.HeadKey)
}

// bundleKey 返回 revision 对应的 bundle 键。
func (b *Backend) bundleKey(revision string) string {
	return path.Join(b.config.Namespace, bundleDirName, revision+".tar.gz")
}

// createBundle 将目录稳定打包成 tar.gz，并返回文件路径与摘要。
func createBundle(root string) (string, string, error) {
	tempFile, err := os.CreateTemp("", "voidraft-snapshot-*.tar.gz")
	if err != nil {
		return "", "", err
	}
	tempName := tempFile.Name()

	hasher := sha256.New()
	multiWriter := io.MultiWriter(tempFile, hasher)

	gzipWriter := gzip.NewWriter(multiWriter)
	gzipWriter.ModTime = stableBundleTime
	gzipWriter.Name = ""
	gzipWriter.Comment = ""

	tarWriter := tar.NewWriter(gzipWriter)

	writeErr := writeBundle(root, tarWriter)
	closeErr := tarWriter.Close()
	gzipCloseErr := gzipWriter.Close()
	fileCloseErr := tempFile.Close()
	if writeErr != nil {
		_ = os.Remove(tempName)
		return "", "", writeErr
	}
	if closeErr != nil {
		_ = os.Remove(tempName)
		return "", "", closeErr
	}
	if gzipCloseErr != nil {
		_ = os.Remove(tempName)
		return "", "", gzipCloseErr
	}
	if fileCloseErr != nil {
		_ = os.Remove(tempName)
		return "", "", fileCloseErr
	}

	revision := hex.EncodeToString(hasher.Sum(nil))
	return tempName, revision, nil
}

// writeBundle 将目录内容按稳定顺序写入 tar。
func writeBundle(root string, writer *tar.Writer) error {
	paths, err := collectPaths(root)
	if err != nil {
		return err
	}

	for _, entryPath := range paths {
		info, err := os.Lstat(entryPath)
		if err != nil {
			return err
		}

		relativePath, err := filepath.Rel(root, entryPath)
		if err != nil {
			return err
		}

		header, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return err
		}
		header.Name = filepath.ToSlash(relativePath)
		header.ModTime = stableBundleTime
		header.AccessTime = stableBundleTime
		header.ChangeTime = stableBundleTime
		header.Uid = 0
		header.Gid = 0
		header.Uname = ""
		header.Gname = ""

		if info.IsDir() && !strings.HasSuffix(header.Name, "/") {
			header.Name += "/"
		}

		if err := writer.WriteHeader(header); err != nil {
			return err
		}

		if info.IsDir() {
			continue
		}

		file, err := os.Open(entryPath)
		if err != nil {
			return err
		}
		if _, err := io.Copy(writer, file); err != nil {
			file.Close()
			return err
		}
		if err := file.Close(); err != nil {
			return err
		}
	}

	return nil
}

// collectPaths 返回稳定排序后的目录项列表。
func collectPaths(root string) ([]string, error) {
	entries := make([]string, 0)
	if err := filepath.WalkDir(root, func(entryPath string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entryPath == root {
			return nil
		}
		entries = append(entries, entryPath)
		return nil
	}); err != nil {
		return nil, err
	}

	sort.Strings(entries)
	return entries, nil
}

// extractBundle 将 tar.gz 包解压到目标目录。
func extractBundle(reader io.Reader, dst string) error {
	gzipReader, err := gzip.NewReader(reader)
	if err != nil {
		return err
	}
	defer gzipReader.Close()

	tarReader := tar.NewReader(gzipReader)
	for {
		header, err := tarReader.Next()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return err
		}

		targetPath, err := resolveExtractPath(dst, header.Name)
		if err != nil {
			return err
		}

		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(targetPath, 0755); err != nil {
				return err
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(targetPath), 0755); err != nil {
				return err
			}
			file, err := os.OpenFile(targetPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, os.FileMode(header.Mode))
			if err != nil {
				return err
			}
			if _, err := io.Copy(file, tarReader); err != nil {
				file.Close()
				return err
			}
			if err := file.Close(); err != nil {
				return err
			}
		default:
			return fmt.Errorf("unsupported tar entry type: %d", header.Typeflag)
		}
	}
}

// recreateDir 清空并重建目录。
func recreateDir(dir string) error {
	if err := os.RemoveAll(dir); err != nil {
		return err
	}
	return os.MkdirAll(dir, 0755)
}

// resolveExtractPath 将归档路径安全映射到目标目录。
func resolveExtractPath(root string, name string) (string, error) {
	clean := filepath.Clean(filepath.FromSlash(name))
	if clean == "." {
		return "", errors.New("invalid archive entry")
	}
	targetPath := filepath.Join(root, clean)
	relativePath, err := filepath.Rel(root, targetPath)
	if err != nil {
		return "", err
	}
	if strings.HasPrefix(relativePath, "..") {
		return "", errors.New("archive entry escapes target directory")
	}
	return targetPath, nil
}
