package blob

import (
	"context"
	"errors"
	"io"
)

var (
	// ErrObjectNotFound 表示对象不存在。
	ErrObjectNotFound = errors.New("blob object not found")
	// ErrConditionNotMet 表示条件写入失败。
	ErrConditionNotMet = errors.New("blob condition not met")
)

// ObjectInfo 描述一个对象的元信息。
type ObjectInfo struct {
	Key      string
	Revision string
	Size     int64
}

// PutOptions 描述对象写入条件。
type PutOptions struct {
	IfMatch string
}

// Store 描述 blob 存储的最小能力集。
type Store interface {
	Get(ctx context.Context, key string) (io.ReadCloser, ObjectInfo, error)
	Put(ctx context.Context, key string, body io.Reader, options PutOptions) (ObjectInfo, error)
	Stat(ctx context.Context, key string) (ObjectInfo, error)
	Delete(ctx context.Context, key string) error
}
