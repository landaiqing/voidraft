<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { onMounted, computed, ref, nextTick } from 'vue';
import SettingSection from '../components/SettingSection.vue';
import SettingItem from '../components/SettingItem.vue';
import { AccordionContainer, AccordionItem } from '@/components/accordion';
import { useKeybindingStore } from '@/stores/keybindingStore';
import { useSystemStore } from '@/stores/systemStore';
import { useConfigStore } from '@/stores/configStore';
import { useEditorStore } from '@/stores/editorStore';
import { getCommandDescription } from '@/views/editor/keymap/commands';
import { KeyBindingType } from '@/../bindings/voidraft/internal/models/models';
import { KeyBindingService } from '@/../bindings/voidraft/internal/services';
import { useConfirm } from '@/composables/useConfirm';
import toast from '@/components/toast';

const { t } = useI18n();
const keybindingStore = useKeybindingStore();
const systemStore = useSystemStore();
const configStore = useConfigStore();
const editorStore = useEditorStore();

interface EditingState {
  id: number;
}

const editingBinding = ref<EditingState | null>(null);
const inputKey = ref('');

// 将快捷键字符串拆分为独立的键
const splitKeys = (keyStr: string): string[] => {
  if (!keyStr) return [];
  return keyStr.split(/[-+]/).filter(Boolean);
};

// 动态设置 ref 并自动聚焦
const setInputRef = (el: any) => {
  if (el && el instanceof HTMLInputElement) {
    // 使用 nextTick 确保 DOM 完全渲染后再聚焦
    nextTick(() => {
      el.focus();
    });
  }
};

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
    description: getCommandDescription(kb.name) || kb.name || '',
    enabled: kb.enabled,
    preventDefault: kb.preventDefault,
    originalData: kb
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
  if (!keyStr) return [];
  
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

// 切换启用状态
const toggleEnabled = async (binding: any) => {
  try {
    await KeyBindingService.UpdateKeyBindingEnabled(binding.id, !binding.enabled);
    await keybindingStore.loadKeyBindings();
    await editorStore.applyKeymapSettings();
  } catch (error) {
    console.error('Failed to update enabled status:', error);
  }
};

// 切换 PreventDefault
const togglePreventDefault = async (binding: any) => {
  try {
    await KeyBindingService.UpdateKeyBindingPreventDefault(binding.id, !binding.preventDefault);
    await keybindingStore.loadKeyBindings();
    await editorStore.applyKeymapSettings();
  } catch (error) {
    console.error('Failed to update preventDefault:', error);
  }
};

// 开始添加快捷键
const startAddKey = (bindingId: number) => {
  editingBinding.value = {
    id: bindingId
  };
  inputKey.value = '';
};

// 取消编辑
const cancelEdit = () => {
  editingBinding.value = null;
  inputKey.value = '';
};

// 验证快捷键格式
const validateKeyFormat = (key: string): boolean => {
  if (!key || key.trim() === '') return false;
  
  // 基本格式验证：允许 Mod/Ctrl/Alt/Shift + 其他键
  const validPattern = /^(Mod|Ctrl|Alt|Shift|Cmd)(-[A-Za-z0-9\[\]\\/;',.\-=`]|-(ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Enter|Tab|Backspace|Delete|Home|End|PageUp|PageDown|Space|Escape))+$/;
  const simpleKeyPattern = /^[A-Za-z0-9]$/;
  const specialKeyPattern = /^(ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Enter|Tab|Backspace|Delete|Home|End|PageUp|PageDown|Space|Escape)$/;
  
  return validPattern.test(key) || simpleKeyPattern.test(key) || specialKeyPattern.test(key);
};

// 检查快捷键冲突
const checkConflict = (newKey: string, currentBindingId: number): { conflict: boolean; conflictWith?: string } => {
  const conflictBinding = keyBindings.value.find(kb => 
    kb.rawKey === newKey && kb.id !== currentBindingId
  );
  
  if (conflictBinding) {
    return {
      conflict: true,
      conflictWith: conflictBinding.description
    };
  }
  
  return { conflict: false };
};

// 添加新键到快捷键
const addKeyPart = async () => {
  if (!editingBinding.value || !inputKey.value.trim()) {
    return;
  }
  
  const newPart = inputKey.value.trim();
  const binding = keyBindings.value.find(kb => kb.id === editingBinding.value!.id);
  if (!binding) return;
  
  // 检查键数量限制（最多4个）
  const currentParts = splitKeys(binding.rawKey);
  if (currentParts.length >= 4) {
    toast.error(t('keybindings.maxKeysReached'));
    inputKey.value = '';
    return;
  }
  
  // 获取现有的键
  const currentKey = binding.rawKey;
  const newKey = currentKey ? `${currentKey}-${newPart}` : newPart;
  
  // 验证格式
  if (!validateKeyFormat(newKey)) {
    toast.error(t('keybindings.invalidFormat'));
    inputKey.value = '';
    return;
  }
  
  // 检查冲突
  const conflictCheck = checkConflict(newKey, editingBinding.value.id);
  if (conflictCheck.conflict) {
    toast.error(t('keybindings.conflict', { command: conflictCheck.conflictWith }));
    inputKey.value = '';
    return;
  }
  
  try {
    await keybindingStore.updateKeyBinding(editingBinding.value.id, newKey);
    await editorStore.applyKeymapSettings();
    inputKey.value = '';
  } catch (error) {
    console.error('Failed to add key part:', error);
  }
};

// 删除快捷键的某个部分
const removeKeyPart = async (bindingId: number, index: number) => {
  const binding = keyBindings.value.find(kb => kb.id === bindingId);
  if (!binding) return;
  
  const parts = splitKeys(binding.rawKey);
  parts.splice(index, 1);
  
  const newKey = parts.join('-');
  
  try {
    await keybindingStore.updateKeyBinding(bindingId, newKey);
    await editorStore.applyKeymapSettings();
  } catch (error) {
    console.error('Failed to remove key part:', error);
  }
};

</script>

<template>
  <div class="settings-page">
    <!-- 快捷键模式设置 -->
    <SettingSection :title="t('keybindings.keymapMode')">
      <SettingItem :title="t('keybindings.keymapMode')">
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
      
      <AccordionContainer :multiple="false">
        <AccordionItem
          v-for="binding in keyBindings"
          :key="binding.id"
          :id="binding.id!"
        >
          <!-- 标题插槽 -->
          <template #title>
            <div class="binding-title" :class="{ 'disabled': !binding.enabled }">
              <div class="binding-name">
                <span class="binding-description">{{ binding.description }}</span>
                <span class="binding-extension">{{ binding.extension }}</span>
              </div>
              <div class="binding-keys">
                <span 
                  v-for="(key, index) in binding.command"
                  :key="index"
                  class="key-badge"
                >
                  {{ key }}
                </span>
                <span v-if="!binding.command.length" class="key-badge-empty">-</span>
              </div>
            </div>
          </template>

          <!-- 展开内容 -->
          <div class="binding-config">
            <!-- Enabled 配置 -->
            <div class="config-row">
              <span class="config-label">{{ t('keybindings.config.enabled') }}</span>
              <label class="switch">
                <input 
                  type="checkbox" 
                  :checked="binding.enabled"
                  @change="toggleEnabled(binding)"
                >
                <span class="slider"></span>
              </label>
            </div>

            <!-- PreventDefault 配置 -->
            <div class="config-row">
              <span class="config-label">{{ t('keybindings.config.preventDefault') }}</span>
              <label class="switch">
                <input 
                  type="checkbox" 
                  :checked="binding.preventDefault"
                  @change="togglePreventDefault(binding)"
                >
                <span class="slider"></span>
              </label>
            </div>

            <!-- Key 配置 -->
            <div class="config-row">
              <span class="config-label">{{ t('keybindings.config.keybinding') }}</span>
              <div class="key-input-wrapper">
                <div class="key-tags">
                  <!-- 显示现有快捷键的每个部分 -->
                  <template v-if="binding.rawKey">
                    <span 
                      v-for="(keyPart, index) in splitKeys(binding.rawKey)"
                      :key="index"
                      class="key-tag"
                    >
                      <span class="key-tag-text">{{ keyPart }}</span>
                      <button 
                        class="key-tag-remove"
                        @click="removeKeyPart(binding.id!, index)"
                      >×</button>
                    </span>
                  </template>
                  
                  <!-- 添加输入框 -->
                  <template v-if="editingBinding?.id === binding.id">
                    <input 
                      :ref="setInputRef"
                      v-model="inputKey"
                      type="text"
                      class="key-input"
                      :placeholder="t('keybindings.keyPlaceholder')"
                      @keydown.enter="addKeyPart"
                      @keydown.escape="cancelEdit"
                      @blur="cancelEdit"
                    />
                  </template>
                  
                  <!-- 添加按钮 -->
                  <template v-else>
                    <button 
                      class="key-tag-add"
                      @click="startAddKey(binding.id!)"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 1V11M1 6H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                      </svg>
                    </button>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </AccordionItem>
      </AccordionContainer>
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

.binding-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 16px;
  
  &.disabled {
    opacity: 0.5;
  }
}

.binding-name {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.binding-description {
  font-size: 13px;
  font-weight: 500;
  color: var(--settings-text);
}

.binding-extension {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: capitalize;
}

.binding-keys {
  display: flex;
  gap: 4px;
  align-items: center;
}

.key-badge {
  background-color: var(--settings-input-bg);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
  border: 1px solid var(--settings-input-border);
  color: var(--settings-text);
  white-space: nowrap;
}

.key-badge-empty {
  font-size: 11px;
  color: var(--text-muted);
  font-style: italic;
}

.binding-config {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.config-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.config-label {
  font-size: 13px;
  color: var(--settings-text);
  font-weight: 500;
}

// Switch 开关样式
.switch {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
  flex-shrink: 0;
  
  input {
    opacity: 0;
    width: 0;
    height: 0;
    
    &:checked + .slider {
      background-color: #4a9eff;
      
      &:before {
        transform: translateX(16px);
      }
    }
    
    &:focus + .slider {
      box-shadow: 0 0 1px #4a9eff;
    }
  }
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--settings-input-border);
  transition: 0.3s;
  border-radius: 20px;
  
  &:before {
    position: absolute;
    content: "";
    height: 14px;
    width: 14px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
  }
}

.key-input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.key-tags {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
  flex: 1;
  min-height: 28px;
}

.key-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  height: 28px;
  background-color: var(--settings-input-bg);
  border: 1px solid var(--settings-input-border);
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--settings-text);
  transition: all 0.2s ease;
  box-sizing: border-box;
  
  &:hover {
    border-color: #4a9eff;
    
    .key-tag-remove {
      opacity: 1;
    }
  }
}

.key-tag-text {
  user-select: none;
}

.key-tag-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border: none;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 0;
  margin: 0;
  opacity: 0.6;
  transition: all 0.2s ease;
  
  &:hover {
    color: #e74c3c;
    opacity: 1;
  }
}

.key-tag-add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border: 1px dashed var(--settings-input-border);
  border-radius: 4px;
  background-color: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
  box-sizing: border-box;
  
  &:hover {
    border-color: #4a9eff;
    background-color: var(--settings-input-bg);
    color: #4a9eff;
  }
}

.key-input {
  padding: 4px 8px;
  height: 28px;
  border: 1px solid #4a9eff;
  border-radius: 4px;
  background-color: var(--settings-input-bg);
  color: var(--settings-text);
  font-size: 12px;
  width: 60px;
  outline: none;
  box-sizing: border-box;
  
  &::placeholder {
    color: var(--text-muted);
    font-size: 11px;
  }
}

.btn-mini {
  width: 24px;
  height: 24px;
  min-width: 24px;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  transition: opacity 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  line-height: 1;
  flex-shrink: 0;
  
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
    
    &:hover {
      opacity: 0.85;
    }
  }
}
</style>
