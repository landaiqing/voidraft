package models

import "time"

// KeyBinding 单个快捷键绑定
type KeyBinding struct {
	Command   KeyBindingCommand  `json:"command"`   // 快捷键动作
	Category  KeyBindingCategory `json:"category"`  // 快捷键分类
	Key       string             `json:"key"`       // 快捷键组合（如 "Mod-f", "Ctrl-Shift-p"）
	Enabled   bool               `json:"enabled"`   // 是否启用
	IsDefault bool               `json:"isDefault"` // 是否为默认快捷键
}

// KeyBindingCategory 快捷键分类
type KeyBindingCategory string

const (
	CategorySearch    KeyBindingCategory = "search"  // 搜索相关
	CategoryEdit      KeyBindingCategory = "edit"    // 编辑相关
	CategoryCodeBlock KeyBindingCategory = "block"   // 代码块相关
	CategoryHistory   KeyBindingCategory = "history" // 历史记录相关
	CategoryFold      KeyBindingCategory = "fold"    // 代码折叠相关
)

// KeyBindingCommand 快捷键命令
type KeyBindingCommand string

const (
	// 搜索相关
	ShowSearchCommand        KeyBindingCommand = "showSearch"        // 显示搜索
	HideSearchCommand        KeyBindingCommand = "hideSearch"        // 隐藏搜索
	SearchToggleCaseCommand  KeyBindingCommand = "searchToggleCase"  // 搜索切换大小写
	SearchToggleWordCommand  KeyBindingCommand = "searchToggleWord"  // 搜索切换整词
	SearchToggleRegexCommand KeyBindingCommand = "searchToggleRegex" // 搜索切换正则
	SearchShowReplaceCommand KeyBindingCommand = "searchShowReplace" // 显示替换
	SearchReplaceAllCommand  KeyBindingCommand = "searchReplaceAll"  // 替换全部

	// 代码块相关
	BlockSelectAllCommand        KeyBindingCommand = "blockSelectAll"        // 块内选择全部
	BlockAddAfterCurrentCommand  KeyBindingCommand = "blockAddAfterCurrent"  // 在当前块后添加新块
	BlockAddAfterLastCommand     KeyBindingCommand = "blockAddAfterLast"     // 在最后添加新块
	BlockAddBeforeCurrentCommand KeyBindingCommand = "blockAddBeforeCurrent" // 在当前块前添加新块
	BlockGotoPreviousCommand     KeyBindingCommand = "blockGotoPrevious"     // 跳转到上一个块
	BlockGotoNextCommand         KeyBindingCommand = "blockGotoNext"         // 跳转到下一个块
	BlockSelectPreviousCommand   KeyBindingCommand = "blockSelectPrevious"   // 选择上一个块
	BlockSelectNextCommand       KeyBindingCommand = "blockSelectNext"       // 选择下一个块
	BlockDeleteCommand           KeyBindingCommand = "blockDelete"           // 删除当前块
	BlockMoveUpCommand           KeyBindingCommand = "blockMoveUp"           // 向上移动当前块
	BlockMoveDownCommand         KeyBindingCommand = "blockMoveDown"         // 向下移动当前块
	BlockDeleteLineCommand       KeyBindingCommand = "blockDeleteLine"       // 删除行
	BlockMoveLineUpCommand       KeyBindingCommand = "blockMoveLineUp"       // 向上移动行
	BlockMoveLineDownCommand     KeyBindingCommand = "blockMoveLineDown"     // 向下移动行
	BlockTransposeCharsCommand   KeyBindingCommand = "blockTransposeChars"   // 字符转置
	BlockFormatCommand           KeyBindingCommand = "blockFormat"           // 格式化代码块
	BlockCopyCommand             KeyBindingCommand = "blockCopy"             // 复制
	BlockCutCommand              KeyBindingCommand = "blockCut"              // 剪切
	BlockPasteCommand            KeyBindingCommand = "blockPaste"            // 粘贴

	// 历史记录相关
	HistoryUndoCommand          KeyBindingCommand = "historyUndo"          // 撤销
	HistoryRedoCommand          KeyBindingCommand = "historyRedo"          // 重做
	HistoryUndoSelectionCommand KeyBindingCommand = "historyUndoSelection" // 撤销选择
	HistoryRedoSelectionCommand KeyBindingCommand = "historyRedoSelection" // 重做选择

	// 代码折叠相关
	FoldCodeCommand   KeyBindingCommand = "foldCode"   // 折叠代码
	UnfoldCodeCommand KeyBindingCommand = "unfoldCode" // 展开代码
	FoldAllCommand    KeyBindingCommand = "foldAll"    // 折叠全部
	UnfoldAllCommand  KeyBindingCommand = "unfoldAll"  // 展开全部

	// 编辑相关
	CursorSyntaxLeftCommand       KeyBindingCommand = "cursorSyntaxLeft"       // 光标按语法左移
	CursorSyntaxRightCommand      KeyBindingCommand = "cursorSyntaxRight"      // 光标按语法右移
	SelectSyntaxLeftCommand       KeyBindingCommand = "selectSyntaxLeft"       // 按语法选择左侧
	SelectSyntaxRightCommand      KeyBindingCommand = "selectSyntaxRight"      // 按语法选择右侧
	CopyLineUpCommand             KeyBindingCommand = "copyLineUp"             // 向上复制行
	CopyLineDownCommand           KeyBindingCommand = "copyLineDown"           // 向下复制行
	InsertBlankLineCommand        KeyBindingCommand = "insertBlankLine"        // 插入空行
	SelectLineCommand             KeyBindingCommand = "selectLine"             // 选择行
	SelectParentSyntaxCommand     KeyBindingCommand = "selectParentSyntax"     // 选择父级语法
	IndentLessCommand             KeyBindingCommand = "indentLess"             // 减少缩进
	IndentMoreCommand             KeyBindingCommand = "indentMore"             // 增加缩进
	IndentSelectionCommand        KeyBindingCommand = "indentSelection"        // 缩进选择
	CursorMatchingBracketCommand  KeyBindingCommand = "cursorMatchingBracket"  // 光标到匹配括号
	ToggleCommentCommand          KeyBindingCommand = "toggleComment"          // 切换注释
	ToggleBlockCommentCommand     KeyBindingCommand = "toggleBlockComment"     // 切换块注释
	InsertNewlineAndIndentCommand KeyBindingCommand = "insertNewlineAndIndent" // 插入新行并缩进
	DeleteCharBackwardCommand     KeyBindingCommand = "deleteCharBackward"     // 向后删除字符
	DeleteCharForwardCommand      KeyBindingCommand = "deleteCharForward"      // 向前删除字符
	DeleteGroupBackwardCommand    KeyBindingCommand = "deleteGroupBackward"    // 向后删除组
	DeleteGroupForwardCommand     KeyBindingCommand = "deleteGroupForward"     // 向前删除组
)

// KeyBindingMetadata 快捷键配置元数据
type KeyBindingMetadata struct {
	Version     string `json:"version"`     // 配置版本
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
			Version:     "1.0.0",
			LastUpdated: time.Now().Format(time.RFC3339),
		},
	}
}

// NewDefaultKeyBindings 创建默认快捷键配置
func NewDefaultKeyBindings() []KeyBinding {
	return []KeyBinding{
		// 搜索相关快捷键
		{
			Command:   ShowSearchCommand,
			Category:  CategorySearch,
			Key:       "Mod-f",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   HideSearchCommand,
			Category:  CategorySearch,
			Key:       "Escape",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   SearchToggleCaseCommand,
			Category:  CategorySearch,
			Key:       "Alt-c",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   SearchToggleWordCommand,
			Category:  CategorySearch,
			Key:       "Alt-w",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   SearchToggleRegexCommand,
			Category:  CategorySearch,
			Key:       "Alt-r",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   SearchShowReplaceCommand,
			Category:  CategorySearch,
			Key:       "Mod-h",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   SearchReplaceAllCommand,
			Category:  CategorySearch,
			Key:       "Mod-Alt-Enter",
			Enabled:   true,
			IsDefault: true,
		},

		// 代码块相关快捷键
		{
			Command:   BlockSelectAllCommand,
			Category:  CategoryCodeBlock,
			Key:       "Mod-a",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockAddAfterCurrentCommand,
			Category:  CategoryCodeBlock,
			Key:       "Mod-Enter",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockAddAfterLastCommand,
			Category:  CategoryCodeBlock,
			Key:       "Mod-Shift-Enter",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockAddBeforeCurrentCommand,
			Category:  CategoryCodeBlock,
			Key:       "Alt-Enter",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockGotoPreviousCommand,
			Category:  CategoryCodeBlock,
			Key:       "Mod-ArrowUp",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockGotoNextCommand,
			Category:  CategoryCodeBlock,
			Key:       "Mod-ArrowDown",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockSelectPreviousCommand,
			Category:  CategoryCodeBlock,
			Key:       "Mod-Shift-ArrowUp",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockSelectNextCommand,
			Category:  CategoryCodeBlock,
			Key:       "Mod-Shift-ArrowDown",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockDeleteCommand,
			Category:  CategoryCodeBlock,
			Key:       "Mod-Shift-d",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockMoveUpCommand,
			Category:  CategoryCodeBlock,
			Key:       "Alt-Mod-ArrowUp",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockMoveDownCommand,
			Category:  CategoryCodeBlock,
			Key:       "Alt-Mod-ArrowDown",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockDeleteLineCommand,
			Category:  CategoryCodeBlock,
			Key:       "Mod-Shift-k",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockMoveLineUpCommand,
			Category:  CategoryCodeBlock,
			Key:       "Alt-ArrowUp",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockMoveLineDownCommand,
			Category:  CategoryCodeBlock,
			Key:       "Alt-ArrowDown",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockTransposeCharsCommand,
			Category:  CategoryCodeBlock,
			Key:       "Ctrl-t",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockFormatCommand,
			Category:  CategoryCodeBlock,
			Key:       "Mod-Shift-f",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockCopyCommand,
			Category:  CategoryCodeBlock,
			Key:       "Mod-c",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockCutCommand,
			Category:  CategoryCodeBlock,
			Key:       "Mod-x",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockPasteCommand,
			Category:  CategoryCodeBlock,
			Key:       "Mod-v",
			Enabled:   true,
			IsDefault: true,
		},

		// 历史记录相关快捷键
		{
			Command:   HistoryUndoCommand,
			Category:  CategoryHistory,
			Key:       "Mod-z",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   HistoryRedoCommand,
			Category:  CategoryHistory,
			Key:       "Mod-Shift-z",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   HistoryUndoSelectionCommand,
			Category:  CategoryHistory,
			Key:       "Mod-u",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   HistoryRedoSelectionCommand,
			Category:  CategoryHistory,
			Key:       "Mod-Shift-u",
			Enabled:   true,
			IsDefault: true,
		},

		// 代码折叠相关快捷键
		{
			Command:   FoldCodeCommand,
			Category:  CategoryFold,
			Key:       "Ctrl-Shift-[",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   UnfoldCodeCommand,
			Category:  CategoryFold,
			Key:       "Ctrl-Shift-]",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   FoldAllCommand,
			Category:  CategoryFold,
			Key:       "Ctrl-Alt-[",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   UnfoldAllCommand,
			Category:  CategoryFold,
			Key:       "Ctrl-Alt-]",
			Enabled:   true,
			IsDefault: true,
		},

		// 编辑相关快捷键 (避免冲突的快捷键)
		{
			Command:   CursorSyntaxLeftCommand,
			Category:  CategoryEdit,
			Key:       "Alt-ArrowLeft",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   CursorSyntaxRightCommand,
			Category:  CategoryEdit,
			Key:       "Alt-ArrowRight",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   SelectSyntaxLeftCommand,
			Category:  CategoryEdit,
			Key:       "Shift-Alt-ArrowLeft",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   SelectSyntaxRightCommand,
			Category:  CategoryEdit,
			Key:       "Shift-Alt-ArrowRight",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   CopyLineUpCommand,
			Category:  CategoryEdit,
			Key:       "Shift-Alt-ArrowUp",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   CopyLineDownCommand,
			Category:  CategoryEdit,
			Key:       "Shift-Alt-ArrowDown",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   InsertBlankLineCommand,
			Category:  CategoryEdit,
			Key:       "Ctrl-Enter",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   SelectLineCommand,
			Category:  CategoryEdit,
			Key:       "Alt-l",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   SelectParentSyntaxCommand,
			Category:  CategoryEdit,
			Key:       "Ctrl-i",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   IndentLessCommand,
			Category:  CategoryEdit,
			Key:       "Ctrl-[",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   IndentMoreCommand,
			Category:  CategoryEdit,
			Key:       "Ctrl-]",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   IndentSelectionCommand,
			Category:  CategoryEdit,
			Key:       "Ctrl-Alt-\\",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   CursorMatchingBracketCommand,
			Category:  CategoryEdit,
			Key:       "Shift-Ctrl-\\",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   ToggleCommentCommand,
			Category:  CategoryEdit,
			Key:       "Ctrl-/",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   ToggleBlockCommentCommand,
			Category:  CategoryEdit,
			Key:       "Shift-Alt-a",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   InsertNewlineAndIndentCommand,
			Category:  CategoryEdit,
			Key:       "Enter",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   DeleteCharBackwardCommand,
			Category:  CategoryEdit,
			Key:       "Backspace",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   DeleteCharForwardCommand,
			Category:  CategoryEdit,
			Key:       "Delete",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   DeleteGroupBackwardCommand,
			Category:  CategoryEdit,
			Key:       "Ctrl-Backspace",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   DeleteGroupForwardCommand,
			Category:  CategoryEdit,
			Key:       "Ctrl-Delete",
			Enabled:   true,
			IsDefault: true,
		},
	}
}

// GetVersion 获取配置版本
func (kbc *KeyBindingConfig) GetVersion() string {
	return kbc.Metadata.Version
}

// SetVersion 设置配置版本
func (kbc *KeyBindingConfig) SetVersion(version string) {
	kbc.Metadata.Version = version
}

// SetLastUpdated 设置最后更新时间
func (kbc *KeyBindingConfig) SetLastUpdated(timeStr string) {
	kbc.Metadata.LastUpdated = timeStr
}

// GetDefaultConfig 获取默认配置
func (kbc *KeyBindingConfig) GetDefaultConfig() any {
	return NewDefaultKeyBindingConfig()
}
