<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { onMounted, computed, ref, onUnmounted, watch } from 'vue';
import SettingSection from '../components/SettingSection.vue';
import SettingItem from '../components/SettingItem.vue';
import { useKeybindingStore } from '@/stores/keybindingStore';
import { useSystemStore } from '@/stores/systemStore';
import { useConfigStore } from '@/stores/configStore';
import { useEditorStore } from '@/stores/editorStore';
import { getCommandDescription } from '@/views/editor/keymap/commands';
import { KeyBindingType } from '@/../bindings/voidraft/internal/models/models';
import { KeyBindingService } from '@/../bindings/voidraft/internal/services';
import { useConfirm } from '@/composables/useConfirm';

const { t } = useI18n();
const keybindingStore = useKeybindingStore();
const systemStore = useSystemStore();
const configStore = useConfigStore();
const editorStore = useEditorStore();

interface EditingState {
  id: number;
  name: string;
  originalKey: string;
}

const editingBinding = ref<EditingState | null>(null);
const capturedKey = ref('');
const capturedKeyDisplay = ref<string[]>([]);
const isConflict = ref(false);

const isEditing = computed(() => !!editingBinding.value);

onMounted(async () => {
  await keybindingStore.loadKeyBindings();
});

const keymapModeOptions = [
  { label: t('keybindings.modes.standard'), value: KeyBindingType.Standard },
  { label: t('keybindings.modes.emacs'), value: KeyBindingType.Emacs }
];

const updateKeymapMode = async (mode: KeyBindingType) => {
  await configStore.setKeymapMode(mode);
  await keybindingStore.loadKeyBindings();
  await editorStore.applyKeymapSettings();
};

// 重置快捷键确认
const { isConfirming: isResetConfirming, requestConfirm: requestResetConfirm } = useConfirm({
  timeout: 3000,
  onConfirm: async () => {
    await KeyBindingService.ResetKeyBindings();
    await keybindingStore.loadKeyBindings();
    await editorStore.applyKeymapSettings();
  }
});

const keyBindings = computed(() =>
  keybindingStore.keyBindings.map(kb => ({
    id: kb.id,
    name: kb.name,
    command: getDisplayKeybinding(kb),
    rawKey: getRawKey(kb),
    extension: kb.extension || '',
    description: getCommandDescription(kb.name) || kb.name || ''
  }))
);

const getRawKey = (kb: any): string => {
  const platformKey = systemStore.isMacOS ? kb.macos 
    : systemStore.isWindows ? kb.windows 
    : systemStore.isLinux ? kb.linux 
    : kb.key;
  
  return platformKey || kb.key || '';
};

const getDisplayKeybinding = (kb: any): string[] => {
  const keyStr = getRawKey(kb);
  return keyStr ? parseKeyString(keyStr) : [];
};

const parseKeyString = (keyStr: string): string[] => {
  const symbolMap: Record<string, string> = {
    'Mod': systemStore.isMacOS ? '⌘' : 'Ctrl',
    'Cmd': '⌘',
    ...(systemStore.isMacOS ? {
      'Alt': '⌥',
      'Shift': '⇧',
      'Ctrl': '⌃'
    } : {}),
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→'
  };

  return keyStr
    .split(/[-+]/)
    .map(part => symbolMap[part] ?? part.charAt(0).toUpperCase() + part.slice(1))
    .filter(Boolean);
};


// 键盘事件捕获
const SPECIAL_KEYS: Record<string, string> = {
  ' ': 'Space',
  'ArrowUp': 'ArrowUp',
  'ArrowDown': 'ArrowDown',
  'ArrowLeft': 'ArrowLeft',
  'ArrowRight': 'ArrowRight',
  'Enter': 'Enter',
  'Tab': 'Tab',
  'Backspace': 'Backspace',
  'Delete': 'Delete',
  'Home': 'Home',
  'End': 'End',
  'PageUp': 'PageUp',
  'PageDown': 'PageDown',
};

const MODIFIER_KEYS = ['Control', 'Alt', 'Shift', 'Meta'];
const MAX_KEY_PARTS = 3; // 最多3个键

const captureKeyBinding = (event: KeyboardEvent): string | null => {
  // 忽略单独的修饰键
  if (MODIFIER_KEYS.includes(event.key)) return null;
  
  const parts: string[] = [];
  
  // 添加修饰键
  if (event.ctrlKey || event.metaKey) parts.push('Mod');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  
  // 获取主键
  const mainKey = SPECIAL_KEYS[event.key] ?? 
    (event.key.length === 1 ? event.key.toLowerCase() : event.key);
  
  if (mainKey) parts.push(mainKey);
  
  // 限制最多3个键
  if (parts.length > MAX_KEY_PARTS) return null;
  
  return parts.join('-');
};

const cancelEdit = () => {
  window.removeEventListener('keydown', handleKeyCapture, true);
  editingBinding.value = null;
  capturedKey.value = '';
  capturedKeyDisplay.value = [];
  isConflict.value = false;
};

const handleKeyCapture = (event: KeyboardEvent) => {
  if (!isEditing.value) return;
  
  event.preventDefault();
  event.stopPropagation();
  
  // ESC 取消编辑
  if (event.key === 'Escape') {
    cancelEdit();
    return;
  }
  
  const key = captureKeyBinding(event);
  if (key) {
    capturedKey.value = key;
    capturedKeyDisplay.value = parseKeyString(key);
    isConflict.value = false;
  }
};


const startEditBinding = (binding: any) => {
  editingBinding.value = {
    id: binding.id,
    name: binding.name,
    originalKey: binding.rawKey
  };
  capturedKey.value = '';
  capturedKeyDisplay.value = [];
  isConflict.value = false;
  
  // 手动添加键盘监听
  window.addEventListener('keydown', handleKeyCapture, true);
};

const checkConflict = (newKey: string): boolean => 
  keyBindings.value.some(kb => 
    kb.rawKey === newKey && kb.name !== editingBinding.value?.name
  );

const confirmKeybinding = async () => {
  if (!editingBinding.value || !capturedKey.value) return;
  
  // 检查冲突
  if (checkConflict(capturedKey.value)) {
    isConflict.value = true;
    setTimeout(cancelEdit, 600);
    return;
  }
  
  try {
    await keybindingStore.updateKeyBinding(
      editingBinding.value.id,
      capturedKey.value
    );
    await editorStore.applyKeymapSettings();
  } catch (error) {
    console.error(error);
  } finally {
    cancelEdit();
  }
};
</script>

<template>
  <div class="settings-page">
    <!-- 快捷键模式设置 -->
    <SettingSection :title="t('keybindings.keymapMode')">
      <SettingItem
        :title="t('keybindings.keymapMode')">
        <select
          :value="configStore.config.editing.keymapMode"
          @change="updateKeymapMode(($event.target as HTMLSelectElement).value as KeyBindingType)"
          class="select-input"
        >
          <option
            v-for="option in keymapModeOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </SettingItem>
    </SettingSection>

    <!-- 快捷键列表 -->
    <SettingSection :title="t('settings.keyBindings')">
      <template #title-right>
        <button 
          :class="['reset-button', isResetConfirming('keybindings') ? 'reset-button-confirming' : '']"
          @click="requestResetConfirm('keybindings')"
        >
          {{ isResetConfirming('keybindings') ? t('keybindings.confirmReset') : t('keybindings.resetToDefault') }}
        </button>
      </template>
      
      <div class="key-bindings-container">
        <div class="key-bindings-header">
          <div class="keybinding-col">{{ t('keybindings.headers.shortcut') }}</div>
          <div class="extension-col">{{ t('keybindings.headers.extension') }}</div>
          <div class="description-col">{{ t('keybindings.headers.description') }}</div>
        </div>
        
        <div
          v-for="binding in keyBindings"
          :key="binding.name"
          class="key-binding-row"
        >
          <!-- 快捷键列 -->
          <div 
            class="keybinding-col"
            :class="{ 'editing': editingBinding?.name === binding.name }"
            @click.stop="editingBinding?.name !== binding.name && startEditBinding(binding)"
          >
            <!-- 编辑模式 -->
            <template v-if="editingBinding?.name === binding.name">
              <template v-if="!capturedKey">
                <span class="key-badge waiting">waiting...</span>
              </template>
              <template v-else>
                <span 
                  v-for="(key, index) in capturedKeyDisplay"
                  :key="index"
                  class="key-badge captured"
                  :class="{ 'conflict': isConflict }"
                >
                  {{ key }}
                </span>
              </template>
              <button 
                @click.stop="confirmKeybinding" 
                class="btn-mini btn-confirm"
                :disabled="!capturedKey"
                title="Ok"
              >✓</button>
              <button 
                @click.stop="cancelEdit" 
                class="btn-mini btn-cancel"
                title="Cancel"
              >✕</button>
            </template>
            
            <!-- 显示模式 -->
            <template v-else>
              <span 
                v-for="(key, index) in binding.command"
                :key="index"
                class="key-badge"
              >
                {{ key }}
              </span>
            </template>
          </div>
          
          <div class="extension-col">{{ binding.extension }}</div>
          <div class="description-col">{{ binding.description }}</div>
        </div>
      </div>
    </SettingSection>
  </div>
</template>

<style scoped lang="scss">
.select-input {
  min-width: 140px;
  padding: 6px 10px;
  border: 1px solid var(--settings-input-border);
  border-radius: 4px;
  background-color: var(--settings-input-bg);
  color: var(--settings-text);
  font-size: 12px;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23666666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 6px center;
  background-size: 14px;
  padding-right: 26px;
  transition: border-color 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: #4a9eff;
  }
  
  option {
    background-color: var(--settings-card-bg);
    color: var(--settings-text);
  }
}

.reset-button {
  padding: 6px 12px;
  font-size: 12px;
  border: 1px solid var(--settings-input-border);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: var(--settings-button-bg);
  color: var(--settings-button-text);
  
  &:hover {
    border-color: #4a9eff;
    background-color: var(--settings-button-hover-bg);
  }
  
  &:active {
    transform: translateY(1px);
  }
  
  &.reset-button-confirming {
    background-color: #e74c3c;
    color: white;
    border-color: #c0392b;
    
    &:hover {
      background-color: #c0392b;
    }
  }
}

.key-bindings-container {
  
  .key-bindings-header {
    display: flex;
    padding: 0 0 8px 0;
    border-bottom: 1px solid var(--settings-border);
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 500;
  }
  
  .key-binding-row {
    display: flex;
    padding: 10px 0;
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
    gap: 4px;
    padding: 0 10px 0 0;
    color: var(--settings-text);
    align-items: center;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover:not(.editing) .key-badge {
      border-color: #4a9eff;
    }
    
    &.editing {
      cursor: default;
    }
    
    .key-badge {
      background-color: var(--settings-input-bg);
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
      border: 1px solid var(--settings-input-border);
      color: var(--settings-text);
      transition: border-color 0.2s ease;
      white-space: nowrap;
      
      &.waiting {
        border: none;
        background-color: transparent;
        padding: 0;
        color: #4a9eff;
        font-style: italic;
        animation: colorPulse 1.5s ease-in-out infinite;
      }
      
      &.captured {
        background-color: #4a9eff;
        color: white;
        border-color: #4a9eff;
        
        &.conflict {
          background-color: #dc3545;
          border-color: #dc3545;
          animation: shake 0.6s ease-in-out;
        }
      }
    }
  }
  
  .btn-mini {
    width: 16px;
    height: 16px;
    min-width: 16px;
    border: none;
    border-radius: 2px;
    cursor: pointer;
    font-size: 10px;
    transition: opacity 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    line-height: 1;
    margin-left: auto;
    
    &.btn-confirm {
      background-color: #28a745;
      color: white;
      
      &:hover:not(:disabled) {
        opacity: 0.85;
      }
      
      &:disabled {
        background-color: var(--settings-input-border);
        cursor: not-allowed;
        opacity: 0.5;
      }
    }
    
    &.btn-cancel {
      background-color: #dc3545;
      color: white;
      margin-left: 2px;
      
      &:hover {
        opacity: 0.85;
      }
    }
  }
  
  .extension-col {
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

@keyframes colorPulse {
  0%, 100% {
    color: #4a9eff;
    opacity: 1;
  }
  50% {
    color: #2080ff;
    opacity: 0.6;
  }
}

@keyframes shake {
  0%, 100% {
    transform: translateX(0);
  }
  10%, 30%, 50%, 70%, 90% {
    transform: translateX(-4px);
  }
  20%, 40%, 60%, 80% {
    transform: translateX(4px);
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