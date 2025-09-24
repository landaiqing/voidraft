/**
 * 编辑器上下文菜单实现
 * 提供基本的复制、剪切、粘贴等操作，支持动态快捷键显示
 */

import { EditorView } from "@codemirror/view";
import { Extension } from "@codemirror/state";
import { copyCommand, cutCommand, pasteCommand } from "../extensions/codeblock/copyPaste";
import { KeyBindingCommand } from "@/../bindings/voidraft/internal/models/models";
import { useKeybindingStore } from "@/stores/keybindingStore";
import { 
  undo, redo
} from "@codemirror/commands";
import { 
  deleteBlock, formatCurrentBlock, 
  addNewBlockAfterCurrent, addNewBlockAfterLast, addNewBlockBeforeCurrent
} from "../extensions/codeblock/commands";
import { commandRegistry } from "@/views/editor/keymap";
import i18n from "@/i18n";
import {useSystemStore} from "@/stores/systemStore";

/**
 * 菜单项类型定义
 */
export interface MenuItem {
  /** 菜单项显示文本 */
  label: string;
  
  /** 点击时执行的命令 (如果有子菜单，可以为null) */
  command?: (view: EditorView) => boolean;
  
  /** 快捷键提示文本 (可选) */
  shortcut?: string;
  
  /** 子菜单项 (可选) */
  submenu?: MenuItem[];
}

// 导入相关功能
import { showContextMenu } from "./contextMenuView";

/**
 * 获取翻译文本
 * @param key 翻译键
 * @returns 翻译后的文本
 */
function t(key: string): string {
  return i18n.global.t(key);
}

/**
 * 获取快捷键显示文本
 * @param command 命令ID
 * @returns 快捷键显示文本
 */
function getShortcutText(command: KeyBindingCommand): string {
  try {
    const keybindingStore = useKeybindingStore();
    
    // 如果找到该命令的快捷键配置
    const binding = keybindingStore.keyBindings.find(kb => 
      kb.command === command && kb.enabled
    );
    
    if (binding && binding.key) {
      // 格式化快捷键显示
      return formatKeyBinding(binding.key);
    }
  } catch (error) {
    console.warn("An error occurred while getting the shortcut:", error);
  }
  
  return "";
}

/**
 * 格式化快捷键显示
 * @param keyBinding 快捷键字符串
 * @returns 格式化后的显示文本
 */
function formatKeyBinding(keyBinding: string): string {
  // 获取系统信息
  const systemStore = useSystemStore();
  const isMac = systemStore.isMacOS;
  
  // 替换修饰键名称为更友好的显示
  return keyBinding
    .replace("Mod", isMac ? "⌘" : "Ctrl")
    .replace("Shift", isMac ? "⇧" : "Shift")
    .replace("Alt", isMac ? "⌥" : "Alt")
    .replace("Ctrl", isMac ? "⌃" : "Ctrl")
    .replace(/-/g, " + ");
}


/**
 * 创建编辑菜单项
 */
function createEditItems(): MenuItem[] {
  return [
    {
      label: t("keybindings.commands.blockCopy"),
      command: copyCommand,
      shortcut: getShortcutText(KeyBindingCommand.BlockCopyCommand)
    },
    {
      label: t("keybindings.commands.blockCut"),
      command: cutCommand,
      shortcut: getShortcutText(KeyBindingCommand.BlockCutCommand)
    },
    {
      label: t("keybindings.commands.blockPaste"),
      command: pasteCommand,
      shortcut: getShortcutText(KeyBindingCommand.BlockPasteCommand)
    }
  ];
}

/**
 * 创建历史操作菜单项
 */
function createHistoryItems(): MenuItem[] {
  return [
    {
      label: t("keybindings.commands.historyUndo"),
      command: undo,
      shortcut: getShortcutText(KeyBindingCommand.HistoryUndoCommand)
    },
    {
      label: t("keybindings.commands.historyRedo"),
      command: redo,
      shortcut: getShortcutText(KeyBindingCommand.HistoryRedoCommand)
    }
  ];
}

/**
 * 创建代码块相关菜单项
 */
function createCodeBlockItems(): MenuItem[] {
  const defaultOptions = { defaultBlockToken: 'text', defaultBlockAutoDetect: true };
  return [
    // 格式化
    {
      label: t("keybindings.commands.blockFormat"),
      command: formatCurrentBlock,
      shortcut: getShortcutText(KeyBindingCommand.BlockFormatCommand)
    },
    // 删除
    {
      label: t("keybindings.commands.blockDelete"),
      command: deleteBlock(defaultOptions),
      shortcut: getShortcutText(KeyBindingCommand.BlockDeleteCommand)
    },
    // 在当前块后添加新块
    {
      label: t("keybindings.commands.blockAddAfterCurrent"),
      command: addNewBlockAfterCurrent(defaultOptions),
      shortcut: getShortcutText(KeyBindingCommand.BlockAddAfterCurrentCommand)
    },
    // 在当前块前添加新块
    {
      label: t("keybindings.commands.blockAddBeforeCurrent"),
      command: addNewBlockBeforeCurrent(defaultOptions),
      shortcut: getShortcutText(KeyBindingCommand.BlockAddBeforeCurrentCommand)
    },
    // 在最后添加新块
    {
      label: t("keybindings.commands.blockAddAfterLast"),
      command: addNewBlockAfterLast(defaultOptions),
      shortcut: getShortcutText(KeyBindingCommand.BlockAddAfterLastCommand)
    }
  ];
}

/**
 * 创建主菜单项
 */
function createMainMenuItems(): MenuItem[] {
  // 基本编辑操作放在主菜单
  const basicItems = createEditItems();
  
  // 历史操作放在主菜单
  const historyItems = createHistoryItems();
  
  // 构建主菜单
  return [
    ...basicItems,
    ...historyItems,
    {
      label: t("extensions.codeblock.name"),
      submenu: createCodeBlockItems()
    }
  ];
}

/**
 * 创建编辑器上下文菜单
 */
export function createEditorContextMenu(): Extension {
  // 为编辑器添加右键事件处理
  return EditorView.domEventHandlers({
    contextmenu: (event, view) => {
      // 阻止默认右键菜单
      event.preventDefault();
      
      // 获取菜单项
      const menuItems = createMainMenuItems();
      
      // 显示上下文菜单
      showContextMenu(view, event.clientX, event.clientY, menuItems);
      
      return true;
    }
  });
}

/**
 * 默认导出
 */
export default createEditorContextMenu; 