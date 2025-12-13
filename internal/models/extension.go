package models

// ExtensionConfig 扩展配置项
type ExtensionConfig map[string]interface{}

// ExtensionKey 扩展标识符
type ExtensionKey string

// Extension 扩展配置
type Extension struct {
	Key     ExtensionKey    `json:"key"`
	Enabled bool            `json:"enabled"`
	Config  ExtensionConfig `json:"config"`
}

const (
	// 编辑增强扩展
	ExtensionRainbowBrackets             ExtensionKey = "rainbowBrackets"             // 彩虹括号
	ExtensionHyperlink                   ExtensionKey = "hyperlink"                   // 超链接
	ExtensionColorSelector               ExtensionKey = "colorSelector"               // 颜色选择器
	ExtensionFold                        ExtensionKey = "fold"                        // 代码折叠
	ExtensionTranslator                  ExtensionKey = "translator"                  // 划词翻译
	ExtensionMarkdown                    ExtensionKey = "markdown"                    // Markdown渲染
	ExtensionHighlightWhitespace         ExtensionKey = "highlightWhitespace"         // 显示空白字符
	ExtensionHighlightTrailingWhitespace ExtensionKey = "highlightTrailingWhitespace" // 高亮行尾空白
	ExtensionMinimap                     ExtensionKey = "minimap"                     // 小地图
	ExtensionLineNumbers                 ExtensionKey = "lineNumbers"                 // 行号显示
	ExtensionContextMenu                 ExtensionKey = "contextMenu"                 // 上下文菜单
	ExtensionSearch                      ExtensionKey = "search"                      // 搜索功能
	ExtensionHttpClient                  ExtensionKey = "httpClient"                  // HTTP 客户端
)

// NewDefaultExtensions 创建默认扩展配置
func NewDefaultExtensions() []Extension {
	return []Extension{
		// 编辑增强扩展
		{
			Key:     ExtensionRainbowBrackets,
			Enabled: true,
			Config:  ExtensionConfig{},
		},
		{
			Key:     ExtensionHyperlink,
			Enabled: true,
			Config:  ExtensionConfig{},
		},
		{
			Key:     ExtensionColorSelector,
			Enabled: true,
			Config:  ExtensionConfig{},
		},
		{
			Key:     ExtensionFold,
			Enabled: true,
			Config:  ExtensionConfig{},
		},
		{
			Key:     ExtensionTranslator,
			Enabled: true,
			Config:  ExtensionConfig{},
		},
		{
			Key:     ExtensionMarkdown,
			Enabled: true,
			Config:  ExtensionConfig{},
		},
		{
			Key:     ExtensionHighlightWhitespace,
			Enabled: true,
			Config:  ExtensionConfig{},
		},
		{
			Key:     ExtensionHighlightTrailingWhitespace,
			Enabled: true,
			Config:  ExtensionConfig{},
		},

		// UI增强扩展
		{
			Key:     ExtensionMinimap,
			Enabled: true,
			Config: ExtensionConfig{
				"displayText": "characters",
				"showOverlay": "always",
				"autohide":    false,
			},
		},
		{
			Key:     ExtensionLineNumbers,
			Enabled: true,
			Config:  ExtensionConfig{},
		},
		{
			Key:     ExtensionContextMenu,
			Enabled: true,
			Config:  ExtensionConfig{},
		},

		// 工具扩展
		{
			Key:     ExtensionSearch,
			Enabled: true,
			Config:  ExtensionConfig{},
		},
		{
			Key:     ExtensionHttpClient,
			Enabled: true,
			Config:  ExtensionConfig{},
		},
	}
}
