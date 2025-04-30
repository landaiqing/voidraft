package config

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"voidraft/internal/models"
	"voidraft/internal/services/store"

	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// ConfigStorage 配置存储接口
type ConfigStorage interface {
	// Load 加载配置
	Load() (models.AppConfig, error)

	// Save 保存配置
	Save(models.AppConfig) error

	// GetPath 获取存储路径
	GetPath() string

	// MoveTo 移动到新路径
	MoveTo(string, models.AppConfig) error
}

// FileConfigStorage 基于文件的配置存储
type FileConfigStorage struct {
	store       *store.Store[models.AppConfig]
	currentPath string
	logger      *log.LoggerService
	mu          sync.RWMutex
}

// NewFileConfigStorage 创建文件配置存储
func NewFileConfigStorage(path string, logger *log.LoggerService) *FileConfigStorage {
	if logger == nil {
		logger = log.New()
	}

	return &FileConfigStorage{
		store: store.NewStore[models.AppConfig](store.StoreOption{
			FilePath: path,
			AutoSave: true,
			Logger:   logger,
		}),
		currentPath: path,
		logger:      logger,
	}
}

// Load 加载配置
func (fcs *FileConfigStorage) Load() (models.AppConfig, error) {
	fcs.mu.RLock()
	defer fcs.mu.RUnlock()

	config := fcs.store.Get()

	// 检查配置是否为空
	if isEmptyConfig(config) {
		return models.AppConfig{}, fmt.Errorf("empty config detected")
	}

	return config, nil
}

// Save 保存配置
func (fcs *FileConfigStorage) Save(config models.AppConfig) error {
	fcs.mu.Lock()
	defer fcs.mu.Unlock()

	return fcs.store.Set(config)
}

// GetPath 获取存储路径
func (fcs *FileConfigStorage) GetPath() string {
	fcs.mu.RLock()
	defer fcs.mu.RUnlock()

	return fcs.currentPath
}

// MoveTo 移动到新路径
func (fcs *FileConfigStorage) MoveTo(newPath string, config models.AppConfig) error {
	fcs.mu.Lock()
	defer fcs.mu.Unlock()

	// 创建目录
	if err := os.MkdirAll(filepath.Dir(newPath), 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// 创建新存储
	newStore := store.NewStore[models.AppConfig](store.StoreOption{
		FilePath: newPath,
		AutoSave: true,
		Logger:   fcs.logger,
	})

	// 保存到新位置
	if err := newStore.Set(config); err != nil {
		return fmt.Errorf("failed to save config to new path: %w", err)
	}

	// 更新状态
	fcs.store = newStore
	fcs.currentPath = newPath

	return nil
}

// isEmptyConfig 检查配置是否为空
func isEmptyConfig(config models.AppConfig) bool {
	return config.Editor.FontSize == 0
}
