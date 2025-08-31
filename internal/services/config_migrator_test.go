package services

import (
	"encoding/json"
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

	// Check that backup was created
	backupFiles, err := filepath.Glob(filepath.Join(tempDir, "*.backup.*"))
	if err != nil {
		t.Fatalf("Failed to list backup files: %v", err)
	}
	assert.Equal(t, 1, len(backupFiles), "One backup file should have been created")
}
