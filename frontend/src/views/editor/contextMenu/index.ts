import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { copyCommand, cutCommand, pasteCommand } from '../extensions/codeblock/copyPaste';
import { KeyBindingCommand } from '@/../bindings/voidraft/internal/models/models';
import { useKeybindingStore } from '@/stores/keybindingStore';
import { undo, redo } from '@codemirror/commands';
import i18n from '@/i18n';
import { useSystemStore } from '@/stores/systemStore';
import { showContextMenu } from './manager';
import {
  buildRegisteredMenu,
  createMenuContext,
  registerMenuNodes
} from './menuSchema';
import type { MenuSchemaNode } from './menuSchema';


function t(key: string): string {
  return i18n.global.t(key);
}


function formatKeyBinding(keyBinding: string): string {
  const systemStore = useSystemStore();
  const isMac = systemStore.isMacOS;

  return keyBinding
    .replace("Mod", isMac ? "Cmd" : "Ctrl")
    .replace("Shift", "Shift")
    .replace("Alt", isMac ? "Option" : "Alt")
    .replace("Ctrl", isMac ? "Ctrl" : "Ctrl")
    .replace(/-/g, " + ");
}

const shortcutCache = new Map<KeyBindingCommand, string>();


function getShortcutText(command?: KeyBindingCommand): string {
  if (command === undefined) {
    return "";
  }

  const cached = shortcutCache.get(command);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const keybindingStore = useKeybindingStore();
    const binding = keybindingStore.keyBindings.find(
      (kb) => kb.command === command && kb.enabled
    );

    if (binding?.key) {
      const formatted = formatKeyBinding(binding.key);
      shortcutCache.set(command, formatted);
      return formatted;
    }
  } catch (error) {
    console.warn("An error occurred while getting the shortcut:", error);
  }

  shortcutCache.set(command, "");
  return "";
}


function getBuiltinMenuNodes(): MenuSchemaNode[] {
  return [
    {
      id: "copy",
      labelKey: "keybindings.commands.blockCopy",
      command: copyCommand,
      shortcutCommand: KeyBindingCommand.BlockCopyCommand,
      enabled: (context) => context.hasSelection
    },
    {
      id: "cut",
      labelKey: "keybindings.commands.blockCut",
      command: cutCommand,
      shortcutCommand: KeyBindingCommand.BlockCutCommand,
      visible: (context) => context.isEditable,
      enabled: (context) => context.hasSelection && context.isEditable
    },
    {
      id: "paste",
      labelKey: "keybindings.commands.blockPaste",
      command: pasteCommand,
      shortcutCommand: KeyBindingCommand.BlockPasteCommand,
      visible: (context) => context.isEditable
    },
    {
      id: "undo",
      labelKey: "keybindings.commands.historyUndo",
      command: undo,
      shortcutCommand: KeyBindingCommand.HistoryUndoCommand,
      visible: (context) => context.isEditable
    },
    {
      id: "redo",
      labelKey: "keybindings.commands.historyRedo",
      command: redo,
      shortcutCommand: KeyBindingCommand.HistoryRedoCommand,
      visible: (context) => context.isEditable
    }
  ];
}

let builtinMenuRegistered = false;

function ensureBuiltinMenuRegistered(): void {
  if (builtinMenuRegistered) return;
  registerMenuNodes(getBuiltinMenuNodes());
  builtinMenuRegistered = true;
}


export function createEditorContextMenu(): Extension {
  ensureBuiltinMenuRegistered();

  return EditorView.domEventHandlers({
    contextmenu: (event, view) => {
      event.preventDefault();

      const context = createMenuContext(view, event as MouseEvent);
      const menuItems = buildRegisteredMenu(context, {
        translate: t,
        formatShortcut: getShortcutText
      });

      if (menuItems.length === 0) {
        return false;
      }

      showContextMenu(view, event.clientX, event.clientY, menuItems);
      return true;
    }
  });
}

export default createEditorContextMenu;
