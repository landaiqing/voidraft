package models

// KeyBindingName 快捷键命令标识符
type KeyBindingName string

type KeyBindingType string

const (
	Standard KeyBindingType = "standard" // standard 标准快捷键
	Emacs    KeyBindingType = "emacs"    // emacs 快捷键
)

// KeyBinding 单个快捷键绑定
type KeyBinding struct {
	Name           KeyBindingName `json:"name"`            // 命令唯一标识符
	Type           KeyBindingType `json:"type"`            // 快捷键类型（standard 或 "emacs"）
	Key            string         `json:"key,omitempty"`   // 通用快捷键（跨平台）
	Macos          string         `json:"macos,omitempty"` // macOS 专用快捷键
	Windows        string         `json:"win,omitempty"`   // windows 专用快捷键
	Linux          string         `json:"linux,omitempty"` // Linux 专用快捷键
	Extension      ExtensionName  `json:"extension"`       // 所属扩展
	Enabled        bool           `json:"enabled"`         // 是否启用
	PreventDefault bool           `json:"preventDefault"`  // 阻止浏览器默认行为
	Scope          string         `json:"scope,omitempty"` // 作用域（默认 "editor"）
}

const (
	ShowSearch             KeyBindingName = "showSearch"             // 显示搜索
	HideSearch             KeyBindingName = "hideSearch"             // 隐藏搜索
	BlockSelectAll         KeyBindingName = "blockSelectAll"         // 块内选择全部
	BlockAddAfterCurrent   KeyBindingName = "blockAddAfterCurrent"   // 在当前块后添加新块
	BlockAddAfterLast      KeyBindingName = "blockAddAfterLast"      // 在最后添加新块
	BlockAddBeforeCurrent  KeyBindingName = "blockAddBeforeCurrent"  // 在当前块前添加新块
	BlockGotoPrevious      KeyBindingName = "blockGotoPrevious"      // 跳转到上一个块
	BlockGotoNext          KeyBindingName = "blockGotoNext"          // 跳转到下一个块
	BlockSelectPrevious    KeyBindingName = "blockSelectPrevious"    // 选择上一个块
	BlockSelectNext        KeyBindingName = "blockSelectNext"        // 选择下一个块
	BlockDelete            KeyBindingName = "blockDelete"            // 删除当前块
	BlockMoveUp            KeyBindingName = "blockMoveUp"            // 向上移动当前块
	BlockMoveDown          KeyBindingName = "blockMoveDown"          // 向下移动当前块
	BlockDeleteLine        KeyBindingName = "blockDeleteLine"        // 删除行
	BlockMoveLineUp        KeyBindingName = "blockMoveLineUp"        // 向上移动行
	BlockMoveLineDown      KeyBindingName = "blockMoveLineDown"      // 向下移动行
	BlockTransposeChars    KeyBindingName = "blockTransposeChars"    // 字符转置
	BlockFormat            KeyBindingName = "blockFormat"            // 格式化代码块
	BlockCopy              KeyBindingName = "blockCopy"              // 复制
	BlockCut               KeyBindingName = "blockCut"               // 剪切
	BlockPaste             KeyBindingName = "blockPaste"             // 粘贴
	FoldCode               KeyBindingName = "foldCode"               // 折叠代码
	UnfoldCode             KeyBindingName = "unfoldCode"             // 展开代码
	FoldAll                KeyBindingName = "foldAll"                // 折叠全部
	UnfoldAll              KeyBindingName = "unfoldAll"              // 展开全部
	CursorSyntaxLeft       KeyBindingName = "cursorSyntaxLeft"       // 光标按语法左移
	CursorSyntaxRight      KeyBindingName = "cursorSyntaxRight"      // 光标按语法右移
	SelectSyntaxLeft       KeyBindingName = "selectSyntaxLeft"       // 按语法选择左侧
	SelectSyntaxRight      KeyBindingName = "selectSyntaxRight"      // 按语法选择右侧
	CopyLineUp             KeyBindingName = "copyLineUp"             // 向上复制行
	CopyLineDown           KeyBindingName = "copyLineDown"           // 向下复制行
	InsertBlankLine        KeyBindingName = "insertBlankLine"        // 插入空行
	SelectLine             KeyBindingName = "selectLine"             // 选择行
	SelectParentSyntax     KeyBindingName = "selectParentSyntax"     // 选择父级语法
	SimplifySelection      KeyBindingName = "simplifySelection"      // 简化选择
	AddCursorAbove         KeyBindingName = "addCursorAbove"         // 在上方添加光标
	AddCursorBelow         KeyBindingName = "addCursorBelow"         // 在下方添加光标
	CursorGroupLeft        KeyBindingName = "cursorGroupLeft"        // 光标按单词左移
	CursorGroupRight       KeyBindingName = "cursorGroupRight"       // 光标按单词右移
	SelectGroupLeft        KeyBindingName = "selectGroupLeft"        // 按单词选择左侧
	SelectGroupRight       KeyBindingName = "selectGroupRight"       // 按单词选择右侧
	DeleteToLineEnd        KeyBindingName = "deleteToLineEnd"        // 删除到行尾
	DeleteToLineStart      KeyBindingName = "deleteToLineStart"      // 删除到行首
	CursorLineStart        KeyBindingName = "cursorLineStart"        // 移动到行首
	CursorLineEnd          KeyBindingName = "cursorLineEnd"          // 移动到行尾
	SelectLineStart        KeyBindingName = "selectLineStart"        // 选择到行首
	SelectLineEnd          KeyBindingName = "selectLineEnd"          // 选择到行尾
	CursorDocStart         KeyBindingName = "cursorDocStart"         // 跳转到文档开头
	CursorDocEnd           KeyBindingName = "cursorDocEnd"           // 跳转到文档结尾
	SelectDocStart         KeyBindingName = "selectDocStart"         // 选择到文档开头
	SelectDocEnd           KeyBindingName = "selectDocEnd"           // 选择到文档结尾
	SelectMatchingBracket  KeyBindingName = "selectMatchingBracket"  // 选择到匹配括号
	SplitLine              KeyBindingName = "splitLine"              // 分割行
	CursorCharLeft         KeyBindingName = "cursorCharLeft"         // 光标左移一个字符
	CursorCharRight        KeyBindingName = "cursorCharRight"        // 光标右移一个字符
	CursorLineUp           KeyBindingName = "cursorLineUp"           // 光标上移一行
	CursorLineDown         KeyBindingName = "cursorLineDown"         // 光标下移一行
	CursorPageUp           KeyBindingName = "cursorPageUp"           // 向上翻页
	CursorPageDown         KeyBindingName = "cursorPageDown"         // 向下翻页
	SelectCharLeft         KeyBindingName = "selectCharLeft"         // 选择左移一个字符
	SelectCharRight        KeyBindingName = "selectCharRight"        // 选择右移一个字符
	SelectLineUp           KeyBindingName = "selectLineUp"           // 选择上移一行
	SelectLineDown         KeyBindingName = "selectLineDown"         // 选择下移一行
	IndentLess             KeyBindingName = "indentLess"             // 减少缩进
	IndentMore             KeyBindingName = "indentMore"             // 增加缩进
	IndentSelection        KeyBindingName = "indentSelection"        // 缩进选择
	CursorMatchingBracket  KeyBindingName = "cursorMatchingBracket"  // 光标到匹配括号
	ToggleComment          KeyBindingName = "toggleComment"          // 切换注释
	ToggleBlockComment     KeyBindingName = "toggleBlockComment"     // 切换块注释
	InsertNewlineAndIndent KeyBindingName = "insertNewlineAndIndent" // 插入新行并缩进
	DeleteCharBackward     KeyBindingName = "deleteCharBackward"     // 向后删除字符
	DeleteCharForward      KeyBindingName = "deleteCharForward"      // 向前删除字符
	DeleteGroupBackward    KeyBindingName = "deleteGroupBackward"    // 向后删除组
	DeleteGroupForward     KeyBindingName = "deleteGroupForward"     // 向前删除组
	HistoryUndo            KeyBindingName = "historyUndo"            // 撤销
	HistoryRedo            KeyBindingName = "historyRedo"            // 重做
	HistoryUndoSelection   KeyBindingName = "historyUndoSelection"   // 撤销选择
	HistoryRedoSelection   KeyBindingName = "historyRedoSelection"   // 重做选择
)

const defaultExtension = "editor"

// NewDefaultKeyBindings 创建默认快捷键配置
func NewDefaultKeyBindings() []KeyBinding {
	// 标准模式快捷键
	standardBindings := []KeyBinding{
		// 搜索相关
		{
			Name:           ShowSearch,
			Type:           Standard,
			Key:            "Mod-f",
			Extension:      Search,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           HideSearch,
			Type:           Standard,
			Key:            "Escape",
			Extension:      Search,
			Enabled:        true,
			PreventDefault: false,
		},

		// 块操作相关
		{
			Name:           BlockSelectAll,
			Type:           Standard,
			Key:            "Mod-a",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           BlockAddAfterCurrent,
			Type:           Standard,
			Key:            "Mod-Enter",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           BlockAddAfterLast,
			Type:           Standard,
			Key:            "Mod-Shift-Enter",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           BlockAddBeforeCurrent,
			Type:           Standard,
			Key:            "Alt-Enter",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           BlockGotoPrevious,
			Type:           Standard,
			Key:            "Mod-ArrowUp",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           BlockGotoNext,
			Type:           Standard,
			Key:            "Mod-ArrowDown",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           BlockSelectPrevious,
			Type:           Standard,
			Key:            "Mod-Shift-ArrowUp",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           BlockSelectNext,
			Type:           Standard,
			Key:            "Mod-Shift-ArrowDown",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           BlockDelete,
			Type:           Standard,
			Key:            "Mod-Shift-d",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           BlockMoveUp,
			Type:           Standard,
			Key:            "Shift-Mod-ArrowUp",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           BlockMoveDown,
			Type:           Standard,
			Key:            "Shift-Mod-ArrowDown",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           BlockDeleteLine,
			Type:           Standard,
			Key:            "Mod-Shift-k",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           BlockMoveLineUp,
			Type:           Standard,
			Key:            "Alt-ArrowUp",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           BlockMoveLineDown,
			Type:           Standard,
			Key:            "Alt-ArrowDown",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           BlockTransposeChars,
			Type:           Standard,
			Key:            "Mod-t",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           BlockFormat,
			Type:           Standard,
			Key:            "Mod-Shift-f",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           BlockCopy,
			Type:           Standard,
			Key:            "Mod-c",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           BlockCut,
			Type:           Standard,
			Key:            "Mod-x",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           BlockPaste,
			Type:           Standard,
			Key:            "Mod-v",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},

		// 代码折叠相关
		{
			Name:           FoldCode,
			Type:           Standard,
			Macos:          "Cmd-Alt-[",
			Windows:        "Ctrl-Shift-[",
			Linux:          "Ctrl-Shift-[",
			Extension:      Fold,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           UnfoldCode,
			Type:           Standard,
			Macos:          "Cmd-Alt-]",
			Windows:        "Ctrl-Shift-]",
			Linux:          "Ctrl-Shift-]",
			Extension:      Fold,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           FoldAll,
			Type:           Standard,
			Key:            "Ctrl-Alt-[",
			Extension:      Fold,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           UnfoldAll,
			Type:           Standard,
			Key:            "Ctrl-Alt-]",
			Extension:      Fold,
			Enabled:        true,
			PreventDefault: true,
		},

		// 历史记录相关
		{
			Name:           HistoryUndo,
			Type:           Standard,
			Key:            "Mod-z",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           HistoryRedo,
			Type:           Standard,
			Key:            "Mod-Shift-z",
			Windows:        "Ctrl-y",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           HistoryUndoSelection,
			Type:           Standard,
			Key:            "Mod-u",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           HistoryRedoSelection,
			Type:           Standard,
			Key:            "Mod-Shift-u",
			Windows:        "Alt-u",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},

		// 光标和选择相关
		{
			Name:           CursorSyntaxLeft,
			Type:           Standard,
			Macos:          "Ctrl-ArrowLeft",
			Windows:        "Alt-ArrowLeft",
			Linux:          "Alt-ArrowLeft",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           CursorSyntaxRight,
			Type:           Standard,
			Macos:          "Ctrl-ArrowRight",
			Windows:        "Alt-ArrowRight",
			Linux:          "Alt-ArrowRight",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           SelectSyntaxLeft,
			Type:           Standard,
			Key:            "Shift-Alt-ArrowLeft",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           SelectSyntaxRight,
			Type:           Standard,
			Key:            "Shift-Alt-ArrowRight",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           CopyLineUp,
			Type:           Standard,
			Key:            "Shift-Alt-ArrowUp",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           CopyLineDown,
			Type:           Standard,
			Key:            "Shift-Alt-ArrowDown",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           InsertBlankLine,
			Type:           Standard,
			Key:            "Mod-Enter",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           SelectLine,
			Type:           Standard,
			Macos:          "Ctrl-l",
			Windows:        "Alt-l",
			Linux:          "Alt-l",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           SelectParentSyntax,
			Type:           Standard,
			Key:            "Mod-i",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           SimplifySelection,
			Type:           Standard,
			Key:            "Escape",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: false,
		},
		{
			Name:           AddCursorAbove,
			Type:           Standard,
			Macos:          "Cmd-Alt-ArrowUp",
			Windows:        "Ctrl-Alt-ArrowUp",
			Linux:          "Ctrl-Alt-ArrowUp",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           AddCursorBelow,
			Type:           Standard,
			Macos:          "Cmd-Alt-ArrowDown",
			Windows:        "Ctrl-Alt-ArrowDown",
			Linux:          "Ctrl-Alt-ArrowDown",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           CursorGroupLeft,
			Type:           Standard,
			Windows:        "Ctrl-ArrowLeft",
			Linux:          "Ctrl-ArrowLeft",
			Macos:          "Alt-ArrowLeft",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           CursorGroupRight,
			Type:           Standard,
			Windows:        "Ctrl-ArrowRight",
			Linux:          "Ctrl-ArrowRight",
			Macos:          "Alt-ArrowRight",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           SelectGroupLeft,
			Type:           Standard,
			Windows:        "Ctrl-Shift-ArrowLeft",
			Linux:          "Ctrl-Shift-ArrowLeft",
			Macos:          "Alt-Shift-ArrowLeft",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           SelectGroupRight,
			Type:           Standard,
			Windows:        "Ctrl-Shift-ArrowRight",
			Linux:          "Ctrl-Shift-ArrowRight",
			Macos:          "Alt-Shift-ArrowRight",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           DeleteToLineEnd,
			Type:           Standard,
			Macos:          "Ctrl-k",
			Windows:        "Ctrl-k",
			Linux:          "Ctrl-k",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           DeleteToLineStart,
			Type:           Standard,
			Key:            "Mod-Shift-Backspace",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           CursorLineStart,
			Type:           Standard,
			Key:            "Home",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: false,
		},
		{
			Name:           CursorLineEnd,
			Type:           Standard,
			Key:            "End",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: false,
		},
		{
			Name:           SelectLineStart,
			Type:           Standard,
			Key:            "Shift-Home",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: false,
		},
		{
			Name:           SelectLineEnd,
			Type:           Standard,
			Key:            "Shift-End",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: false,
		},
		{
			Name:           CursorDocStart,
			Type:           Standard,
			Key:            "Mod-Home",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           CursorDocEnd,
			Type:           Standard,
			Key:            "Mod-End",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           SelectDocStart,
			Type:           Standard,
			Key:            "Mod-Shift-Home",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           SelectDocEnd,
			Type:           Standard,
			Key:            "Mod-Shift-End",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           SelectMatchingBracket,
			Type:           Standard,
			Key:            "Mod-Shift-p",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           SplitLine,
			Type:           Standard,
			Macos:          "Ctrl-o",
			Windows:        "Ctrl-o",
			Linux:          "Ctrl-o",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		// 缩进和格式化相关
		{
			Name:           IndentLess,
			Type:           Standard,
			Key:            "Mod-[",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           IndentMore,
			Type:           Standard,
			Key:            "Mod-]",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           IndentSelection,
			Type:           Standard,
			Key:            "Mod-Alt-\\",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           CursorMatchingBracket,
			Type:           Standard,
			Key:            "Shift-Mod-\\",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           ToggleComment,
			Type:           Standard,
			Key:            "Mod-/",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           ToggleBlockComment,
			Type:           Standard,
			Key:            "Shift-Alt-a",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		// 基础编辑相关
		{
			Name:           InsertNewlineAndIndent,
			Type:           Standard,
			Key:            "Enter",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: false,
		},
		{
			Name:           DeleteCharBackward,
			Type:           Standard,
			Key:            "Backspace",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: false,
		},
		{
			Name:           DeleteCharForward,
			Type:           Standard,
			Key:            "Delete",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: false,
		},
		{
			Name:           DeleteGroupBackward,
			Type:           Standard,
			Key:            "Mod-Backspace",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           DeleteGroupForward,
			Type:           Standard,
			Key:            "Mod-Delete",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
	}

	// Emacs 模式特有快捷键（只包含与 standard 不同的）
	emacsBindings := []KeyBinding{
		// Emacs 核心导航 - 字符移动
		{
			Name:           CursorCharLeft,
			Type:           Emacs,
			Key:            "Ctrl-b",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           SelectCharLeft,
			Type:           Emacs,
			Key:            "Shift-Ctrl-b",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           CursorCharRight,
			Type:           Emacs,
			Key:            "Ctrl-f",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           SelectCharRight,
			Type:           Emacs,
			Key:            "Shift-Ctrl-f",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},

		// Emacs 行移动
		{
			Name:           CursorLineUp,
			Type:           Emacs,
			Key:            "Ctrl-p",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           SelectLineUp,
			Type:           Emacs,
			Key:            "Shift-Ctrl-p",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           CursorLineDown,
			Type:           Emacs,
			Key:            "Ctrl-n",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           SelectLineDown,
			Type:           Emacs,
			Key:            "Shift-Ctrl-n",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},

		// Emacs 行首/尾（与 standard 的 Home/End 不同）
		{
			Name:           CursorLineStart,
			Type:           Emacs,
			Key:            "Ctrl-a",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           SelectLineStart,
			Type:           Emacs,
			Key:            "Shift-Ctrl-a",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           CursorLineEnd,
			Type:           Emacs,
			Key:            "Ctrl-e",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           SelectLineEnd,
			Type:           Emacs,
			Key:            "Shift-Ctrl-e",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},

		// Emacs 翻页（与 standard 不同）
		{
			Name:           CursorPageDown,
			Type:           Emacs,
			Key:            "Ctrl-v",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           CursorPageUp,
			Type:           Emacs,
			Key:            "Alt-v",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},

		// Emacs 编辑命令（与 standard 不同）
		{
			Name:           DeleteCharForward,
			Type:           Emacs,
			Key:            "Ctrl-d",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           DeleteCharBackward,
			Type:           Emacs,
			Key:            "Ctrl-h",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           DeleteToLineEnd,
			Type:           Emacs,
			Key:            "Ctrl-k",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           DeleteGroupBackward,
			Type:           Emacs,
			Key:            "Ctrl-Alt-h",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           SplitLine,
			Type:           Emacs,
			Key:            "Ctrl-o",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           BlockTransposeChars,
			Type:           Emacs,
			Key:            "Ctrl-t",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},

		// Emacs 模式下冲突快捷键的调整
		{
			Name:           BlockSelectAll,
			Type:           Emacs,
			Key:            "Mod-Shift-a",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
		{
			Name:           BlockPaste,
			Type:           Emacs,
			Key:            "Mod-Shift-v",
			Extension:      defaultExtension,
			Enabled:        true,
			PreventDefault: true,
		},
	}
	return append(standardBindings, emacsBindings...)
}
