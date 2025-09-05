package services

import (
	"fmt"
	jsonparser "github.com/knadh/koanf/parsers/json"
	"github.com/knadh/koanf/providers/structs"
	"github.com/knadh/koanf/v2"
	"github.com/wailsapp/wails/v3/pkg/services/log"
	"os"
	"path/filepath"
	"time"
)

const (
	// BackupFilePattern backup file name pattern
	BackupFilePattern = "%s.backup.%s.json"
	// MaxConfigFileSize maximum config file size
	MaxConfigFileSize = 10 * 1024 * 1024 // 10MB
)

// ConfigMigrator elegant configuration migrator with automatic field detection
type ConfigMigrator struct {
	logger     *log.LogService
	configDir  string
	configName string
	configPath string
}

// MigrationResult migration operation result
type MigrationResult struct {
	Migrated      bool     `json:"migrated"`      // Whether migration was performed
	MissingFields []string `json:"missingFields"` // Fields that were missing
	BackupPath    string   `json:"backupPath"`    // Path to backup file
	Description   string   `json:"description"`   // Description of migration
}

// NewConfigMigrator creates a new configuration migrator
func NewConfigMigrator(
	logger *log.LogService,
	configDir string,
	configName, configPath string,
) *ConfigMigrator {
	if logger == nil {
		logger = log.New()
	}
	return &ConfigMigrator{
		logger:     logger,
		configDir:  configDir,
		configName: configName,
		configPath: configPath,
	}
}

// AutoMigrate automatically detects and migrates missing configuration fields
func (cm *ConfigMigrator) AutoMigrate(defaultConfig interface{}, currentConfig *koanf.Koanf) (*MigrationResult, error) {
	defaultKoanf := koanf.New(".")
	if err := defaultKoanf.Load(structs.Provider(defaultConfig, "json"), nil); err != nil {
		return nil, fmt.Errorf("failed to load default config: %w", err)
	}

	// Detect missing fields
	missingFields := cm.detectMissingFields(currentConfig.All(), defaultKoanf.All())

	// Create result object
	result := &MigrationResult{
		MissingFields: missingFields,
		Migrated:      len(missingFields) > 0,
		Description:   fmt.Sprintf("Found %d missing fields", len(missingFields)),
	}

	// No migration needed
	if !result.Migrated {
		return result, nil
	}

	// Create backup before migration
	backupPath, err := cm.createBackup()
	if err != nil {
		return result, fmt.Errorf("backup creation failed: %w", err)
	}
	result.BackupPath = backupPath

	// Merge missing fields from default config
	if err := cm.mergeDefaultFields(currentConfig, defaultKoanf, missingFields); err != nil {
		return result, fmt.Errorf("failed to merge default fields: %w", err)
	}

	// Save updated config
	if err := cm.saveConfig(currentConfig); err != nil {
		return result, fmt.Errorf("failed to save updated config: %w", err)
	}

	// Clean up backup on success
	if backupPath != "" {
		if err := os.Remove(backupPath); err != nil {
			cm.logger.Error("Failed to remove backup", "error", err)
		}
	}

	return result, nil
}

// detectMissingFields detects missing configuration fields
func (cm *ConfigMigrator) detectMissingFields(current, defaultConfig map[string]interface{}) []string {
	var missing []string
	cm.findMissing("", defaultConfig, current, &missing)
	return missing
}

// findMissing recursively finds missing fields
func (cm *ConfigMigrator) findMissing(prefix string, defaultMap, currentMap map[string]interface{}, missing *[]string) {
	for key, defaultVal := range defaultMap {
		fullKey := key
		if prefix != "" {
			fullKey = prefix + "." + key
		}

		currentVal, exists := currentMap[key]
		if !exists {
			// Field completely missing - add it
			*missing = append(*missing, fullKey)
		} else if defaultNestedMap, ok := defaultVal.(map[string]interface{}); ok {
			if currentNestedMap, ok := currentVal.(map[string]interface{}); ok {
				// Both are maps, recurse into them
				cm.findMissing(fullKey, defaultNestedMap, currentNestedMap, missing)
			}
			// Type mismatch: user has different type, don't recurse
		}
		// For non-map default values, field exists, preserve user's value
	}
}

// mergeDefaultFields merges default values for missing fields into current config
func (cm *ConfigMigrator) mergeDefaultFields(current, defaultConfig *koanf.Koanf, missingFields []string) error {
	actuallyMerged := 0

	for _, field := range missingFields {
		if defaultConfig.Exists(field) {
			if defaultValue := defaultConfig.Get(field); defaultValue != nil {
				// Always set the field, even if it causes type conflicts
				// This allows configuration structure evolution during upgrades
				current.Set(field, defaultValue)
				actuallyMerged++
			}
		}
	}

	// Update timestamp if we actually merged fields
	if actuallyMerged > 0 {
		current.Set("metadata.lastUpdated", time.Now().Format(time.RFC3339))
	}

	return nil
}

// createBackup creates a backup of the configuration file
func (cm *ConfigMigrator) createBackup() (string, error) {
	if _, err := os.Stat(cm.configPath); os.IsNotExist(err) {
		return "", nil
	}

	timestamp := time.Now().Format("20060102150405")
	backupPath := filepath.Join(cm.configDir, fmt.Sprintf(BackupFilePattern, cm.configName, timestamp))

	data, err := os.ReadFile(cm.configPath)
	if err != nil {
		return "", fmt.Errorf("failed to read config file: %w", err)
	}

	if err := os.WriteFile(backupPath, data, 0644); err != nil {
		return "", fmt.Errorf("failed to create backup: %w", err)
	}

	return backupPath, nil
}

// saveConfig saves configuration to file
func (cm *ConfigMigrator) saveConfig(config *koanf.Koanf) error {
	configBytes, err := config.Marshal(jsonparser.Parser())
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	if len(configBytes) > MaxConfigFileSize {
		return fmt.Errorf("config size (%d bytes) exceeds limit (%d bytes)", len(configBytes), MaxConfigFileSize)
	}

	// Atomic write
	tempPath := cm.configPath + ".tmp"
	if err := os.WriteFile(tempPath, configBytes, 0644); err != nil {
		return fmt.Errorf("failed to write temp config: %w", err)
	}

	if err := os.Rename(tempPath, cm.configPath); err != nil {
		os.Remove(tempPath)
		return fmt.Errorf("failed to rename temp config: %w", err)
	}

	return nil
}
