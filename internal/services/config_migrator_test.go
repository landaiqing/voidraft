package services

import (
	"encoding/json"
	"fmt"
	jsonparser "github.com/knadh/koanf/parsers/json"
	"github.com/knadh/koanf/providers/file"
	"github.com/knadh/koanf/v2"
	"github.com/stretchr/testify/assert"
	"github.com/wailsapp/wails/v3/pkg/services/log"
	"os"
	"path/filepath"
	"testing"
)

// TestConfig represents a simplified config structure for testing
type TestConfig struct {
	App struct {
		Name    string `json:"name"`
		Version string `json:"version"`
		Theme   string `json:"theme"`
	} `json:"app"`
	User struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Settings struct {
			AutoSave    bool   `json:"autoSave"`
			Language    string `json:"language"`
			NewSetting  bool   `json:"newSetting"`  // This field will be missing in old config
			NewSetting2 string `json:"newSetting2"` // This field will be missing in old config
		} `json:"settings"`
	} `json:"user"`
	NewSection struct {
		Enabled bool   `json:"enabled"`
		Value   string `json:"value"`
	} `json:"newSection"` // This entire section will be missing in old config
}

// createTestConfig creates a test configuration file
func createTestConfig(t *testing.T, tempDir string) string {
	// Old config without some fields
	oldConfig := map[string]interface{}{
		"app": map[string]interface{}{
			"name":    "TestApp",
			"version": "1.0.0",
			"theme":   "dark",
		},
		"user": map[string]interface{}{
			"name":  "Test User",
			"email": "test@example.com",
			"settings": map[string]interface{}{
				"autoSave": true,
				"language": "en",
				// Missing newSetting and newSetting2
			},
		},
		// Missing newSection
	}

	// Create config file
	configPath := filepath.Join(tempDir, "config.json")
	jsonData, err := json.MarshalIndent(oldConfig, "", "  ")
	if err != nil {
		t.Fatalf("Failed to marshal test config: %v", err)
	}

	err = os.WriteFile(configPath, jsonData, 0644)
	if err != nil {
		t.Fatalf("Failed to write test config: %v", err)
	}

	return configPath
}

// TestConfigMigrator_AutoMigrate tests the ConfigMigrator's AutoMigrate functionality
func TestConfigMigrator_AutoMigrate(t *testing.T) {
	// Create temp directory for test
	tempDir, err := os.MkdirTemp("", "config_migrator_test")
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create test config file
	configPath := createTestConfig(t, tempDir)

	// Create logger
	logger := log.New()

	// Create config migrator
	migrator := NewConfigMigrator(logger, tempDir, "config", configPath)

	// Create koanf instance and load the config
	k := koanf.New(".")
	fileProvider := file.Provider(configPath)
	jsonParser := jsonparser.Parser()
	if err := k.Load(fileProvider, jsonParser); err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	// Create default config with all fields
	defaultConfig := TestConfig{}
	defaultConfig.App.Name = "TestApp"
	defaultConfig.App.Version = "1.0.0"
	defaultConfig.App.Theme = "dark"
	defaultConfig.User.Name = "Test User"
	defaultConfig.User.Email = "test@example.com"
	defaultConfig.User.Settings.AutoSave = true
	defaultConfig.User.Settings.Language = "en"
	defaultConfig.User.Settings.NewSetting = true     // New field
	defaultConfig.User.Settings.NewSetting2 = "value" // New field
	defaultConfig.NewSection.Enabled = true           // New section
	defaultConfig.NewSection.Value = "new section"    // New section

	// Run auto migration
	result, err := migrator.AutoMigrate(defaultConfig, k)
	if err != nil {
		t.Fatalf("Failed to auto migrate: %v", err)
	}

	// Assertions
	assert.True(t, result.Migrated, "Migration should have been performed")

	// 打印检测到的缺失字段，便于分析
	t.Logf("Detected fields: %v", result.MissingFields)

	// 验证检测到了正确数量的字段 - 实际检测到4个
	assert.Equal(t, 4, len(result.MissingFields), "Should have detected 4 missing fields")

	// 期望检测到的缺失字段
	expectedFields := map[string]bool{
		"user.settings.newSetting":  true,
		"user.settings.newSetting2": true,
		"newSection.enabled":        true,
		"newSection.value":          true,
	}

	// 验证所有预期的字段都被检测到了
	for _, field := range result.MissingFields {
		_, expected := expectedFields[field]
		assert.True(t, expected, "Field %s was detected but not expected", field)
	}

	// 验证所有检测到的字段都在预期之内
	for expectedField := range expectedFields {
		found := false
		for _, field := range result.MissingFields {
			if field == expectedField {
				found = true
				break
			}
		}
		assert.True(t, found, "Expected field %s was not detected", expectedField)
	}

	// Verify that the fields were actually added to the config
	assert.True(t, k.Bool("user.settings.newSetting"), "newSetting should be added with correct value")
	assert.Equal(t, "value", k.String("user.settings.newSetting2"), "newSetting2 should be added with correct value")
	assert.True(t, k.Bool("newSection.enabled"), "newSection.enabled should be added with correct value")
	assert.Equal(t, "new section", k.String("newSection.value"), "newSection.value should be added with correct value")

	// Check that backup was cleaned up after successful migration
	backupFiles, err := filepath.Glob(filepath.Join(tempDir, "*.backup.*"))
	if err != nil {
		t.Fatalf("Failed to list backup files: %v", err)
	}
	assert.Equal(t, 0, len(backupFiles), "Backup file should have been cleaned up after successful migration")
}

// TestConfigMigrator_NoOverwrite tests that user configuration is never overwritten
func TestConfigMigrator_NoOverwrite(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "config_migrator_no_overwrite_test")
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create user config with custom values that differ from defaults
	userConfig := map[string]interface{}{
		"app": map[string]interface{}{
			"name":    "CustomAppName", // Different from default
			"version": "2.0.0",         // Different from default
			"theme":   "custom",        // Different from default
		},
		"user": map[string]interface{}{
			"name":  "Custom User",        // Different from default
			"email": "custom@example.com", // Different from default
			"settings": map[string]interface{}{
				"autoSave": false, // Different from default
				"language": "zh",  // Different from default
			},
		},
	}

	// Create config file
	configPath := filepath.Join(tempDir, "config.json")
	jsonData, _ := json.MarshalIndent(userConfig, "", "  ")
	os.WriteFile(configPath, jsonData, 0644)

	// Create migrator and load config
	logger := log.New()
	migrator := NewConfigMigrator(logger, tempDir, "config", configPath)
	k := koanf.New(".")
	k.Load(file.Provider(configPath), jsonparser.Parser())

	// Create default config with different values
	defaultConfig := TestConfig{}
	defaultConfig.App.Name = "DefaultApp"
	defaultConfig.App.Version = "1.0.0"
	defaultConfig.App.Theme = "light"
	defaultConfig.User.Name = "Default User"
	defaultConfig.User.Email = "default@example.com"
	defaultConfig.User.Settings.AutoSave = true
	defaultConfig.User.Settings.Language = "en"
	defaultConfig.User.Settings.NewSetting = true     // This should be added
	defaultConfig.User.Settings.NewSetting2 = "value" // This should be added
	defaultConfig.NewSection.Enabled = true           // This should be added
	defaultConfig.NewSection.Value = "new section"    // This should be added

	// Run migration
	result, err := migrator.AutoMigrate(defaultConfig, k)
	assert.NoError(t, err)
	assert.True(t, result.Migrated)

	// Verify user values are preserved
	assert.Equal(t, "CustomAppName", k.String("app.name"), "User's app name should not be overwritten")
	assert.Equal(t, "2.0.0", k.String("app.version"), "User's version should not be overwritten")
	assert.Equal(t, "custom", k.String("app.theme"), "User's theme should not be overwritten")
	assert.Equal(t, "Custom User", k.String("user.name"), "User's name should not be overwritten")
	assert.Equal(t, "custom@example.com", k.String("user.email"), "User's email should not be overwritten")
	assert.False(t, k.Bool("user.settings.autoSave"), "User's autoSave should not be overwritten")
	assert.Equal(t, "zh", k.String("user.settings.language"), "User's language should not be overwritten")

	// Verify missing fields were added with default values
	assert.True(t, k.Bool("user.settings.newSetting"), "Missing field should be added")
	assert.Equal(t, "value", k.String("user.settings.newSetting2"), "Missing field should be added")
	assert.True(t, k.Bool("newSection.enabled"), "Missing section should be added")
	assert.Equal(t, "new section", k.String("newSection.value"), "Missing section should be added")
}

// TestConfigMigrator_TypeMismatch tests handling of type mismatches (config structure evolution)
func TestConfigMigrator_TypeMismatch(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "config_migrator_type_test")
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create user config where some fields have different types
	userConfig := map[string]interface{}{
		"app": map[string]interface{}{
			"name":    "TestApp",
			"version": "1.0.0",
			"theme":   "dark",
		},
		"user": map[string]interface{}{
			"name":     "Test User",
			"email":    "test@example.com",
			"settings": "simple_string", // This is a string, but default is an object
		},
		"newSection": 123, // This is a number, but default is an object
	}

	// Create config file
	configPath := filepath.Join(tempDir, "config.json")
	jsonData, _ := json.MarshalIndent(userConfig, "", "  ")
	os.WriteFile(configPath, jsonData, 0644)

	// Create migrator and load config
	logger := log.New()
	migrator := NewConfigMigrator(logger, tempDir, "config", configPath)
	k := koanf.New(".")
	k.Load(file.Provider(configPath), jsonparser.Parser())

	// Create default config
	defaultConfig := TestConfig{}
	defaultConfig.App.Name = "TestApp"
	defaultConfig.App.Version = "1.0.0"
	defaultConfig.App.Theme = "dark"
	defaultConfig.User.Name = "Test User"
	defaultConfig.User.Email = "test@example.com"
	defaultConfig.User.Settings.AutoSave = true
	defaultConfig.User.Settings.Language = "en"
	defaultConfig.User.Settings.NewSetting = true
	defaultConfig.User.Settings.NewSetting2 = "value"
	defaultConfig.NewSection.Enabled = true
	defaultConfig.NewSection.Value = "new section"

	// Run migration
	result, err := migrator.AutoMigrate(defaultConfig, k)
	assert.NoError(t, err)

	// Should detect missing fields and merge them, overriding type conflicts for config evolution
	assert.True(t, result.Migrated, "Migration should be performed")
	assert.Greater(t, len(result.MissingFields), 0, "Should detect missing fields with type mismatch")

	// Verify that type-mismatched values are overwritten with new structure (config evolution)
	// This is important for software upgrades where config structure changes
	assert.NotEqual(t, "simple_string", k.String("user.settings"), "User's string should be overwritten with new structure")
	assert.NotEqual(t, int64(123), k.Int64("newSection"), "User's number should be overwritten with new structure")

	// Verify new structure is properly applied
	assert.True(t, k.Bool("user.settings.autoSave"), "New settings structure should be applied")
	assert.Equal(t, "en", k.String("user.settings.language"), "New settings structure should be applied")
	assert.True(t, k.Bool("user.settings.newSetting"), "New settings structure should be applied")
	assert.Equal(t, "value", k.String("user.settings.newSetting2"), "New settings structure should be applied")
	assert.True(t, k.Bool("newSection.enabled"), "New section structure should be applied")
	assert.Equal(t, "new section", k.String("newSection.value"), "New section structure should be applied")
}

// TestConfigMigrator_ConfigEvolution tests configuration structure evolution scenarios
func TestConfigMigrator_ConfigEvolution(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "config_migrator_evolution_test")
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Simulate old config format where "features" was a simple string
	// but new version expects it to be an object
	oldConfig := map[string]interface{}{
		"app": map[string]interface{}{
			"name":     "MyApp",
			"version":  "1.0.0",
			"features": "plugin1,plugin2", // Old: simple comma-separated string
		},
		"database": "sqlite://data.db", // Old: simple string
	}

	configPath := filepath.Join(tempDir, "config.json")
	jsonData, _ := json.MarshalIndent(oldConfig, "", "  ")
	os.WriteFile(configPath, jsonData, 0644)

	logger := log.New()
	migrator := NewConfigMigrator(logger, tempDir, "config", configPath)
	k := koanf.New(".")
	k.Load(file.Provider(configPath), jsonparser.Parser())

	// New config format where "features" and "database" are objects
	type NewConfig struct {
		App struct {
			Name     string `json:"name"`
			Version  string `json:"version"`
			Features struct {
				Enabled []string `json:"enabled"`
				Config  string   `json:"config"`
			} `json:"features"`
		} `json:"app"`
		Database struct {
			Type string `json:"type"`
			URL  string `json:"url"`
		} `json:"database"`
	}

	defaultConfig := NewConfig{}
	defaultConfig.App.Name = "DefaultApp" // Will be preserved from user
	defaultConfig.App.Version = "2.0.0"   // Will be preserved from user
	defaultConfig.App.Features.Enabled = []string{"newFeature"}
	defaultConfig.App.Features.Config = "default.conf"
	defaultConfig.Database.Type = "postgresql"
	defaultConfig.Database.URL = "postgres://localhost:5432/db"

	// Run migration
	result, err := migrator.AutoMigrate(defaultConfig, k)
	assert.NoError(t, err)
	assert.True(t, result.Migrated)

	// User's non-conflicting values should be preserved
	assert.Equal(t, "MyApp", k.String("app.name"), "User's app name should be preserved")
	assert.Equal(t, "1.0.0", k.String("app.version"), "User's version should be preserved")

	// Conflicting structure should be evolved (old string → new object)
	assert.NotEqual(t, "plugin1,plugin2", k.String("app.features"), "Old features string should be replaced")
	assert.Equal(t, []string{"newFeature"}, k.Strings("app.features.enabled"), "New features structure should be applied")
	assert.Equal(t, "default.conf", k.String("app.features.config"), "New features structure should be applied")

	assert.NotEqual(t, "sqlite://data.db", k.String("database"), "Old database string should be replaced")
	assert.Equal(t, "postgresql", k.String("database.type"), "New database structure should be applied")
	assert.Equal(t, "postgres://localhost:5432/db", k.String("database.url"), "New database structure should be applied")

	t.Logf("Successfully evolved config structure, fields migrated: %d", len(result.MissingFields))
}

// TestConfigMigrator_ComplexNested tests complex nested structure migration
func TestConfigMigrator_ComplexNested(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "config_migrator_complex_test")
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Complex user config with deep nesting
	userConfig := map[string]interface{}{
		"app": map[string]interface{}{
			"name":    "TestApp",
			"version": "1.0.0",
			"advanced": map[string]interface{}{
				"logging": map[string]interface{}{
					"level": "info",
					"file":  "/var/log/app.log",
					// Missing: format, rotation
				},
				"performance": map[string]interface{}{
					"cache": true,
					// Missing: timeout, maxConnections
				},
				// Missing: security section
			},
		},
		"plugins": map[string]interface{}{
			"enabled": []string{"plugin1", "plugin2"},
			// Missing: config section
		},
		// Missing: monitoring section
	}

	// Default config with additional nested fields
	type ComplexConfig struct {
		App struct {
			Name     string `json:"name"`
			Version  string `json:"version"`
			Advanced struct {
				Logging struct {
					Level    string `json:"level"`
					File     string `json:"file"`
					Format   string `json:"format"`
					Rotation bool   `json:"rotation"`
				} `json:"logging"`
				Performance struct {
					Cache          bool `json:"cache"`
					Timeout        int  `json:"timeout"`
					MaxConnections int  `json:"maxConnections"`
				} `json:"performance"`
				Security struct {
					Enabled    bool   `json:"enabled"`
					TokenType  string `json:"tokenType"`
					ExpireTime int    `json:"expireTime"`
				} `json:"security"`
			} `json:"advanced"`
		} `json:"app"`
		Plugins struct {
			Enabled []string `json:"enabled"`
			Config  struct {
				LoadOrder []string          `json:"loadOrder"`
				Settings  map[string]string `json:"settings"`
			} `json:"config"`
		} `json:"plugins"`
		Monitoring struct {
			Enabled  bool   `json:"enabled"`
			Endpoint string `json:"endpoint"`
			Interval int    `json:"interval"`
		} `json:"monitoring"`
	}

	// Create config file
	configPath := filepath.Join(tempDir, "config.json")
	jsonData, _ := json.MarshalIndent(userConfig, "", "  ")
	os.WriteFile(configPath, jsonData, 0644)

	// Create migrator and load config
	logger := log.New()
	migrator := NewConfigMigrator(logger, tempDir, "config", configPath)
	k := koanf.New(".")
	k.Load(file.Provider(configPath), jsonparser.Parser())

	// Create complete default config
	defaultConfig := ComplexConfig{}
	defaultConfig.App.Name = "TestApp"
	defaultConfig.App.Version = "1.0.0"
	defaultConfig.App.Advanced.Logging.Level = "info"
	defaultConfig.App.Advanced.Logging.File = "/var/log/app.log"
	defaultConfig.App.Advanced.Logging.Format = "json"
	defaultConfig.App.Advanced.Logging.Rotation = true
	defaultConfig.App.Advanced.Performance.Cache = true
	defaultConfig.App.Advanced.Performance.Timeout = 30
	defaultConfig.App.Advanced.Performance.MaxConnections = 100
	defaultConfig.App.Advanced.Security.Enabled = true
	defaultConfig.App.Advanced.Security.TokenType = "JWT"
	defaultConfig.App.Advanced.Security.ExpireTime = 3600
	defaultConfig.Plugins.Enabled = []string{"plugin1", "plugin2"}
	defaultConfig.Plugins.Config.LoadOrder = []string{"plugin1", "plugin2"}
	defaultConfig.Plugins.Config.Settings = map[string]string{"key": "value"}
	defaultConfig.Monitoring.Enabled = true
	defaultConfig.Monitoring.Endpoint = "/metrics"
	defaultConfig.Monitoring.Interval = 60

	// Run migration
	result, err := migrator.AutoMigrate(defaultConfig, k)
	assert.NoError(t, err)
	assert.True(t, result.Migrated)

	// Verify user values are preserved
	assert.Equal(t, "info", k.String("app.advanced.logging.level"))
	assert.Equal(t, "/var/log/app.log", k.String("app.advanced.logging.file"))
	assert.True(t, k.Bool("app.advanced.performance.cache"))

	// Verify missing fields were added
	assert.Equal(t, "json", k.String("app.advanced.logging.format"))
	assert.True(t, k.Bool("app.advanced.logging.rotation"))
	assert.Equal(t, 30, k.Int("app.advanced.performance.timeout"))
	assert.Equal(t, 100, k.Int("app.advanced.performance.maxConnections"))
	assert.True(t, k.Bool("app.advanced.security.enabled"))
	assert.Equal(t, "JWT", k.String("app.advanced.security.tokenType"))
	assert.Equal(t, 3600, k.Int("app.advanced.security.expireTime"))
	assert.Equal(t, []string{"plugin1", "plugin2"}, k.Strings("plugins.config.loadOrder"))
	assert.True(t, k.Bool("monitoring.enabled"))
	assert.Equal(t, "/metrics", k.String("monitoring.endpoint"))
	assert.Equal(t, 60, k.Int("monitoring.interval"))

	t.Logf("Detected missing fields: %v", result.MissingFields)
	// Should detect multiple missing fields
	assert.Greater(t, len(result.MissingFields), 5, "Should detect multiple missing fields")
}

// TestConfigMigrator_MultipleMigrations tests running migration multiple times
func TestConfigMigrator_MultipleMigrations(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "config_migrator_multiple_test")
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create initial config
	configPath := createTestConfig(t, tempDir)
	logger := log.New()
	migrator := NewConfigMigrator(logger, tempDir, "config", configPath)

	// Create default config
	defaultConfig := TestConfig{}
	defaultConfig.App.Name = "TestApp"
	defaultConfig.App.Version = "1.0.0"
	defaultConfig.App.Theme = "dark"
	defaultConfig.User.Name = "Test User"
	defaultConfig.User.Email = "test@example.com"
	defaultConfig.User.Settings.AutoSave = true
	defaultConfig.User.Settings.Language = "en"
	defaultConfig.User.Settings.NewSetting = true
	defaultConfig.User.Settings.NewSetting2 = "value"
	defaultConfig.NewSection.Enabled = true
	defaultConfig.NewSection.Value = "new section"

	// First migration
	k1 := koanf.New(".")
	k1.Load(file.Provider(configPath), jsonparser.Parser())
	result1, err := migrator.AutoMigrate(defaultConfig, k1)
	assert.NoError(t, err)
	assert.True(t, result1.Migrated, "First migration should be performed")

	// Second migration - should detect no missing fields
	k2 := koanf.New(".")
	k2.Load(file.Provider(configPath), jsonparser.Parser())
	result2, err := migrator.AutoMigrate(defaultConfig, k2)
	assert.NoError(t, err)
	assert.False(t, result2.Migrated, "Second migration should not be needed")
	assert.Equal(t, 0, len(result2.MissingFields), "No fields should be missing in second migration")
}

// TestConfigMigrator_BackupHandling tests backup creation and cleanup
func TestConfigMigrator_BackupHandling(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "config_migrator_backup_test")
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	configPath := createTestConfig(t, tempDir)
	logger := log.New()
	migrator := NewConfigMigrator(logger, tempDir, "config", configPath)

	// Create default config
	defaultConfig := TestConfig{}
	defaultConfig.App.Name = "TestApp"
	defaultConfig.App.Version = "1.0.0"
	defaultConfig.App.Theme = "dark"
	defaultConfig.User.Name = "Test User"
	defaultConfig.User.Email = "test@example.com"
	defaultConfig.User.Settings.AutoSave = true
	defaultConfig.User.Settings.Language = "en"
	defaultConfig.User.Settings.NewSetting = true
	defaultConfig.User.Settings.NewSetting2 = "value"
	defaultConfig.NewSection.Enabled = true
	defaultConfig.NewSection.Value = "new section"

	k := koanf.New(".")
	k.Load(file.Provider(configPath), jsonparser.Parser())

	// Run migration
	result, err := migrator.AutoMigrate(defaultConfig, k)
	assert.NoError(t, err)
	assert.True(t, result.Migrated)

	// Backup should be cleaned up after successful migration
	backupFiles, _ := filepath.Glob(filepath.Join(tempDir, "*.backup.*"))
	assert.Equal(t, 0, len(backupFiles), "Backup should be cleaned up after successful migration")
}

// TestConfigMigrator_NoMigrationNeeded tests when no migration is needed
func TestConfigMigrator_NoMigrationNeeded(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "config_migrator_no_migration_test")
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create complete config (no missing fields)
	completeConfig := map[string]interface{}{
		"app": map[string]interface{}{
			"name":    "TestApp",
			"version": "1.0.0",
			"theme":   "dark",
		},
		"user": map[string]interface{}{
			"name":  "Test User",
			"email": "test@example.com",
			"settings": map[string]interface{}{
				"autoSave":    true,
				"language":    "en",
				"newSetting":  true,
				"newSetting2": "value",
			},
		},
		"newSection": map[string]interface{}{
			"enabled": true,
			"value":   "new section",
		},
	}

	configPath := filepath.Join(tempDir, "config.json")
	jsonData, _ := json.MarshalIndent(completeConfig, "", "  ")
	os.WriteFile(configPath, jsonData, 0644)

	logger := log.New()
	migrator := NewConfigMigrator(logger, tempDir, "config", configPath)
	k := koanf.New(".")
	k.Load(file.Provider(configPath), jsonparser.Parser())

	// Create matching default config
	defaultConfig := TestConfig{}
	defaultConfig.App.Name = "TestApp"
	defaultConfig.App.Version = "1.0.0"
	defaultConfig.App.Theme = "dark"
	defaultConfig.User.Name = "Test User"
	defaultConfig.User.Email = "test@example.com"
	defaultConfig.User.Settings.AutoSave = true
	defaultConfig.User.Settings.Language = "en"
	defaultConfig.User.Settings.NewSetting = true
	defaultConfig.User.Settings.NewSetting2 = "value"
	defaultConfig.NewSection.Enabled = true
	defaultConfig.NewSection.Value = "new section"

	// Run migration
	result, err := migrator.AutoMigrate(defaultConfig, k)
	assert.NoError(t, err)
	assert.False(t, result.Migrated, "No migration should be needed")
	assert.Equal(t, 0, len(result.MissingFields), "No fields should be missing")

	// No backup should be created
	backupFiles, _ := filepath.Glob(filepath.Join(tempDir, "*.backup.*"))
	assert.Equal(t, 0, len(backupFiles), "No backup should be created when migration is not needed")
}

// TestConfigMigrator_PartialOverride tests partial user override scenarios
func TestConfigMigrator_PartialOverride(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "config_migrator_partial_test")
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create user config with partial overrides
	userConfig := map[string]interface{}{
		"app": map[string]interface{}{
			"name":    "CustomApp",
			"version": "2.0.0", // User custom value
			// Missing: theme (should use default)
		},
		"user": map[string]interface{}{
			"name":  "Custom User",
			"email": "custom@example.com",
			"settings": map[string]interface{}{
				"autoSave": false, // User custom value
				"language": "zh",  // User custom value
				// Missing: newSetting, newSetting2 (should use defaults)
			},
		},
		// Missing: newSection (should use defaults)
	}

	configPath := filepath.Join(tempDir, "config.json")
	jsonData, _ := json.MarshalIndent(userConfig, "", "  ")
	os.WriteFile(configPath, jsonData, 0644)

	logger := log.New()
	migrator := NewConfigMigrator(logger, tempDir, "config", configPath)
	k := koanf.New(".")
	k.Load(file.Provider(configPath), jsonparser.Parser())

	// Create complete default config
	defaultConfig := TestConfig{}
	defaultConfig.App.Name = "DefaultApp"
	defaultConfig.App.Version = "1.0.0"
	defaultConfig.App.Theme = "light" // Should be added
	defaultConfig.User.Name = "Default User"
	defaultConfig.User.Email = "default@example.com"
	defaultConfig.User.Settings.AutoSave = true
	defaultConfig.User.Settings.Language = "en"
	defaultConfig.User.Settings.NewSetting = true     // Should be added
	defaultConfig.User.Settings.NewSetting2 = "value" // Should be added
	defaultConfig.NewSection.Enabled = true           // Should be added
	defaultConfig.NewSection.Value = "new section"    // Should be added

	// Run migration
	result, err := migrator.AutoMigrate(defaultConfig, k)
	assert.NoError(t, err)
	assert.True(t, result.Migrated)

	// Verify user values are preserved
	assert.Equal(t, "CustomApp", k.String("app.name"))
	assert.Equal(t, "2.0.0", k.String("app.version"))
	assert.Equal(t, "Custom User", k.String("user.name"))
	assert.Equal(t, "custom@example.com", k.String("user.email"))
	assert.False(t, k.Bool("user.settings.autoSave"))
	assert.Equal(t, "zh", k.String("user.settings.language"))

	// Verify missing fields were added with defaults
	assert.Equal(t, "light", k.String("app.theme"))
	assert.True(t, k.Bool("user.settings.newSetting"))
	assert.Equal(t, "value", k.String("user.settings.newSetting2"))
	assert.True(t, k.Bool("newSection.enabled"))
	assert.Equal(t, "new section", k.String("newSection.value"))
}

// TestConfigMigrator_ArrayMerge tests array and slice handling
func TestConfigMigrator_ArrayMerge(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "config_migrator_array_test")
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Config with arrays
	type ArrayConfig struct {
		Plugins struct {
			Enabled []string `json:"enabled"`
			Config  struct {
				LoadOrder []string          `json:"loadOrder"`
				Settings  map[string]string `json:"settings"`
			} `json:"config"`
		} `json:"plugins"`
		Database struct {
			Hosts []string `json:"hosts"`
			Ports []int    `json:"ports"`
		} `json:"database"`
	}

	// User config with some arrays
	userConfig := map[string]interface{}{
		"plugins": map[string]interface{}{
			"enabled": []string{"plugin1", "plugin2"}, // User's plugin list
			// Missing: config section
		},
		// Missing: database section
	}

	configPath := filepath.Join(tempDir, "config.json")
	jsonData, _ := json.MarshalIndent(userConfig, "", "  ")
	os.WriteFile(configPath, jsonData, 0644)

	logger := log.New()
	migrator := NewConfigMigrator(logger, tempDir, "config", configPath)
	k := koanf.New(".")
	k.Load(file.Provider(configPath), jsonparser.Parser())

	// Create default config with arrays
	defaultConfig := ArrayConfig{}
	defaultConfig.Plugins.Enabled = []string{"defaultPlugin1", "defaultPlugin2"}
	defaultConfig.Plugins.Config.LoadOrder = []string{"plugin1", "plugin2"}
	defaultConfig.Plugins.Config.Settings = map[string]string{"timeout": "30"}
	defaultConfig.Database.Hosts = []string{"localhost", "backup.host"}
	defaultConfig.Database.Ports = []int{5432, 5433}

	// Run migration
	result, err := migrator.AutoMigrate(defaultConfig, k)
	assert.NoError(t, err)
	assert.True(t, result.Migrated)

	// User's array should be preserved
	assert.Equal(t, []string{"plugin1", "plugin2"}, k.Strings("plugins.enabled"))

	// Missing arrays should be added from defaults
	assert.Equal(t, []string{"plugin1", "plugin2"}, k.Strings("plugins.config.loadOrder"))
	assert.Equal(t, []string{"localhost", "backup.host"}, k.Strings("database.hosts"))
	assert.Equal(t, []int{5432, 5433}, k.Ints("database.ports"))

	expectedSettings := map[string]string{"timeout": "30"}
	assert.Equal(t, expectedSettings, k.StringMap("plugins.config.settings"))
}

// TestConfigMigrator_DeepNesting tests very deep nested structures
func TestConfigMigrator_DeepNesting(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "config_migrator_deep_test")
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Deep nested config
	type DeepConfig struct {
		Level1 struct {
			Level2 struct {
				Level3 struct {
					Level4 struct {
						Level5 struct {
							Value string `json:"value"`
							Count int    `json:"count"`
						} `json:"level5"`
					} `json:"level4"`
				} `json:"level3"`
			} `json:"level2"`
		} `json:"level1"`
	}

	// User config with partial deep nesting
	userConfig := map[string]interface{}{
		"level1": map[string]interface{}{
			"level2": map[string]interface{}{
				"level3": map[string]interface{}{
					// Missing level4 completely
				},
			},
		},
	}

	configPath := filepath.Join(tempDir, "config.json")
	jsonData, _ := json.MarshalIndent(userConfig, "", "  ")
	os.WriteFile(configPath, jsonData, 0644)

	logger := log.New()
	migrator := NewConfigMigrator(logger, tempDir, "config", configPath)
	k := koanf.New(".")
	k.Load(file.Provider(configPath), jsonparser.Parser())

	// Create default config with complete deep nesting
	defaultConfig := DeepConfig{}
	defaultConfig.Level1.Level2.Level3.Level4.Level5.Value = "deep_value"
	defaultConfig.Level1.Level2.Level3.Level4.Level5.Count = 42

	// Run migration
	result, err := migrator.AutoMigrate(defaultConfig, k)
	assert.NoError(t, err)
	assert.True(t, result.Migrated)

	// Verify deep nested values were added
	assert.Equal(t, "deep_value", k.String("level1.level2.level3.level4.level5.value"))
	assert.Equal(t, 42, k.Int("level1.level2.level3.level4.level5.count"))

	t.Logf("Missing fields: %v", result.MissingFields)
	assert.Equal(t, 2, len(result.MissingFields), "Should detect 2 missing deep nested fields")
}

// TestConfigMigrator_EdgeCases tests various edge cases
func TestConfigMigrator_EdgeCases(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "config_migrator_edge_test")
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Edge case config with various data types
	userConfig := map[string]interface{}{
		"string_empty":  "",
		"string_spaces": "   ",
		"number_zero":   0,
		"number_float":  3.14,
		"bool_false":    false,
		"array_empty":   []interface{}{},
		"map_empty":     map[string]interface{}{},
		"null_value":    nil,
	}

	configPath := filepath.Join(tempDir, "config.json")
	jsonData, _ := json.MarshalIndent(userConfig, "", "  ")
	os.WriteFile(configPath, jsonData, 0644)

	logger := log.New()
	migrator := NewConfigMigrator(logger, tempDir, "config", configPath)
	k := koanf.New(".")
	k.Load(file.Provider(configPath), jsonparser.Parser())

	// Default config with different values
	type EdgeConfig struct {
		StringEmpty  string                 `json:"string_empty"`
		StringSpaces string                 `json:"string_spaces"`
		NumberZero   int                    `json:"number_zero"`
		NumberFloat  float64                `json:"number_float"`
		BoolFalse    bool                   `json:"bool_false"`
		ArrayEmpty   []string               `json:"array_empty"`
		MapEmpty     map[string]interface{} `json:"map_empty"`
		NullValue    *string                `json:"null_value"`
		NewField     string                 `json:"new_field"` // This should be added
	}

	defaultConfig := EdgeConfig{}
	defaultConfig.StringEmpty = "default_string"
	defaultConfig.StringSpaces = "default_spaces"
	defaultConfig.NumberZero = 42
	defaultConfig.NumberFloat = 2.71
	defaultConfig.BoolFalse = true
	defaultConfig.ArrayEmpty = []string{"default"}
	defaultConfig.MapEmpty = map[string]interface{}{"key": "value"}
	defaultValue := "default_null"
	defaultConfig.NullValue = &defaultValue
	defaultConfig.NewField = "new_field_value"

	// Run migration
	result, err := migrator.AutoMigrate(defaultConfig, k)
	assert.NoError(t, err)

	// All user edge case values should be preserved (they exist, even if empty/zero/false)
	assert.Equal(t, "", k.String("string_empty"))
	assert.Equal(t, "   ", k.String("string_spaces"))
	assert.Equal(t, 0, k.Int("number_zero"))
	assert.Equal(t, 3.14, k.Float64("number_float"))
	assert.False(t, k.Bool("bool_false"))
	assert.Equal(t, []string{}, k.Strings("array_empty"))

	// Only truly missing field should be added
	assert.Equal(t, "new_field_value", k.String("new_field"))

	// Should detect 2 missing fields: new_field and map_empty.key
	// The user has an empty map, but default config has a key inside that map
	assert.Equal(t, 2, len(result.MissingFields), "Should detect 2 missing fields: new_field and map_empty.key")
	assert.Contains(t, result.MissingFields, "new_field")
	assert.Contains(t, result.MissingFields, "map_empty.key")

	// Verify that the key was added to the empty map
	assert.Equal(t, "value", k.String("map_empty.key"))
}

// TestConfigMigrator_ErrorHandling tests error conditions
func TestConfigMigrator_ErrorHandling(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "config_migrator_error_test")
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	logger := log.New()
	configPath := filepath.Join(tempDir, "nonexistent.json")
	migrator := NewConfigMigrator(logger, tempDir, "config", configPath)

	// Test with empty koanf (no config file loaded)
	k := koanf.New(".")
	defaultConfig := TestConfig{}
	defaultConfig.App.Name = "TestApp"

	// This should still work (creates config from scratch)
	result, err := migrator.AutoMigrate(defaultConfig, k)
	assert.NoError(t, err)
	assert.True(t, result.Migrated)
	assert.Greater(t, len(result.MissingFields), 0)

	// Test with corrupted config file
	corruptedPath := filepath.Join(tempDir, "corrupted.json")
	os.WriteFile(corruptedPath, []byte("{invalid json"), 0644)

	k2 := koanf.New(".")
	// This should fail gracefully when trying to load the corrupted file
	err = k2.Load(file.Provider(corruptedPath), jsonparser.Parser())
	assert.Error(t, err, "Should fail to load corrupted JSON")
}

// TestConfigMigrator_ConcurrentAccess tests concurrent migration access
func TestConfigMigrator_ConcurrentAccess(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "config_migrator_concurrent_test")
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	configPath := createTestConfig(t, tempDir)
	logger := log.New()

	// Create multiple migrators
	numWorkers := 5
	results := make(chan *MigrationResult, numWorkers)
	errors := make(chan error, numWorkers)

	defaultConfig := TestConfig{}
	defaultConfig.App.Name = "TestApp"
	defaultConfig.App.Version = "1.0.0"
	defaultConfig.App.Theme = "dark"
	defaultConfig.User.Name = "Test User"
	defaultConfig.User.Email = "test@example.com"
	defaultConfig.User.Settings.AutoSave = true
	defaultConfig.User.Settings.Language = "en"
	defaultConfig.User.Settings.NewSetting = true
	defaultConfig.User.Settings.NewSetting2 = "value"
	defaultConfig.NewSection.Enabled = true
	defaultConfig.NewSection.Value = "new section"

	// Run concurrent migrations
	for i := 0; i < numWorkers; i++ {
		go func(workerID int) {
			// Each worker gets its own config path to avoid file conflicts
			workerConfigPath := filepath.Join(tempDir, fmt.Sprintf("config_%d.json", workerID))

			// Copy the original config for this worker
			originalData, _ := os.ReadFile(configPath)
			os.WriteFile(workerConfigPath, originalData, 0644)

			migrator := NewConfigMigrator(logger, tempDir, fmt.Sprintf("config_%d", workerID), workerConfigPath)
			k := koanf.New(".")
			k.Load(file.Provider(workerConfigPath), jsonparser.Parser())

			result, err := migrator.AutoMigrate(defaultConfig, k)
			if err != nil {
				errors <- err
				return
			}
			results <- result
		}(i)
	}

	// Collect results
	for i := 0; i < numWorkers; i++ {
		select {
		case result := <-results:
			assert.True(t, result.Migrated, "Each worker should successfully migrate")
			assert.Equal(t, 4, len(result.MissingFields), "Each worker should detect same missing fields")
		case err := <-errors:
			t.Errorf("Worker failed: %v", err)
		}
	}
}
