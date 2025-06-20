package models

import "time"

// KeyBinding 单个快捷键绑定
type KeyBinding struct {
	Action    KeyBindingAction   `json:"action"`    // 快捷键动作
	Category  KeyBindingCategory `json:"category"`  // 快捷键分类
	Scope     KeyBindingScope    `json:"scope"`     // 快捷键作用域
	Key       string             `json:"key"`       // 快捷键组合（如 "Mod-f", "Ctrl-Shift-p"）
	Enabled   bool               `json:"enabled"`   // 是否启用
	IsDefault bool               `json:"isDefault"` // 是否为默认快捷键
}

// KeyBindingCategory 快捷键分类
type KeyBindingCategory string

const (
	CategorySearch     KeyBindingCategory = "search"     // 搜索相关
	CategoryEdit       KeyBindingCategory = "edit"       // 编辑相关
	CategoryCodeBlock  KeyBindingCategory = "codeblock"  // 代码块相关
	CategoryNavigation KeyBindingCategory = "navigation" // 导航相关
	CategoryView       KeyBindingCategory = "view"       // 视图相关
	CategoryFile       KeyBindingCategory = "file"       // 文件相关
	CategoryApp        KeyBindingCategory = "app"        // 应用相关
)

// KeyBindingScope 快捷键作用域
type KeyBindingScope string

const (
	ScopeGlobal KeyBindingScope = "global" // 全局作用域
	ScopeEditor KeyBindingScope = "editor" // 编辑器作用域
	ScopeSearch KeyBindingScope = "search" // 搜索面板作用域
)

// KeyBindingAction 快捷键动作类型
type KeyBindingAction string

const (
	// 搜索相关
	ActionShowSearch      KeyBindingAction = "showSearch"      // 显示搜索
	ActionHideSearch      KeyBindingAction = "hideSearch"      // 隐藏搜索
	ActionFindNext        KeyBindingAction = "findNext"        // 查找下一个
	ActionFindPrevious    KeyBindingAction = "findPrevious"    // 查找上一个
	ActionShowReplace     KeyBindingAction = "showReplace"     // 显示替换
	ActionReplaceNext     KeyBindingAction = "replaceNext"     // 替换下一个
	ActionReplaceAll      KeyBindingAction = "replaceAll"      // 替换全部
	ActionToggleCase      KeyBindingAction = "toggleCase"      // 切换大小写匹配
	ActionToggleWholeWord KeyBindingAction = "toggleWholeWord" // 切换全词匹配
	ActionToggleRegex     KeyBindingAction = "toggleRegex"     // 切换正则表达式

	// 编辑相关
	ActionSelectAll     KeyBindingAction = "selectAll"     // 全选
	ActionCopy          KeyBindingAction = "copy"          // 复制
	ActionCut           KeyBindingAction = "cut"           // 剪切
	ActionPaste         KeyBindingAction = "paste"         // 粘贴
	ActionUndo          KeyBindingAction = "undo"          // 撤销
	ActionRedo          KeyBindingAction = "redo"          // 重做
	ActionDuplicateLine KeyBindingAction = "duplicateLine" // 复制行
	ActionDeleteLine    KeyBindingAction = "deleteLine"    // 删除行
	ActionMoveLineUp    KeyBindingAction = "moveLineUp"    // 上移行
	ActionMoveLineDown  KeyBindingAction = "moveLineDown"  // 下移行
	ActionToggleComment KeyBindingAction = "toggleComment" // 切换注释
	ActionIndent        KeyBindingAction = "indent"        // 缩进
	ActionOutdent       KeyBindingAction = "outdent"       // 取消缩进

	// 代码块相关
	ActionNewCodeBlock    KeyBindingAction = "newCodeBlock"    // 新建代码块
	ActionDeleteCodeBlock KeyBindingAction = "deleteCodeBlock" // 删除代码块
	ActionSelectCodeBlock KeyBindingAction = "selectCodeBlock" // 选择代码块
	ActionFormatCode      KeyBindingAction = "formatCode"      // 格式化代码
	ActionChangeLanguage  KeyBindingAction = "changeLanguage"  // 更改语言

	// 导航相关
	ActionGoToLine   KeyBindingAction = "goToLine"   // 跳转到行
	ActionFoldAll    KeyBindingAction = "foldAll"    // 折叠所有
	ActionUnfoldAll  KeyBindingAction = "unfoldAll"  // 展开所有
	ActionToggleFold KeyBindingAction = "toggleFold" // 切换折叠

	// 视图相关
	ActionZoomIn            KeyBindingAction = "zoomIn"            // 放大
	ActionZoomOut           KeyBindingAction = "zoomOut"           // 缩小
	ActionResetZoom         KeyBindingAction = "resetZoom"         // 重置缩放
	ActionToggleMinimap     KeyBindingAction = "toggleMinimap"     // 切换小地图
	ActionToggleLineNumbers KeyBindingAction = "toggleLineNumbers" // 切换行号

	// 文件相关
	ActionSave KeyBindingAction = "save" // 保存
)

// KeyBindingMetadata 快捷键配置元数据
type KeyBindingMetadata struct {
	LastUpdated string `json:"lastUpdated"` // 最后更新时间
}

// KeyBindingConfig 快捷键配置
type KeyBindingConfig struct {
	KeyBindings []KeyBinding       `json:"keyBindings"` // 快捷键列表
	Metadata    KeyBindingMetadata `json:"metadata"`    // 配置元数据
}

// NewDefaultKeyBindingConfig 创建默认快捷键配置
func NewDefaultKeyBindingConfig() *KeyBindingConfig {
	return &KeyBindingConfig{
		KeyBindings: NewDefaultKeyBindings(),
		Metadata: KeyBindingMetadata{
			LastUpdated: time.Now().Format(time.RFC3339),
		},
	}
}

// NewDefaultKeyBindings 创建默认快捷键配置
func NewDefaultKeyBindings() []KeyBinding {
	return []KeyBinding{
		// 搜索相关快捷键
		{
			Action:    ActionShowSearch,
			Category:  CategorySearch,
			Scope:     ScopeGlobal,
			Key:       "Mod-f",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionHideSearch,
			Category:  CategorySearch,
			Scope:     ScopeSearch,
			Key:       "Escape",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionFindNext,
			Category:  CategorySearch,
			Scope:     ScopeSearch,
			Key:       "Enter",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionFindPrevious,
			Category:  CategorySearch,
			Scope:     ScopeSearch,
			Key:       "Shift-Enter",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionShowReplace,
			Category:  CategorySearch,
			Scope:     ScopeSearch,
			Key:       "Mod-h",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionReplaceAll,
			Category:  CategorySearch,
			Scope:     ScopeSearch,
			Key:       "Mod-Alt-Enter",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionToggleCase,
			Category:  CategorySearch,
			Scope:     ScopeSearch,
			Key:       "Alt-c",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionToggleWholeWord,
			Category:  CategorySearch,
			Scope:     ScopeSearch,
			Key:       "Alt-w",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionToggleRegex,
			Category:  CategorySearch,
			Scope:     ScopeSearch,
			Key:       "Alt-r",
			Enabled:   true,
			IsDefault: true,
		},

		// 编辑相关快捷键
		{
			Action:    ActionSelectAll,
			Category:  CategoryEdit,
			Scope:     ScopeEditor,
			Key:       "Mod-a",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionCopy,
			Category:  CategoryEdit,
			Scope:     ScopeEditor,
			Key:       "Mod-c",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionCut,
			Category:  CategoryEdit,
			Scope:     ScopeEditor,
			Key:       "Mod-x",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionPaste,
			Category:  CategoryEdit,
			Scope:     ScopeEditor,
			Key:       "Mod-v",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionUndo,
			Category:  CategoryEdit,
			Scope:     ScopeEditor,
			Key:       "Mod-z",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionRedo,
			Category:  CategoryEdit,
			Scope:     ScopeEditor,
			Key:       "Mod-y",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionDuplicateLine,
			Category:  CategoryEdit,
			Scope:     ScopeEditor,
			Key:       "Mod-d",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionDeleteLine,
			Category:  CategoryEdit,
			Scope:     ScopeEditor,
			Key:       "Mod-Shift-k",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionMoveLineUp,
			Category:  CategoryEdit,
			Scope:     ScopeEditor,
			Key:       "Alt-ArrowUp",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionMoveLineDown,
			Category:  CategoryEdit,
			Scope:     ScopeEditor,
			Key:       "Alt-ArrowDown",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionToggleComment,
			Category:  CategoryEdit,
			Scope:     ScopeEditor,
			Key:       "Mod-/",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionIndent,
			Category:  CategoryEdit,
			Scope:     ScopeEditor,
			Key:       "Tab",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionOutdent,
			Category:  CategoryEdit,
			Scope:     ScopeEditor,
			Key:       "Shift-Tab",
			Enabled:   true,
			IsDefault: true,
		},

		// 代码块相关快捷键
		{
			Action:    ActionNewCodeBlock,
			Category:  CategoryCodeBlock,
			Scope:     ScopeEditor,
			Key:       "Mod-Alt-n",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionDeleteCodeBlock,
			Category:  CategoryCodeBlock,
			Scope:     ScopeEditor,
			Key:       "Mod-Alt-d",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionSelectCodeBlock,
			Category:  CategoryCodeBlock,
			Scope:     ScopeEditor,
			Key:       "Mod-Alt-a",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionFormatCode,
			Category:  CategoryCodeBlock,
			Scope:     ScopeEditor,
			Key:       "Mod-Alt-f",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionChangeLanguage,
			Category:  CategoryCodeBlock,
			Scope:     ScopeEditor,
			Key:       "Mod-Alt-l",
			Enabled:   true,
			IsDefault: true,
		},

		// 导航相关快捷键
		{
			Action:    ActionGoToLine,
			Category:  CategoryNavigation,
			Scope:     ScopeEditor,
			Key:       "Mod-g",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionFoldAll,
			Category:  CategoryNavigation,
			Scope:     ScopeEditor,
			Key:       "Mod-k Mod-0",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionUnfoldAll,
			Category:  CategoryNavigation,
			Scope:     ScopeEditor,
			Key:       "Mod-k Mod-j",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionToggleFold,
			Category:  CategoryNavigation,
			Scope:     ScopeEditor,
			Key:       "Mod-k Mod-l",
			Enabled:   true,
			IsDefault: true,
		},

		// 视图相关快捷键
		{
			Action:    ActionZoomIn,
			Category:  CategoryView,
			Scope:     ScopeGlobal,
			Key:       "Mod-=",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionZoomOut,
			Category:  CategoryView,
			Scope:     ScopeGlobal,
			Key:       "Mod--",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionResetZoom,
			Category:  CategoryView,
			Scope:     ScopeGlobal,
			Key:       "Mod-0",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionToggleMinimap,
			Category:  CategoryView,
			Scope:     ScopeGlobal,
			Key:       "Mod-m",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Action:    ActionToggleLineNumbers,
			Category:  CategoryView,
			Scope:     ScopeGlobal,
			Key:       "Mod-l",
			Enabled:   true,
			IsDefault: true,
		},

		// 文件相关快捷键
		{
			Action:    ActionSave,
			Category:  CategoryFile,
			Scope:     ScopeGlobal,
			Key:       "Mod-s",
			Enabled:   true,
			IsDefault: true,
		},
	}
}
