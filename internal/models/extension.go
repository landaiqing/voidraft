package models

// ExtensionConfig 扩展配置项
type ExtensionConfig map[string]interface{}

// ExtensionName 扩展标识符
type ExtensionName string

// Extension 扩展配置
type Extension struct {
	Name    ExtensionName   `json:"key"`
	Enabled bool            `json:"enabled"`
	Config  ExtensionConfig `json:"config"`
}

const (
	RainbowBrackets             ExtensionName = "rainbowBrackets"             // 彩虹括号
	Hyperlink                   ExtensionName = "hyperlink"                   // 超链接
	ColorSelector               ExtensionName = "colorSelector"               // 颜色选择器
	Fold                        ExtensionName = "fold"                        // 代码折叠
	Translator                  ExtensionName = "translator"                  // 划词翻译
	Markdown                    ExtensionName = "markdown"                    // Markdown渲染
	HighlightWhitespace         ExtensionName = "highlightWhitespace"         // 显示空白字符
	HighlightTrailingWhitespace ExtensionName = "highlightTrailingWhitespace" // 高亮行尾空白
	Minimap                     ExtensionName = "minimap"                     // 小地图
	LineNumbers                 ExtensionName = "lineNumbers"                 // 行号显示
	ContextMenu                 ExtensionName = "contextMenu"                 // 上下文菜单
	Search                      ExtensionName = "search"                      // 搜索功能
	HttpClient                  ExtensionName = "httpClient"                  // HTTP 客户端
)

// NewDefaultExtensions 创建默认扩展配置
func NewDefaultExtensions() []Extension {
	return []Extension{
		// 编辑增强扩展
		{
			Name:    RainbowBrackets,
			Enabled: true,
			Config:  ExtensionConfig{},
		},
		{
			Name:    Hyperlink,
			Enabled: true,
			Config:  ExtensionConfig{},
		},
		{
			Name:    ColorSelector,
			Enabled: true,
			Config:  ExtensionConfig{},
		},
		{
			Name:    Fold,
			Enabled: true,
			Config:  ExtensionConfig{},
		},
		{
			Name:    Translator,
			Enabled: true,
			Config:  ExtensionConfig{},
		},
		{
			Name:    Markdown,
			Enabled: true,
			Config:  ExtensionConfig{},
		},
		{
			Name:    HighlightWhitespace,
			Enabled: true,
			Config:  ExtensionConfig{},
		},
		{
			Name:    HighlightTrailingWhitespace,
			Enabled: true,
			Config:  ExtensionConfig{},
		},

		// UI增强扩展
		{
			Name:    Minimap,
			Enabled: true,
			Config: ExtensionConfig{
				"displayText": "characters",
				"showOverlay": "always",
				"autohide":    false,
			},
		},
		{
			Name:    LineNumbers,
			Enabled: true,
			Config:  ExtensionConfig{},
		},
		{
			Name:    ContextMenu,
			Enabled: true,
			Config:  ExtensionConfig{},
		},

		// 工具扩展
		{
			Name:    Search,
			Enabled: true,
			Config:  ExtensionConfig{},
		},
		{
			Name:    HttpClient,
			Enabled: true,
			Config:  ExtensionConfig{},
		},
	}
}
