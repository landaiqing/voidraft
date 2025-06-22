package services

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"

	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// StoreOption 存储服务配置选项
type StoreOption struct {
	FilePath string
	AutoSave bool
	Logger   *log.LoggerService
}

// Store 泛型存储服务
type Store[T any] struct {
	option   StoreOption
	data     atomic.Value // stores T
	dataMap  sync.Map     // thread-safe map
	unsaved  atomic.Bool
	initOnce sync.Once
	logger   *log.LoggerService
}

// NewStore 存储服务
func NewStore[T any](option StoreOption) *Store[T] {
	logger := option.Logger
	if logger == nil {
		logger = log.New()
	}

	store := &Store[T]{
		option: option,
		logger: logger,
	}

	// 异步初始化
	store.initOnce.Do(func() {
		store.initialize()
	})

	return store
}

// initialize 初始化存储
func (s *Store[T]) initialize() {
	// 确保目录存在
	if s.option.FilePath != "" {
		if err := os.MkdirAll(filepath.Dir(s.option.FilePath), 0755); err != nil {
			s.logger.Error("store: failed to create directory", "error", err)
			return
		}
	}

	// 加载数据
	s.load()
}

// load 加载数据
func (s *Store[T]) load() {
	if s.option.FilePath == "" {
		return
	}

	// 检查文件是否存在
	if _, err := os.Stat(s.option.FilePath); os.IsNotExist(err) {
		return
	}

	data, err := os.ReadFile(s.option.FilePath)
	if err != nil {
		s.logger.Error("store: failed to read file", "error", err)
		return
	}

	if len(data) == 0 {
		return
	}

	var value T
	if err := json.Unmarshal(data, &value); err != nil {
		// 尝试加载为map格式
		var mapData map[string]any
		if err := json.Unmarshal(data, &mapData); err != nil {
			s.logger.Error("store: failed to parse data", "error", err)
			return
		}
		// 将map数据存储到sync.Map中
		for k, v := range mapData {
			s.dataMap.Store(k, v)
		}
		return
	}

	s.data.Store(value)
}

// Save 保存数据
func (s *Store[T]) Save() error {
	if !s.unsaved.Load() {
		return nil // 没有未保存的更改
	}

	if err := s.saveInternal(); err != nil {
		return fmt.Errorf("store: failed to save: %w", err)
	}

	s.unsaved.Store(false)
	return nil
}

// saveInternal 内部保存实现
func (s *Store[T]) saveInternal() error {
	if s.option.FilePath == "" {
		return fmt.Errorf("store: filepath not set")
	}

	// 获取要保存的数据
	var data []byte
	var err error

	if value := s.data.Load(); value != nil {
		data, err = json.MarshalIndent(value, "", "  ")
	} else {
		// 如果没有结构化数据，保存map数据
		mapData := make(map[string]any)
		s.dataMap.Range(func(key, value any) bool {
			if k, ok := key.(string); ok {
				mapData[k] = value
			}
			return true
		})
		data, err = json.MarshalIndent(mapData, "", "  ")
	}

	if err != nil {
		return fmt.Errorf("failed to serialize data: %w", err)
	}

	// 原子写入
	return s.atomicWrite(data)
}

// atomicWrite 原子写入文件
func (s *Store[T]) atomicWrite(data []byte) error {
	dir := filepath.Dir(s.option.FilePath)

	// 创建临时文件
	tempFile, err := os.CreateTemp(dir, "store-*.tmp")
	if err != nil {
		return fmt.Errorf("failed to create temp file: %w", err)
	}

	tempPath := tempFile.Name()
	defer func() {
		tempFile.Close()
		if err != nil {
			os.Remove(tempPath)
		}
	}()

	// 写入数据并同步
	if _, err = tempFile.Write(data); err != nil {
		return fmt.Errorf("failed to write data: %w", err)
	}

	if err = tempFile.Sync(); err != nil {
		return fmt.Errorf("failed to sync file: %w", err)
	}

	if err = tempFile.Close(); err != nil {
		return fmt.Errorf("failed to close temp file: %w", err)
	}

	// 原子替换
	if err = os.Rename(tempPath, s.option.FilePath); err != nil {
		return fmt.Errorf("failed to rename file: %w", err)
	}

	return nil
}

// Get 获取数据
func (s *Store[T]) Get() T {
	if value := s.data.Load(); value != nil {
		return value.(T)
	}
	var zero T
	return zero
}

// GetProperty 获取指定属性
func (s *Store[T]) GetProperty(key string) any {
	if key == "" {
		// 返回所有map数据
		result := make(map[string]any)
		s.dataMap.Range(func(k, v any) bool {
			if str, ok := k.(string); ok {
				result[str] = v
			}
			return true
		})
		return result
	}

	if value, ok := s.dataMap.Load(key); ok {
		return value
	}
	return nil
}

// Set 设置数据
func (s *Store[T]) Set(data T) error {
	s.data.Store(data)
	s.unsaved.Store(true)

	if s.option.AutoSave {
		return s.saveInternal()
	}
	return nil
}

// SetProperty 设置指定属性
func (s *Store[T]) SetProperty(key string, value any) error {
	s.dataMap.Store(key, value)
	s.unsaved.Store(true)

	if s.option.AutoSave {
		return s.saveInternal()
	}
	return nil
}

// Delete 删除指定属性
func (s *Store[T]) Delete(key string) error {
	s.dataMap.Delete(key)
	s.unsaved.Store(true)

	if s.option.AutoSave {
		return s.saveInternal()
	}
	return nil
}

// HasUnsavedChanges 是否有未保存的更改
func (s *Store[T]) HasUnsavedChanges() bool {
	return s.unsaved.Load()
}
