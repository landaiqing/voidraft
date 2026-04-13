<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { onMounted, computed, ref } from 'vue';
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
import { useKeyRecorder } from '@/composables/useKeyRecorder';
import toast from '@/components/toast';

const { t } = useI18n();
const keybindingStore = useKeybindingStore();
const systemStore = useSystemStore();
const configStore = useConfigStore();
const editorStore = useEditorStore();

// Pending result after recording completes (before user confirms)
const pendingResult = ref<{
  bindingId: number;
  newKey: string;
  conflict: { description: string; id: number; rawKey: string } | null;
} | null>(null);

const MODIFIER_ORDER = ['Mod', 'Ctrl', 'Cmd', 'Alt', 'Shift'];

// Unify Mod/Ctrl/Cmd into a single canonical modifier for comparison.
// On macOS "Mod" = Cmd, on Windows/Linux "Mod" = Ctrl.
// Data may store either form, so we collapse them to "Mod".
const unifyModifier = (mod: string): string => {
  if (mod === 'Ctrl' || mod === 'Cmd') return 'Mod';
  return mod;
};

const normalizeKeyForCompare = (keyStr: string): string => {
  if (!keyStr) return '';
  const parts = keyStr.split('-');
  const modifiers: string[] = [];
  const rest: string[] = [];
  for (const p of parts) {
    if (MODIFIER_ORDER.includes(p)) {
      modifiers.push(unifyModifier(p));
    } else {
      rest.push(p.toLowerCase());
    }
  }
  // Deduplicate (e.g. both Ctrl and Mod collapsed to Mod)
  const uniqueMods = [...new Set(modifiers)];
  uniqueMods.sort((a, b) => MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b));
  return [...uniqueMods, ...rest].join('-');
};

const checkConflict = (newKey: string, currentBindingId: number): { description: string; id: number; rawKey: string } | null => {
  const normalizedNew = normalizeKeyForCompare(newKey);
  const currentBinding = keyBindings.value.find(kb => kb.id === currentBindingId);

  for (const kb of keyBindings.value) {
    if (kb.id === currentBindingId) continue;
    if (!kb.enabled) continue;
    if (currentBinding?.originalData?.scope && kb.originalData?.scope
      && currentBinding.originalData.scope !== kb.originalData.scope) continue;
    
    const normalizedExisting = normalizeKeyForCompare(kb.rawKey);
    if (normalizedExisting && normalizedExisting === normalizedNew) {
      return { description: kb.description, id: kb.id!, rawKey: kb.rawKey };
    }
  }
  return null;
};

const { recording, isRecording, startRecording: rawStartRecording, stopRecording } = useKeyRecorder({
  isMacOS: systemStore.isMacOS,
  onComplete: (bindingId: number, keyString: string) => {
    const conflict = checkConflict(keyString, bindingId);
    pendingResult.value = { bindingId, newKey: keyString, conflict };
  },
  onCancel: () => {
    pendingResult.value = null;
  },
});

const hasPendingResult = (bindingId: number): boolean => {
  return pendingResult.value?.bindingId === bindingId;
};

const isActive = (bindingId: number): boolean => {
  return isRecording(bindingId) || hasPendingResult(bindingId);
};

const toggleRecording = (bindingId: number) => {
  if (isActive(bindingId)) {
    stopRecording();
    pendingResult.value = null;
  } else {
    pendingResult.value = null;
    rawStartRecording(bindingId);
  }
};

const confirmSave = async () => {
  if (!pendingResult.value) return;
  const { bindingId, newKey } = pendingResult.value;
  pendingResult.value = null;
  await saveKey(bindingId, newKey);
};

const saveKey = async (bindingId: number, keyString: string) => {
  try {
    await keybindingStore.updateKeyBinding(bindingId, keyString);
    await editorStore.applyKeymapSettings();
  } catch (error) {
    console.error('Failed to save keybinding:', error);
    toast.error(t('keybindings.saveFailed'));
  }
};

const resetSingleKey = async (bindingId: number) => {
  pendingResult.value = null;
  stopRecording();
  try {
    await KeyBindingService.ResetSingleKeyBinding(bindingId);
    await keybindingStore.loadKeyBindings();
    await editorStore.applyKeymapSettings();
  } catch (error) {
    console.error('Failed to reset keybinding:', error);
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

const getDisplayForPending = (bindingId: number): string[] => {
  if (!pendingResult.value || pendingResult.value.bindingId !== bindingId) return [];
  return parseKeyString(pendingResult.value.newKey);
};

const toggleEnabled = async (binding: any) => {
  try {
    await KeyBindingService.UpdateKeyBindingEnabled(binding.id, !binding.enabled);
    await keybindingStore.loadKeyBindings();
    await editorStore.applyKeymapSettings();
  } catch (error) {
    console.error('Failed to update enabled status:', error);
  }
};

const togglePreventDefault = async (binding: any) => {
  try {
    await KeyBindingService.UpdateKeyBindingPreventDefault(binding.id, !binding.preventDefault);
    await keybindingStore.loadKeyBindings();
    await editorStore.applyKeymapSettings();
  } catch (error) {
    console.error('Failed to update preventDefault:', error);
  }
};
</script>

<template>
  <div class="settings-page">
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
          >{{ option.label }}</option>
        </select>
      </SettingItem>
    </SettingSection>

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
          <template #title>
            <div class="binding-title" :class="{ 'disabled': !binding.enabled }">
              <div class="binding-name">
                <span class="binding-description">{{ binding.description }}</span>
                <span class="binding-extension">{{ binding.extension }}</span>
              </div>
              <div class="binding-keys">
                <template v-if="binding.command.length">
                  <kbd v-for="(key, index) in binding.command" :key="index">{{ key }}</kbd>
                </template>
                <span v-else class="key-empty">{{ t('keybindings.noKeybinding') }}</span>
              </div>
            </div>
          </template>

          <div class="binding-config">
            <div class="config-row">
              <span class="config-label">{{ t('keybindings.config.enabled') }}</span>
              <label class="switch">
                <input type="checkbox" :checked="binding.enabled" @change="toggleEnabled(binding)">
                <span class="slider"></span>
              </label>
            </div>

            <div class="config-row">
              <span class="config-label">{{ t('keybindings.config.preventDefault') }}</span>
              <label class="switch">
                <input type="checkbox" :checked="binding.preventDefault" @change="togglePreventDefault(binding)">
                <span class="slider"></span>
              </label>
            </div>

            <div class="config-row config-row-key">
              <span class="config-label">{{ t('keybindings.config.keybinding') }}</span>
              <div class="key-editor">
                <div 
                  class="key-display"
                  :class="{ 
                    'is-recording': isRecording(binding.id!),
                    'is-pending': hasPendingResult(binding.id!) && !isRecording(binding.id!),
                    'has-conflict': hasPendingResult(binding.id!) && pendingResult?.conflict
                  }"
                  @click="toggleRecording(binding.id!)"
                >
                  <template v-if="isRecording(binding.id!)">
                    <template v-if="recording?.displayParts?.length">
                      <kbd v-for="(k, i) in recording.displayParts" :key="i">{{ k }}</kbd>
                      <span class="recording-dot">·</span>
                    </template>
                    <span v-else class="recording-hint">{{ t('keybindings.waitingForKey') }}</span>
                  </template>
                  <template v-else-if="hasPendingResult(binding.id!)">
                    <kbd 
                      v-for="(k, i) in getDisplayForPending(binding.id!)" 
                      :key="i"
                      :class="{ 'conflict-key': pendingResult?.conflict }"
                    >{{ k }}</kbd>
                  </template>
                  <template v-else>
                    <template v-if="binding.command.length">
                      <kbd v-for="(key, index) in binding.command" :key="index">{{ key }}</kbd>
                    </template>
                    <span v-else class="key-placeholder">{{ t('keybindings.clickToSet') }}</span>
                  </template>
                </div>
                <template v-if="isActive(binding.id!)">
                  <button 
                    v-if="hasPendingResult(binding.id!)"
                    class="btn-action btn-confirm"
                    @click.stop="confirmSave"
                    :title="t('keybindings.confirmSave')"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </button>
                  <button 
                    class="btn-action btn-reset"
                    @click.stop="resetSingleKey(binding.id!)"
                    :title="t('keybindings.resetSingle')"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="1 4 1 10 7 10"/>
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                    </svg>
                  </button>
                </template>
              </div>
              <span 
                v-if="hasPendingResult(binding.id!) && pendingResult?.conflict" 
                class="conflict-text"
              >{{ t('keybindings.conflictWith', { command: pendingResult!.conflict!.description }) }}（{{ pendingResult!.conflict!.rawKey }}）</span>
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
  gap: 3px;
  align-items: center;

  kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 20px;
    padding: 0 5px;
    background: var(--settings-input-bg);
    border: 1px solid var(--settings-input-border);
    border-radius: 3px;
    font-size: 11px;
    font-family: inherit;
    color: var(--settings-text);
    box-shadow: 0 1px 0 var(--settings-input-border);
    white-space: nowrap;
    line-height: 1;
  }
}

.key-empty {
  font-size: 11px;
  color: var(--text-muted);
  font-style: italic;
}

.binding-config {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.config-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  &.config-row-key {
    position: relative;
    padding-bottom: 0;
  }
}

.config-label {
  font-size: 13px;
  color: var(--settings-text);
  font-weight: 500;
}

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

// Key editor - compact single row
.key-editor {
  display: flex;
  align-items: center;
  gap: 6px;
}

.key-display {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 26px;
  padding: 0 8px;
  background-color: var(--settings-input-bg);
  border: 1px solid var(--settings-input-border);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
  min-width: 60px;

  &:hover {
    border-color: var(--text-muted);
  }

  &.is-recording {
    border-color: #4a9eff;
    box-shadow: 0 0 0 1px rgba(74, 158, 255, 0.25);
  }

  &.is-pending {
    border-color: #4a9eff;
  }

  &.has-conflict {
    border-color: #e8a838;
  }

  kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 16px;
    height: 18px;
    padding: 0 4px;
    background: var(--settings-card-bg, #2a2a2a);
    border: 1px solid var(--settings-input-border);
    border-radius: 3px;
    font-size: 11px;
    font-family: inherit;
    font-weight: 500;
    color: var(--settings-text);
    box-shadow: 0 1px 0 var(--settings-input-border);
    white-space: nowrap;
    line-height: 1;

    &.conflict-key {
      border-color: #e8a838;
      color: #e8a838;
    }
  }
}

.recording-hint {
  font-size: 11px;
  color: #4a9eff;
  white-space: nowrap;
}

.recording-dot {
  font-size: 14px;
  font-weight: bold;
  color: #4a9eff;
  animation: blink 0.8s step-end infinite;
}

@keyframes blink {
  50% { opacity: 0; }
}

.key-placeholder {
  font-size: 11px;
  color: var(--text-muted);
}

.conflict-text {
  position: absolute;
  left: 0;
  top: 100%;
  margin-top: 2px;
  font-size: 11px;
  color: #e8a838;
  line-height: 1;
  white-space: nowrap;
  pointer-events: none;
}

.btn-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border: 1px solid var(--settings-input-border);
  border-radius: 4px;
  background-color: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
  padding: 0;
  
  &.btn-confirm {
    color: #4caf50;
    border-color: #4caf50;

    &:hover {
      background-color: #4caf50;
      color: white;
    }
  }

  &.btn-reset {
    &:hover {
      border-color: var(--text-muted);
      color: var(--settings-text);
    }
  }
}
</style>
