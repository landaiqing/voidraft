package models

import "time"

// Extension 单个扩展配置
type Extension struct {
	ID        ExtensionID       `json:"id"`        // 扩展唯一标识
	Category  ExtensionCategory `json:"category"`  // 扩展分类
	Enabled   bool              `json:"enabled"`   // 是否启用
	IsDefault bool              `json:"isDefault"` // 是否为默认扩展
	Config    ExtensionConfig   `json:"config"`    // 扩展配置项
}

// ExtensionID 扩展标识符
type ExtensionID string

const (
	// 编辑增强扩展
	ExtensionRainbowBrackets ExtensionID = "rainbowBrackets" // 彩虹括号
	ExtensionHyperlink       ExtensionID = "hyperlink"       // 超链接
	ExtensionColorSelector   ExtensionID = "colorSelector"   // 颜色选择器
	ExtensionFold            ExtensionID = "fold"
	ExtensionTextHighlight   ExtensionID = "textHighlight"

	// UI增强扩展
	ExtensionMinimap ExtensionID = "minimap" // 小地图

	// 工具扩展
	ExtensionSearch    ExtensionID = "search"    // 搜索功能
	ExtensionCodeBlock ExtensionID = "codeBlock" // 代码块
)

// ExtensionCategory 扩展分类
type ExtensionCategory string

const (
	CategoryEditing ExtensionCategory = "editing" // 编辑增强
	CategoryUI      ExtensionCategory = "ui"      // 界面增强
	CategoryTools   ExtensionCategory = "tools"   // 工具类
)

// ExtensionConfig 扩展配置项（动态配置）
type ExtensionConfig map[string]interface{}

// ExtensionMetadata 扩展配置元数据
type ExtensionMetadata struct {
	Version     string `json:"version"`     // 配置版本
	LastUpdated string `json:"lastUpdated"` // 最后更新时间
}

// ExtensionSettings 扩展设置配置
type ExtensionSettings struct {
	Extensions []Extension       `json:"extensions"` // 扩展列表
	Metadata   ExtensionMetadata `json:"metadata"`   // 配置元数据
}

// NewDefaultExtensionSettings 创建默认扩展配置
func NewDefaultExtensionSettings() *ExtensionSettings {
	return &ExtensionSettings{
		Extensions: NewDefaultExtensions(),
		Metadata: ExtensionMetadata{
			Version:     "1.0.0",
			LastUpdated: time.Now().Format(time.RFC3339),
		},
	}
}

// NewDefaultExtensions 创建默认扩展配置
func NewDefaultExtensions() []Extension {
	return []Extension{
		// 编辑增强扩展
		{
			ID:        ExtensionRainbowBrackets,
			Category:  CategoryEditing,
			Enabled:   true,
			IsDefault: true,
			Config:    ExtensionConfig{},
		},
		{
			ID:        ExtensionHyperlink,
			Category:  CategoryEditing,
			Enabled:   true,
			IsDefault: true,
			Config:    ExtensionConfig{},
		},
		{
			ID:        ExtensionColorSelector,
			Category:  CategoryEditing,
			Enabled:   true,
			IsDefault: true,
			Config:    ExtensionConfig{},
		},

		// UI增强扩展
		{
			ID:        ExtensionMinimap,
			Category:  CategoryUI,
			Enabled:   true,
			IsDefault: true,
			Config: ExtensionConfig{
				"displayText": "characters",
				"showOverlay": "always",
				"autohide":    false,
			},
		},

		// 工具扩展
		{
			ID:        ExtensionSearch,
			Category:  CategoryTools,
			Enabled:   true,
			IsDefault: true,
			Config:    ExtensionConfig{},
		},
		{
			ID:        ExtensionCodeBlock,
			Category:  CategoryTools,
			Enabled:   true,
			IsDefault: true,
			Config: ExtensionConfig{
				"showBackground":      true,
				"enableAutoDetection": true,
			},
		},
		{
			ID:        ExtensionFold,
			Category:  CategoryEditing,
			Enabled:   true,
			IsDefault: true,
			Config:    ExtensionConfig{},
		},
		{
			ID:        ExtensionTextHighlight,
			Category:  CategoryEditing,
			Enabled:   true,
			IsDefault: true,
			Config:    ExtensionConfig{},
		},
	}
}

// GetVersion 获取配置版本
func (es *ExtensionSettings) GetVersion() string {
	return es.Metadata.Version
}

// SetVersion 设置配置版本
func (es *ExtensionSettings) SetVersion(version string) {
	es.Metadata.Version = version
}

// SetLastUpdated 设置最后更新时间
func (es *ExtensionSettings) SetLastUpdated(timeStr string) {
	es.Metadata.LastUpdated = timeStr
}

// GetDefaultConfig 获取默认配置
func (es *ExtensionSettings) GetDefaultConfig() any {
	return NewDefaultExtensionSettings()
}

// GetExtensionByID 根据ID获取扩展
func (es *ExtensionSettings) GetExtensionByID(id ExtensionID) *Extension {
	for i := range es.Extensions {
		if es.Extensions[i].ID == id {
			return &es.Extensions[i]
		}
	}
	return nil
}

// UpdateExtension 更新扩展配置
func (es *ExtensionSettings) UpdateExtension(id ExtensionID, enabled bool, config ExtensionConfig) bool {
	for i := range es.Extensions {
		if es.Extensions[i].ID == id {
			es.Extensions[i].Enabled = enabled
			if config != nil {
				es.Extensions[i].Config = config
			}
			es.SetLastUpdated(time.Now().Format(time.RFC3339))
			return true
		}
	}
	return false
}
