package models

import "time"

// KeyBinding 单个快捷键绑定
type KeyBinding struct {
	Command   KeyBindingCommand `json:"command" db:"command"`      // 快捷键动作
	Extension ExtensionID       `json:"extension" db:"extension"`  // 所属扩展
	Key       string            `json:"key" db:"key"`              // 快捷键组合（如 "Mod-f", "Ctrl-Shift-p"）
	Enabled   bool              `json:"enabled" db:"enabled"`      // 是否启用
	IsDefault bool              `json:"isDefault" db:"is_default"` // 是否为默认快捷键
}

// KeyBindingCommand 快捷键命令
type KeyBindingCommand string

const (
	// 搜索扩展相关
	ShowSearchCommand KeyBindingCommand = "showSearch" // 显示搜索
	HideSearchCommand KeyBindingCommand = "hideSearch" // 隐藏搜索

	// 代码块扩展相关
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

	// 代码折叠扩展相关
	FoldCodeCommand   KeyBindingCommand = "foldCode"   // 折叠代码
	UnfoldCodeCommand KeyBindingCommand = "unfoldCode" // 展开代码
	FoldAllCommand    KeyBindingCommand = "foldAll"    // 折叠全部
	UnfoldAllCommand  KeyBindingCommand = "unfoldAll"  // 展开全部

	// 通用编辑扩展相关
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

	// 历史记录扩展相关
	HistoryUndoCommand          KeyBindingCommand = "historyUndo"          // 撤销
	HistoryRedoCommand          KeyBindingCommand = "historyRedo"          // 重做
	HistoryUndoSelectionCommand KeyBindingCommand = "historyUndoSelection" // 撤销选择
	HistoryRedoSelectionCommand KeyBindingCommand = "historyRedoSelection" // 重做选择
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
		// 搜索扩展快捷键
		{
			Command:   ShowSearchCommand,
			Extension: ExtensionSearch,
			Key:       "Mod-f",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   HideSearchCommand,
			Extension: ExtensionSearch,
			Key:       "Escape",
			Enabled:   true,
			IsDefault: true,
		},

		// 代码块核心功能快捷键
		{
			Command:   BlockSelectAllCommand,
			Extension: ExtensionEditor,
			Key:       "Mod-a",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockAddAfterCurrentCommand,
			Extension: ExtensionEditor,
			Key:       "Mod-Enter",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockAddAfterLastCommand,
			Extension: ExtensionEditor,
			Key:       "Mod-Shift-Enter",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockAddBeforeCurrentCommand,
			Extension: ExtensionEditor,
			Key:       "Alt-Enter",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockGotoPreviousCommand,
			Extension: ExtensionEditor,
			Key:       "Mod-ArrowUp",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockGotoNextCommand,
			Extension: ExtensionEditor,
			Key:       "Mod-ArrowDown",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockSelectPreviousCommand,
			Extension: ExtensionEditor,
			Key:       "Mod-Shift-ArrowUp",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockSelectNextCommand,
			Extension: ExtensionEditor,
			Key:       "Mod-Shift-ArrowDown",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockDeleteCommand,
			Extension: ExtensionEditor,
			Key:       "Mod-Shift-d",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockMoveUpCommand,
			Extension: ExtensionEditor,
			Key:       "Alt-Mod-ArrowUp",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockMoveDownCommand,
			Extension: ExtensionEditor,
			Key:       "Alt-Mod-ArrowDown",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockDeleteLineCommand,
			Extension: ExtensionEditor,
			Key:       "Mod-Shift-k",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockMoveLineUpCommand,
			Extension: ExtensionEditor,
			Key:       "Alt-ArrowUp",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockMoveLineDownCommand,
			Extension: ExtensionEditor,
			Key:       "Alt-ArrowDown",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockTransposeCharsCommand,
			Extension: ExtensionEditor,
			Key:       "Ctrl-t",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockFormatCommand,
			Extension: ExtensionEditor,
			Key:       "Mod-Shift-f",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockCopyCommand,
			Extension: ExtensionEditor,
			Key:       "Mod-c",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockCutCommand,
			Extension: ExtensionEditor,
			Key:       "Mod-x",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   BlockPasteCommand,
			Extension: ExtensionEditor,
			Key:       "Mod-v",
			Enabled:   true,
			IsDefault: true,
		},

		// 代码折叠扩展快捷键
		{
			Command:   FoldCodeCommand,
			Extension: ExtensionFold,
			Key:       "Ctrl-Shift-[",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   UnfoldCodeCommand,
			Extension: ExtensionFold,
			Key:       "Ctrl-Shift-]",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   FoldAllCommand,
			Extension: ExtensionFold,
			Key:       "Ctrl-Alt-[",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   UnfoldAllCommand,
			Extension: ExtensionFold,
			Key:       "Ctrl-Alt-]",
			Enabled:   true,
			IsDefault: true,
		},

		// 历史记录扩展快捷键
		{
			Command:   HistoryUndoCommand,
			Extension: ExtensionEditor,
			Key:       "Mod-z",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   HistoryRedoCommand,
			Extension: ExtensionEditor,
			Key:       "Mod-Shift-z",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   HistoryUndoSelectionCommand,
			Extension: ExtensionEditor,
			Key:       "Mod-u",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   HistoryRedoSelectionCommand,
			Extension: ExtensionEditor,
			Key:       "Mod-Shift-u",
			Enabled:   true,
			IsDefault: true,
		},

		// 通用编辑扩展快捷键
		{
			Command:   CursorSyntaxLeftCommand,
			Extension: ExtensionEditor,
			Key:       "Alt-ArrowLeft",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   CursorSyntaxRightCommand,
			Extension: ExtensionEditor,
			Key:       "Alt-ArrowRight",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   SelectSyntaxLeftCommand,
			Extension: ExtensionEditor,
			Key:       "Shift-Alt-ArrowLeft",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   SelectSyntaxRightCommand,
			Extension: ExtensionEditor,
			Key:       "Shift-Alt-ArrowRight",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   CopyLineUpCommand,
			Extension: ExtensionEditor,
			Key:       "Shift-Alt-ArrowUp",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   CopyLineDownCommand,
			Extension: ExtensionEditor,
			Key:       "Shift-Alt-ArrowDown",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   InsertBlankLineCommand,
			Extension: ExtensionEditor,
			Key:       "Ctrl-Enter",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   SelectLineCommand,
			Extension: ExtensionEditor,
			Key:       "Alt-l",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   SelectParentSyntaxCommand,
			Extension: ExtensionEditor,
			Key:       "Ctrl-i",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   IndentLessCommand,
			Extension: ExtensionEditor,
			Key:       "Ctrl-[",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   IndentMoreCommand,
			Extension: ExtensionEditor,
			Key:       "Ctrl-]",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   IndentSelectionCommand,
			Extension: ExtensionEditor,
			Key:       "Ctrl-Alt-\\",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   CursorMatchingBracketCommand,
			Extension: ExtensionEditor,
			Key:       "Shift-Ctrl-\\",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   ToggleCommentCommand,
			Extension: ExtensionEditor,
			Key:       "Ctrl-/",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   ToggleBlockCommentCommand,
			Extension: ExtensionEditor,
			Key:       "Shift-Alt-a",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   InsertNewlineAndIndentCommand,
			Extension: ExtensionEditor,
			Key:       "Enter",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   DeleteCharBackwardCommand,
			Extension: ExtensionEditor,
			Key:       "Backspace",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   DeleteCharForwardCommand,
			Extension: ExtensionEditor,
			Key:       "Delete",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   DeleteGroupBackwardCommand,
			Extension: ExtensionEditor,
			Key:       "Ctrl-Backspace",
			Enabled:   true,
			IsDefault: true,
		},
		{
			Command:   DeleteGroupForwardCommand,
			Extension: ExtensionEditor,
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
