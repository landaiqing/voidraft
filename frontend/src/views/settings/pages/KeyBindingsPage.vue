<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { onMounted, computed } from 'vue';
import SettingSection from '../components/SettingSection.vue';
import { useKeybindingStore } from '@/stores/keybindingStore';
import { useExtensionStore } from '@/stores/extensionStore';
import { useSystemStore } from '@/stores/systemStore';
import { getCommandDescription } from '@/views/editor/keymap/commands';
import {KeyBindingCommand} from "@/../bindings/voidraft/internal/models";

const { t } = useI18n();
const keybindingStore = useKeybindingStore();
const extensionStore = useExtensionStore();
const systemStore = useSystemStore();

// 加载数据
onMounted(async () => {
  await keybindingStore.loadKeyBindings();
  await extensionStore.loadExtensions();
});

// 从store中获取快捷键数据并转换为显示格式
const keyBindings = computed(() => {
  // 只显示启用扩展的快捷键
  const enabledExtensionIds = new Set(extensionStore.enabledExtensionIds);
  
  return keybindingStore.keyBindings
    .filter(kb => kb.enabled && enabledExtensionIds.has(kb.extension))
    .map(kb => ({
      id: kb.command,
      keys: parseKeyBinding(kb.key, kb.command),
      category: kb.extension,
      description: getCommandDescription(kb.command) || kb.command
    }));
});

// 解析快捷键字符串为显示数组
const parseKeyBinding = (keyStr: string, command?: string): string[] => {
  if (!keyStr) return [];
  
  // 特殊处理重做快捷键的操作系统差异
  if (command === KeyBindingCommand.HistoryRedoCommand && keyStr === 'Mod-Shift-z') {
    if (systemStore.isMacOS) {
      return ['⌘', '⇧', 'Z']; // macOS: Cmd+Shift+Z
    } else {
      return ['Ctrl', 'Y']; // Windows/Linux: Ctrl+Y
    }
  }
  
  // 特殊处理重做选择快捷键的操作系统差异
  if (command === KeyBindingCommand.HistoryRedoSelectionCommand && keyStr === 'Mod-Shift-u') {
    if (systemStore.isMacOS) {
      return ['⌘', '⇧', 'U']; // macOS: Cmd+Shift+U
    } else {
      return ['Alt', 'U']; // Windows/Linux: Alt+U
    }
  }
  
  // 特殊处理代码折叠快捷键的操作系统差异
  if (command === KeyBindingCommand.FoldCodeCommand && keyStr === 'Ctrl-Shift-[') {
    if (systemStore.isMacOS) {
      return ['⌘', '⌥', '[']; // macOS: Cmd+Alt+[
    } else {
      return ['Ctrl', 'Shift', '[']; // Windows/Linux: Ctrl+Shift+[
    }
  }
  
  if (command === KeyBindingCommand.UnfoldCodeCommand && keyStr === 'Ctrl-Shift-]') {
    if (systemStore.isMacOS) {
      return ['⌘', '⌥', ']']; // macOS: Cmd+Alt+]
    } else {
      return ['Ctrl', 'Shift', ']']; // Windows/Linux: Ctrl+Shift+]
    }
  }
  
  // 特殊处理编辑快捷键的操作系统差异
  if (command === KeyBindingCommand.CursorSyntaxLeftCommand && keyStr === 'Alt-ArrowLeft') {
    if (systemStore.isMacOS) {
      return ['Ctrl', '←']; // macOS: Ctrl+ArrowLeft
    } else {
      return ['Alt', '←']; // Windows/Linux: Alt+ArrowLeft
    }
  }
  
  if (command === KeyBindingCommand.CursorSyntaxRightCommand && keyStr === 'Alt-ArrowRight') {
    if (systemStore.isMacOS) {
      return ['Ctrl', '→']; // macOS: Ctrl+ArrowRight
    } else {
      return ['Alt', '→']; // Windows/Linux: Alt+ArrowRight
    }
  }
  
  if (command === KeyBindingCommand.InsertBlankLineCommand && keyStr === 'Ctrl-Enter') {
    if (systemStore.isMacOS) {
      return ['⌘', 'Enter']; // macOS: Cmd+Enter
    } else {
      return ['Ctrl', 'Enter']; // Windows/Linux: Ctrl+Enter
    }
  }
  
  if (command === KeyBindingCommand.SelectLineCommand && keyStr === 'Alt-l') {
    if (systemStore.isMacOS) {
      return ['Ctrl', 'L']; // macOS: Ctrl+l
    } else {
      return ['Alt', 'L']; // Windows/Linux: Alt+l
    }
  }
  
  if (command === KeyBindingCommand.SelectParentSyntaxCommand && keyStr === 'Ctrl-i') {
    if (systemStore.isMacOS) {
      return ['⌘', 'I']; // macOS: Cmd+i
    } else {
      return ['Ctrl', 'I']; // Windows/Linux: Ctrl+i
    }
  }
  
  if (command === KeyBindingCommand.IndentLessCommand && keyStr === 'Ctrl-[') {
    if (systemStore.isMacOS) {
      return ['⌘', '[']; // macOS: Cmd+[
    } else {
      return ['Ctrl', '[']; // Windows/Linux: Ctrl+[
    }
  }
  
  if (command === KeyBindingCommand.IndentMoreCommand && keyStr === 'Ctrl-]') {
    if (systemStore.isMacOS) {
      return ['⌘', ']']; // macOS: Cmd+]
    } else {
      return ['Ctrl', ']']; // Windows/Linux: Ctrl+]
    }
  }
  
  if (command === KeyBindingCommand.IndentSelectionCommand && keyStr === 'Ctrl-Alt-\\') {
    if (systemStore.isMacOS) {
      return ['⌘', '⌥', '\\']; // macOS: Cmd+Alt+\
    } else {
      return ['Ctrl', 'Alt', '\\']; // Windows/Linux: Ctrl+Alt+\
    }
  }
  
  if (command === KeyBindingCommand.CursorMatchingBracketCommand && keyStr === 'Shift-Ctrl-\\') {
    if (systemStore.isMacOS) {
      return ['⇧', '⌘', '\\']; // macOS: Shift+Cmd+\
    } else {
      return ['Shift', 'Ctrl', '\\']; // Windows/Linux: Shift+Ctrl+\
    }
  }
  
  if (command === KeyBindingCommand.ToggleCommentCommand && keyStr === 'Ctrl-/') {
    if (systemStore.isMacOS) {
      return ['⌘', '/']; // macOS: Cmd+/
    } else {
      return ['Ctrl', '/']; // Windows/Linux: Ctrl+/
    }
  }
  
  // 特殊处理删除快捷键的操作系统差异
  if (command === KeyBindingCommand.DeleteGroupBackwardCommand && keyStr === 'Ctrl-Backspace') {
    if (systemStore.isMacOS) {
      return ['⌘', 'Backspace']; // macOS: Cmd+Backspace
    } else {
      return ['Ctrl', 'Backspace']; // Windows/Linux: Ctrl+Backspace
    }
  }
  
  if (command === KeyBindingCommand.DeleteGroupForwardCommand && keyStr === 'Ctrl-Delete') {
    if (systemStore.isMacOS) {
      return ['⌘', 'Delete']; // macOS: Cmd+Delete
    } else {
      return ['Ctrl', 'Delete']; // Windows/Linux: Ctrl+Delete
    }
  }
  
  // 处理常见的快捷键格式
  const parts = keyStr.split(/[-+]/);
  return parts.map(part => {
    // 根据操作系统将 Mod 替换为相应的键
    if (part === 'Mod') {
      if (systemStore.isMacOS) {
        return '⌘'; // macOS 使用 Command 键符号
      } else {
        return 'Ctrl'; // Windows/Linux 使用 Ctrl
      }
    }
    
    // 处理其他键名的操作系统差异
    if (part === 'Alt' && systemStore.isMacOS) {
      return '⌥'; // macOS 使用 Option 键符号
    }
    
    if (part === 'Shift') {
      return systemStore.isMacOS ? '⇧' : 'Shift'; // macOS 使用符号
    }
    
    // 首字母大写
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  }).filter(part => part.length > 0);
};
</script>

<template>
  <div class="settings-page">
    <SettingSection :title="t('settings.keyBindings')">
      <div class="key-bindings-container">
        <div class="key-bindings-header">
          <div class="keybinding-col">{{ t('keybindings.headers.shortcut') }}</div>
          <div class="category-col">{{ t('keybindings.headers.category') }}</div>
          <div class="description-col">{{ t('keybindings.headers.description') }}</div>
        </div>
        
        <div
          v-for="binding in keyBindings"
          :key="binding.id"
          class="key-binding-row"
        >
          <div class="keybinding-col">
            <span 
              v-for="(key, index) in binding.keys" 
              :key="index"
              class="key-badge"
            >
              {{ key }}
            </span>
          </div>
          <div class="category-col">{{ binding.category }}</div>
          <div class="description-col">{{ binding.description }}</div>
        </div>
      </div>
    </SettingSection>
  </div>
</template>

<style scoped lang="scss">
.settings-page {
  //max-width: 800px;
}

.key-bindings-container {
  padding: 10px 16px;
  
  .key-bindings-header {
    display: flex;
    padding: 0 0 10px 0;
    border-bottom: 1px solid var(--settings-border);
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 500;
  }
  
  .key-binding-row {
    display: flex;
    padding: 14px 0;
    border-bottom: 1px solid var(--settings-border);
    align-items: center;
    transition: background-color 0.2s ease;
    
    &:hover {
      background-color: var(--settings-hover);
    }
  }
  
  .keybinding-col {
    width: 150px;
    display: flex;
    gap: 5px;
    padding: 0 10px 0 0;
    color: var(--settings-text);
    
    .key-badge {
      background-color: var(--settings-input-bg);
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
      border: 1px solid var(--settings-input-border);
      color: var(--settings-text);
    }
  }
  
  .category-col {
    width: 80px;
    padding: 0 10px 0 0;
    font-size: 13px;
    color: var(--settings-text);
    text-transform: capitalize;
  }
  
  .description-col {
    flex: 1;
    font-size: 13px;
    color: var(--settings-text);
  }
}

.coming-soon-placeholder {
  padding: 20px;
  background-color: var(--settings-card-bg);
  border-radius: 6px;
  color: var(--text-muted);
  text-align: center;
  font-style: italic;
  font-size: 13px;
}
</style>