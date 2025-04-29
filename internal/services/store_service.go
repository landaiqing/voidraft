package services

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// StoreOption 存储服务配置选项
type StoreOption struct {
	FilePath string // 存储文件路径
	AutoSave bool   // 是否自动保存
	Logger   *log.LoggerService
}

// Store 泛型存储服务
type Store[T any] struct {
	option  StoreOption
	data    T
	dataMap map[string]any
	unsaved bool
	lock    sync.RWMutex
	logger  *log.LoggerService
}

// NewStore 存储服务
func NewStore[T any](option StoreOption) *Store[T] {
	logger := option.Logger
	if logger == nil {
		logger = log.New()
	}

	// 确保目录存在
	if option.FilePath != "" {
		dir := filepath.Dir(option.FilePath)
		if err := os.MkdirAll(dir, 0755); err != nil {
			logger.Error("store: Failed to create directory", "path", dir, "error", err)
		}
	}

	store := &Store[T]{
		option:  option,
		dataMap: make(map[string]any),
		logger:  logger,
	}

	// 加载数据
	if err := store.load(); err != nil {
		logger.Error("store: Failed to load data", "error", err)
	}

	return store
}

// load 加载数据
func (s *Store[T]) load() error {
	if s.option.FilePath == "" {
		return fmt.Errorf("store: FilePath not set")
	}

	// 如果文件不存在
	if _, err := os.Stat(s.option.FilePath); os.IsNotExist(err) {
		return nil
	}

	file, err := os.Open(s.option.FilePath)
	if err != nil {
		return fmt.Errorf("store: Failed to open file: %w", err)
	}
	defer file.Close()

	bytes, err := io.ReadAll(file)
	if err != nil {
		return fmt.Errorf("store: Failed to read file: %w", err)
	}

	if len(bytes) == 0 {
		return nil
	}

	s.lock.Lock()
	defer s.lock.Unlock()

	if err := json.Unmarshal(bytes, &s.data); err != nil {
		// 尝试加载为map格式
		if err := json.Unmarshal(bytes, &s.dataMap); err != nil {
			return fmt.Errorf("store: Failed to parse data: %w", err)
		}
	}

	return nil
}

// Save 保存数据
func (s *Store[T]) Save() error {
	s.lock.Lock()
	defer s.lock.Unlock()

	err := s.saveInternal()
	if err != nil {
		s.logger.Error("store: Failed to save", "error", err)
		return fmt.Errorf("store: Failed to save: %w", err)
	}

	s.unsaved = false
	return nil
}

// saveInternal 内部保存实现
func (s *Store[T]) saveInternal() error {
	if s.option.FilePath == "" {
		return fmt.Errorf("store: FilePath not set")
	}

	// 创建临时文件
	dir := filepath.Dir(s.option.FilePath)
	tempFile, err := os.CreateTemp(dir, "store-*.tmp")
	if err != nil {
		return fmt.Errorf("store: Failed to create temp file: %w", err)
	}
	tempFilePath := tempFile.Name()
	defer func() {
		tempFile.Close()
		// 如果出错，删除临时文件
		if err != nil {
			os.Remove(tempFilePath)
		}
	}()

	// 序列化数据
	bytes, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return fmt.Errorf("store: Failed to serialize data: %w", err)
	}

	// 写入临时文件
	if _, err = tempFile.Write(bytes); err != nil {
		return fmt.Errorf("store: Failed to write temp file: %w", err)
	}

	// 确保所有数据已写入磁盘
	if err = tempFile.Sync(); err != nil {
		return fmt.Errorf("store: Failed to sync file: %w", err)
	}

	// 关闭临时文件
	if err = tempFile.Close(); err != nil {
		return fmt.Errorf("store: Failed to close temp file: %w", err)
	}

	// 原子替换文件
	if err = os.Rename(tempFilePath, s.option.FilePath); err != nil {
		return fmt.Errorf("store: Failed to rename file: %w", err)
	}

	return nil
}

// Get 获取数据
func (s *Store[T]) Get() T {
	s.lock.RLock()
	defer s.lock.RUnlock()
	return s.data
}

// GetProperty 获取指定属性
func (s *Store[T]) GetProperty(key string) any {
	s.lock.RLock()
	defer s.lock.RUnlock()

	if key == "" {
		return s.dataMap
	}
	return s.dataMap[key]
}

// Set 设置数据
func (s *Store[T]) Set(data T) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	s.data = data
	s.unsaved = true

	if s.option.AutoSave {
		return s.saveInternal()
	}

	return nil
}

// SetProperty 设置指定属性
func (s *Store[T]) SetProperty(key string, value any) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	s.dataMap[key] = value
	s.unsaved = true

	if s.option.AutoSave {
		return s.saveInternal()
	}

	return nil
}

// Delete 删除指定属性
func (s *Store[T]) Delete(key string) error {
	s.lock.Lock()
	defer s.lock.Unlock()

	delete(s.dataMap, key)
	s.unsaved = true

	if s.option.AutoSave {
		return s.saveInternal()
	}

	return nil
}

// HasUnsavedChanges 是否有未保存的更改
func (s *Store[T]) HasUnsavedChanges() bool {
	s.lock.RLock()
	defer s.lock.RUnlock()
	return s.unsaved
}
