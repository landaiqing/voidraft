package models

// KeyBindingKey 快捷键命令
type KeyBindingKey string

// KeyBinding 单个快捷键绑定
type KeyBinding struct {
	Key       KeyBindingKey `json:"key"`
	Command   string        `json:"command"`
	Extension ExtensionKey  `json:"extension"`
	Enabled   bool          `json:"enabled"`
}

const (
	ShowSearchKeyBindingKey             KeyBindingKey = "showSearch"             // 显示搜索
	HideSearchKeyBindingKey             KeyBindingKey = "hideSearch"             // 隐藏搜索
	BlockSelectAllKeyBindingKey         KeyBindingKey = "blockSelectAll"         // 块内选择全部
	BlockAddAfterCurrentKeyBindingKey   KeyBindingKey = "blockAddAfterCurrent"   // 在当前块后添加新块
	BlockAddAfterLastKeyBindingKey      KeyBindingKey = "blockAddAfterLast"      // 在最后添加新块
	BlockAddBeforeCurrentKeyBindingKey  KeyBindingKey = "blockAddBeforeCurrent"  // 在当前块前添加新块
	BlockGotoPreviousKeyBindingKey      KeyBindingKey = "blockGotoPrevious"      // 跳转到上一个块
	BlockGotoNextKeyBindingKey          KeyBindingKey = "blockGotoNext"          // 跳转到下一个块
	BlockSelectPreviousKeyBindingKey    KeyBindingKey = "blockSelectPrevious"    // 选择上一个块
	BlockSelectNextKeyBindingKey        KeyBindingKey = "blockSelectNext"        // 选择下一个块
	BlockDeleteKeyBindingKey            KeyBindingKey = "blockDelete"            // 删除当前块
	BlockMoveUpKeyBindingKey            KeyBindingKey = "blockMoveUp"            // 向上移动当前块
	BlockMoveDownKeyBindingKey          KeyBindingKey = "blockMoveDown"          // 向下移动当前块
	BlockDeleteLineKeyBindingKey        KeyBindingKey = "blockDeleteLine"        // 删除行
	BlockMoveLineUpKeyBindingKey        KeyBindingKey = "blockMoveLineUp"        // 向上移动行
	BlockMoveLineDownKeyBindingKey      KeyBindingKey = "blockMoveLineDown"      // 向下移动行
	BlockTransposeCharsKeyBindingKey    KeyBindingKey = "blockTransposeChars"    // 字符转置
	BlockFormatKeyBindingKey            KeyBindingKey = "blockFormat"            // 格式化代码块
	BlockCopyKeyBindingKey              KeyBindingKey = "blockCopy"              // 复制
	BlockCutKeyBindingKey               KeyBindingKey = "blockCut"               // 剪切
	BlockPasteKeyBindingKey             KeyBindingKey = "blockPaste"             // 粘贴
	FoldCodeKeyBindingKey               KeyBindingKey = "foldCode"               // 折叠代码
	UnfoldCodeKeyBindingKey             KeyBindingKey = "unfoldCode"             // 展开代码
	FoldAllKeyBindingKey                KeyBindingKey = "foldAll"                // 折叠全部
	UnfoldAllKeyBindingKey              KeyBindingKey = "unfoldAll"              // 展开全部
	CursorSyntaxLeftKeyBindingKey       KeyBindingKey = "cursorSyntaxLeft"       // 光标按语法左移
	CursorSyntaxRightKeyBindingKey      KeyBindingKey = "cursorSyntaxRight"      // 光标按语法右移
	SelectSyntaxLeftKeyBindingKey       KeyBindingKey = "selectSyntaxLeft"       // 按语法选择左侧
	SelectSyntaxRightKeyBindingKey      KeyBindingKey = "selectSyntaxRight"      // 按语法选择右侧
	CopyLineUpKeyBindingKey             KeyBindingKey = "copyLineUp"             // 向上复制行
	CopyLineDownKeyBindingKey           KeyBindingKey = "copyLineDown"           // 向下复制行
	InsertBlankLineKeyBindingKey        KeyBindingKey = "insertBlankLine"        // 插入空行
	SelectLineKeyBindingKey             KeyBindingKey = "selectLine"             // 选择行
	SelectParentSyntaxKeyBindingKey     KeyBindingKey = "selectParentSyntax"     // 选择父级语法
	IndentLessKeyBindingKey             KeyBindingKey = "indentLess"             // 减少缩进
	IndentMoreKeyBindingKey             KeyBindingKey = "indentMore"             // 增加缩进
	IndentSelectionKeyBindingKey        KeyBindingKey = "indentSelection"        // 缩进选择
	CursorMatchingBracketKeyBindingKey  KeyBindingKey = "cursorMatchingBracket"  // 光标到匹配括号
	ToggleCommentKeyBindingKey          KeyBindingKey = "toggleComment"          // 切换注释
	ToggleBlockCommentKeyBindingKey     KeyBindingKey = "toggleBlockComment"     // 切换块注释
	InsertNewlineAndIndentKeyBindingKey KeyBindingKey = "insertNewlineAndIndent" // 插入新行并缩进
	DeleteCharBackwardKeyBindingKey     KeyBindingKey = "deleteCharBackward"     // 向后删除字符
	DeleteCharForwardKeyBindingKey      KeyBindingKey = "deleteCharForward"      // 向前删除字符
	DeleteGroupBackwardKeyBindingKey    KeyBindingKey = "deleteGroupBackward"    // 向后删除组
	DeleteGroupForwardKeyBindingKey     KeyBindingKey = "deleteGroupForward"     // 向前删除组
	HistoryUndoKeyBindingKey            KeyBindingKey = "historyUndo"            // 撤销
	HistoryRedoKeyBindingKey            KeyBindingKey = "historyRedo"            // 重做
	HistoryUndoSelectionKeyBindingKey   KeyBindingKey = "historyUndoSelection"   // 撤销选择
	HistoryRedoSelectionKeyBindingKey   KeyBindingKey = "historyRedoSelection"   // 重做选择
)

const defaultExtension = "editor"

// NewDefaultKeyBindings 创建默认快捷键配置
func NewDefaultKeyBindings() []KeyBinding {
	return []KeyBinding{
		{
			Key:       ShowSearchKeyBindingKey,
			Extension: ExtensionSearch,
			Command:   "Mod-f",
			Enabled:   true,
		},
		{
			Key:       HideSearchKeyBindingKey,
			Extension: ExtensionSearch,
			Command:   "Escape",
			Enabled:   true,
		},

		{
			Key:       BlockSelectAllKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Mod-a",
			Enabled:   true,
		},
		{
			Key:       BlockAddAfterCurrentKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Mod-Enter",
			Enabled:   true,
		},
		{
			Key:       BlockAddAfterLastKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Mod-Shift-Enter",
			Enabled:   true,
		},
		{
			Key:       BlockAddBeforeCurrentKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Alt-Enter",
			Enabled:   true,
		},
		{
			Key:       BlockGotoPreviousKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Mod-ArrowUp",
			Enabled:   true,
		},
		{
			Key:       BlockGotoNextKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Mod-ArrowDown",
			Enabled:   true,
		},
		{
			Key:       BlockSelectPreviousKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Mod-Shift-ArrowUp",
			Enabled:   true,
		},
		{
			Key:       BlockSelectNextKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Mod-Shift-ArrowDown",
			Enabled:   true,
		},
		{
			Key:       BlockDeleteKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Mod-Shift-d",
			Enabled:   true,
		},
		{
			Key:       BlockMoveUpKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Alt-Mod-ArrowUp",
			Enabled:   true,
		},
		{
			Key:       BlockMoveDownKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Alt-Mod-ArrowDown",
			Enabled:   true,
		},
		{
			Key:       BlockDeleteLineKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Mod-Shift-k",
			Enabled:   true,
		},
		{
			Key:       BlockMoveLineUpKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Alt-ArrowUp",
			Enabled:   true,
		},
		{
			Key:       BlockMoveLineDownKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Alt-ArrowDown",
			Enabled:   true,
		},
		{
			Key:       BlockTransposeCharsKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Ctrl-t",
			Enabled:   true,
		},
		{
			Key:       BlockFormatKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Mod-Shift-f",
			Enabled:   true,
		},
		{
			Key:       BlockCopyKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Mod-c",
			Enabled:   true,
		},
		{
			Key:       BlockCutKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Mod-x",
			Enabled:   true,
		},
		{
			Key:       BlockPasteKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Mod-v",
			Enabled:   true,
		},

		{
			Key:       FoldCodeKeyBindingKey,
			Extension: ExtensionFold,
			Command:   "Ctrl-Shift-[",
			Enabled:   true,
		},
		{
			Key:       UnfoldCodeKeyBindingKey,
			Extension: ExtensionFold,
			Command:   "Ctrl-Shift-]",
			Enabled:   true,
		},
		{
			Key:       FoldAllKeyBindingKey,
			Extension: ExtensionFold,
			Command:   "Ctrl-Alt-[",
			Enabled:   true,
		},
		{
			Key:       UnfoldAllKeyBindingKey,
			Extension: ExtensionFold,
			Command:   "Ctrl-Alt-]",
			Enabled:   true,
		},

		{
			Key:       HistoryUndoKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Mod-z",
			Enabled:   true,
		},
		{
			Key:       HistoryRedoKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Mod-Shift-z",
			Enabled:   true,
		},
		{
			Key:       HistoryUndoSelectionKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Mod-u",
			Enabled:   true,
		},
		{
			Key:       HistoryRedoSelectionKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Mod-Shift-u",
			Enabled:   true,
		},

		{
			Key:       CursorSyntaxLeftKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Alt-ArrowLeft",
			Enabled:   true,
		},
		{
			Key:       CursorSyntaxRightKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Alt-ArrowRight",
			Enabled:   true,
		},
		{
			Key:       SelectSyntaxLeftKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Shift-Alt-ArrowLeft",
			Enabled:   true,
		},
		{
			Key:       SelectSyntaxRightKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Shift-Alt-ArrowRight",
			Enabled:   true,
		},
		{
			Key:       CopyLineUpKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Shift-Alt-ArrowUp",
			Enabled:   true,
		},
		{
			Key:       CopyLineDownKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Shift-Alt-ArrowDown",
			Enabled:   true,
		},
		{
			Key:       InsertBlankLineKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Ctrl-Enter",
			Enabled:   true,
		},
		{
			Key:       SelectLineKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Alt-l",
			Enabled:   true,
		},
		{
			Key:       SelectParentSyntaxKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Ctrl-i",
			Enabled:   true,
		},
		{
			Key:       IndentLessKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Ctrl-[",
			Enabled:   true,
		},
		{
			Key:       IndentMoreKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Ctrl-]",
			Enabled:   true,
		},
		{
			Key:       IndentSelectionKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Ctrl-Alt-\\",
			Enabled:   true,
		},
		{
			Key:       CursorMatchingBracketKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Shift-Ctrl-\\",
			Enabled:   true,
		},
		{
			Key:       ToggleCommentKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Ctrl-/",
			Enabled:   true,
		},
		{
			Key:       ToggleBlockCommentKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Shift-Alt-a",
			Enabled:   true,
		},
		{
			Key:       InsertNewlineAndIndentKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Enter",
			Enabled:   true,
		},
		{
			Key:       DeleteCharBackwardKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Backspace",
			Enabled:   true,
		},
		{
			Key:       DeleteCharForwardKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Delete",
			Enabled:   true,
		},
		{
			Key:       DeleteGroupBackwardKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Ctrl-Backspace",
			Enabled:   true,
		},
		{
			Key:       DeleteGroupForwardKeyBindingKey,
			Extension: defaultExtension,
			Command:   "Ctrl-Delete",
			Enabled:   true,
		},
	}
}
