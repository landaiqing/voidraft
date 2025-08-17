package services

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"time"
	"voidraft/internal/models"

	"github.com/Masterminds/semver/v3"
	jsonparser "github.com/knadh/koanf/parsers/json"
	"github.com/knadh/koanf/providers/structs"
	"github.com/knadh/koanf/v2"
	"github.com/wailsapp/wails/v3/pkg/services/log"
)

const (
	// CurrentAppConfigVersion 当前应用配置版本
	CurrentAppConfigVersion = "1.3.0"
	// BackupFilePattern 备份文件名模式
	BackupFilePattern = "%s.backup.%s.json"

	// 资源限制常量
	MaxConfigFileSize = 10 * 1024 * 1024 // 10MB
	MaxRecursionDepth = 50               // 最大递归深度
)

// Migratable 可迁移的配置接口
type Migratable interface {
	GetVersion() string    // 获取当前版本
	SetVersion(string)     // 设置版本
	SetLastUpdated(string) // 设置最后更新时间
	GetDefaultConfig() any // 获取默认配置
}

// ConfigMigrationService 配置迁移服务
type ConfigMigrationService[T Migratable] struct {
	logger        *log.LogService
	configDir     string
	configName    string
	targetVersion string
	configPath    string
}

// MigrationResult 迁移结果
type MigrationResult struct {
	Migrated, ConfigUpdated bool
	FromVersion, ToVersion  string
	BackupPath              string
}

// NewConfigMigrationService 创建配置迁移服务
func NewConfigMigrationService[T Migratable](
	logger *log.LogService,
	configDir string,
	configName, targetVersion, configPath string,
) *ConfigMigrationService[T] {
	return &ConfigMigrationService[T]{
		logger:        orDefault(logger, log.New()),
		configDir:     configDir,
		configName:    configName,
		targetVersion: targetVersion,
		configPath:    configPath,
	}
}

// MigrateConfig 迁移配置文件
func (cms *ConfigMigrationService[T]) MigrateConfig(existingConfig *koanf.Koanf) (*MigrationResult, error) {
	currentVersion := orDefault(existingConfig.String("metadata.version"), "0.0.0")
	result := &MigrationResult{
		FromVersion: currentVersion,
		ToVersion:   cms.targetVersion,
	}

	if needsMigration, err := cms.needsMigration(currentVersion); err != nil {
		return result, fmt.Errorf("version comparison failed: %w", err)
	} else if !needsMigration {
		return result, nil
	}

	// 资源检查和备份
	if err := cms.checkResourceLimits(); err != nil {
		return result, fmt.Errorf("resource limit check failed: %w", err)
	}

	if backupPath, err := cms.createBackupOptimized(); err != nil {
		return result, fmt.Errorf("backup creation failed: %w", err)
	} else {
		result.BackupPath = backupPath
	}

	// 自动恢复检查
	cms.tryQuickRecovery(existingConfig)

	// 执行迁移
	if configUpdated, err := cms.performOptimizedMigration(existingConfig); err != nil {
		return result, fmt.Errorf("migration failed: %w", err)
	} else {
		result.Migrated = true
		result.ConfigUpdated = configUpdated
	}

	return result, nil
}

// needsMigration 检查是否需要迁移
func (cms *ConfigMigrationService[T]) needsMigration(current string) (bool, error) {
	currentVer, err := semver.NewVersion(current)
	if err != nil {
		return true, nil
	}
	targetVer, err := semver.NewVersion(cms.targetVersion)
	if err != nil {
		return false, fmt.Errorf("invalid target version: %s", cms.targetVersion)
	}
	return currentVer.LessThan(targetVer), nil
}

// checkResourceLimits 检查资源限制
func (cms *ConfigMigrationService[T]) checkResourceLimits() error {
	if info, err := os.Stat(cms.configPath); err == nil && info.Size() > MaxConfigFileSize {
		return fmt.Errorf("config file size (%d bytes) exceeds limit (%d bytes)", info.Size(), MaxConfigFileSize)
	}
	return nil
}

// createBackupOptimized 优化的备份创建
func (cms *ConfigMigrationService[T]) createBackupOptimized() (string, error) {
	if _, err := os.Stat(cms.configPath); os.IsNotExist(err) {
		return "", nil
	}

	configDir := cms.configDir
	timestamp := time.Now().Format("20060102150405")
	newBackupPath := filepath.Join(configDir, fmt.Sprintf(BackupFilePattern, cms.configName, timestamp))

	// 单次扫描：删除旧备份并创建新备份
	pattern := filepath.Join(configDir, fmt.Sprintf("%s.backup.*.json", cms.configName))
	if matches, err := filepath.Glob(pattern); err == nil {
		for _, oldBackup := range matches {
			if oldBackup != newBackupPath {
				os.Remove(oldBackup) // 忽略删除错误，继续处理
			}
		}
	}

	return newBackupPath, copyFile(cms.configPath, newBackupPath)
}

// tryQuickRecovery 快速恢复检查
func (cms *ConfigMigrationService[T]) tryQuickRecovery(existingConfig *koanf.Koanf) {
	var testConfig T
	if existingConfig.Unmarshal("", &testConfig) != nil {
		cms.logger.Info("Config appears corrupted, attempting quick recovery")
		if backupPath := cms.findLatestBackupQuick(); backupPath != "" {
			if data, err := os.ReadFile(backupPath); err == nil {
				existingConfig.Delete("")
				existingConfig.Load(&BytesProvider{data}, jsonparser.Parser())
				cms.logger.Info("Quick recovery successful")
			}
		}
	}
}

// findLatestBackupQuick 快速查找最新备份（优化排序）
func (cms *ConfigMigrationService[T]) findLatestBackupQuick() string {
	pattern := filepath.Join(cms.configDir, fmt.Sprintf("%s.backup.*.json", cms.configName))
	matches, err := filepath.Glob(pattern)
	if err != nil || len(matches) == 0 {
		return ""
	}
	sort.Strings(matches) // 字典序排序，时间戳格式确保正确性
	return matches[len(matches)-1]
}

// performOptimizedMigration 优化的迁移执行
func (cms *ConfigMigrationService[T]) performOptimizedMigration(existingConfig *koanf.Koanf) (bool, error) {
	// 直接从koanf实例获取配置，避免额外序列化
	var currentConfig T
	if err := existingConfig.Unmarshal("", &currentConfig); err != nil {
		return false, fmt.Errorf("unmarshal existing config failed: %w", err)
	}

	defaultConfig, ok := currentConfig.GetDefaultConfig().(T)
	if !ok {
		return false, fmt.Errorf("default config type mismatch")
	}

	return cms.mergeInPlace(existingConfig, currentConfig, defaultConfig)
}

// mergeInPlace 就地合并配置
func (cms *ConfigMigrationService[T]) mergeInPlace(existingConfig *koanf.Koanf, currentConfig, defaultConfig T) (bool, error) {
	// 创建临时合并实例
	mergeKoanf := koanf.New(".")

	// 使用快速加载链
	if err := chainLoad(mergeKoanf,
		func() error { return mergeKoanf.Load(structs.Provider(defaultConfig, "json"), nil) },
		func() error {
			return mergeKoanf.Load(structs.Provider(currentConfig, "json"), nil,
				koanf.WithMergeFunc(cms.fastMerge))
		},
	); err != nil {
		return false, fmt.Errorf("config merge failed: %w", err)
	}

	// 更新元数据
	mergeKoanf.Set("metadata.version", cms.targetVersion)
	mergeKoanf.Set("metadata.lastUpdated", time.Now().Format(time.RFC3339))

	// 一次性序列化和原子写入
	configBytes, err := mergeKoanf.Marshal(jsonparser.Parser())
	if err != nil {
		return false, fmt.Errorf("marshal config failed: %w", err)
	}

	if len(configBytes) > MaxConfigFileSize {
		return false, fmt.Errorf("merged config size exceeds limit")
	}

	// 原子写入
	return true, cms.atomicWrite(existingConfig, configBytes)
}

// atomicWrite 原子写入操作
func (cms *ConfigMigrationService[T]) atomicWrite(existingConfig *koanf.Koanf, configBytes []byte) error {
	tempPath := cms.configPath + ".tmp"

	if err := os.WriteFile(tempPath, configBytes, 0644); err != nil {
		return fmt.Errorf("write temp config failed: %w", err)
	}

	if err := os.Rename(tempPath, cms.configPath); err != nil {
		os.Remove(tempPath)
		return fmt.Errorf("atomic rename failed: %w", err)
	}

	// 重新加载到原实例
	existingConfig.Delete("")
	return existingConfig.Load(&BytesProvider{configBytes}, jsonparser.Parser())
}

// fastMerge 快速合并函数
func (cms *ConfigMigrationService[T]) fastMerge(src, dest map[string]interface{}) error {
	return cms.fastMergeRecursive(src, dest, 0)
}

// fastMergeRecursive 快速递归合并
func (cms *ConfigMigrationService[T]) fastMergeRecursive(src, dest map[string]interface{}, depth int) error {
	if depth > MaxRecursionDepth {
		return fmt.Errorf("recursion depth exceeded")
	}

	for key, srcVal := range src {
		if destVal, exists := dest[key]; exists {
			// 优先检查map类型（最常见情况）
			if srcMap, srcOK := srcVal.(map[string]interface{}); srcOK {
				if destMap, destOK := destVal.(map[string]interface{}); destOK {
					if err := cms.fastMergeRecursive(srcMap, destMap, depth+1); err != nil {
						return err
					}
					continue
				}
			}
			// 快速空值检查（避免反射）
			if srcVal == nil || srcVal == "" || srcVal == 0 {
				continue
			}
		}
		dest[key] = srcVal
	}
	return nil
}

// BytesProvider 轻量字节提供器
type BytesProvider struct{ data []byte }

func (bp *BytesProvider) ReadBytes() ([]byte, error) { return bp.data, nil }
func (bp *BytesProvider) Read() (map[string]interface{}, error) {
	var result map[string]interface{}
	return result, json.Unmarshal(bp.data, &result)
}

// 工具函数
func orDefault[T any](value, defaultValue T) T {
	var zero T
	if reflect.DeepEqual(value, zero) {
		return defaultValue
	}
	return value
}

func copyFile(src, dst string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, data, 0644)
}

func chainLoad(k *koanf.Koanf, loaders ...func() error) error {
	for _, loader := range loaders {
		if err := loader(); err != nil {
			return err
		}
	}
	return nil
}

// 工厂函数
func NewAppConfigMigrationService(logger *log.LogService, configDir, settingsPath string) *ConfigMigrationService[*models.AppConfig] {
	return NewConfigMigrationService[*models.AppConfig](
		logger, configDir, "settings", CurrentAppConfigVersion, settingsPath)
}
