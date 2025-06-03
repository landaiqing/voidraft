<script setup lang="ts">
import { useConfigStore } from '@/stores/configStore';
import { useI18n } from 'vue-i18n';
import { computed, ref, watch } from 'vue';
import SettingSection from '../components/SettingSection.vue';
import SettingItem from '../components/SettingItem.vue';
import ToggleSwitch from '../components/ToggleSwitch.vue';
import { useErrorHandler } from '@/utils/errorHandler';
import * as runtime from '@wailsio/runtime';

const { t } = useI18n();
const configStore = useConfigStore();
const { safeCall } = useErrorHandler();

// 可选键列表
const keyOptions = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
];

// 计算属性 - 启用全局热键
const enableGlobalHotkey = computed({
  get: () => configStore.config.general.enableGlobalHotkey,
  set: (value: boolean) => configStore.setEnableGlobalHotkey(value)
});

// 计算属性 - 窗口始终置顶
const alwaysOnTop = computed({
  get: () => configStore.config.general.alwaysOnTop,
  set: async (value: boolean) => {
    await safeCall(async () => {
      // 先更新配置
      await configStore.setAlwaysOnTop(value);
      // 然后立即应用窗口置顶状态
      await runtime.Window.SetAlwaysOnTop(value);
    }, 'config.alwaysOnTopFailed', 'config.alwaysOnTopSuccess');
  }
});

// 修饰键配置 - 只读计算属性
const modifierKeys = computed(() => ({
  ctrl: configStore.config.general.globalHotkey.ctrl,
  shift: configStore.config.general.globalHotkey.shift,
  alt: configStore.config.general.globalHotkey.alt,
  win: configStore.config.general.globalHotkey.win
}));

// 主键配置 - 只读计算属性
const selectedKey = computed(() => configStore.config.general.globalHotkey.key);

// 切换修饰键
const toggleModifier = (key: 'ctrl' | 'shift' | 'alt' | 'win') => {
  const currentHotkey = configStore.config.general.globalHotkey;
  const newHotkey = { ...currentHotkey, [key]: !currentHotkey[key] };
  configStore.setGlobalHotkey(newHotkey);
};

// 更新选择的键
const updateSelectedKey = (event: Event) => {
  const select = event.target as HTMLSelectElement;
  const newHotkey = { ...configStore.config.general.globalHotkey, key: select.value };
  configStore.setGlobalHotkey(newHotkey);
};

// 重置设置
const resetSettings = async () => {
  if (confirm(t('settings.confirmReset'))) {
    await configStore.resetConfig();
  }
};

// 计算热键预览文本
const hotkeyPreview = computed(() => {
  if (!enableGlobalHotkey.value) return '';
  
  const hotkey = configStore.config.general.globalHotkey;
  const parts: string[] = [];
  if (hotkey.ctrl) parts.push('Ctrl');
  if (hotkey.shift) parts.push('Shift');
  if (hotkey.alt) parts.push('Alt');
  if (hotkey.win) parts.push('Win');
  if (hotkey.key) parts.push(hotkey.key);
  
  return parts.join(' + ');
});

// 数据存储路径配置
const useCustomDataPath = computed({
  get: () => configStore.config.general.useCustomDataPath,
  set: (value: boolean) => configStore.setUseCustomDataPath(value)
});

// 自定义路径输入
const customPathInput = ref('');

// 监听自定义路径的变化，同步到配置
const updateCustomPath = () => {
  configStore.setCustomDataPath(customPathInput.value.trim());
};

// 当启用自定义路径时，初始化输入框的值
const initCustomPath = () => {
  if (useCustomDataPath.value) {
    customPathInput.value = configStore.config.general.customDataPath || '';
  }
};

// 监听useCustomDataPath的变化
watch(() => useCustomDataPath.value, (newVal) => {
  if (newVal) {
    initCustomPath();
  }
}, { immediate: true });
</script>

<template>
  <div class="settings-page">
    <SettingSection :title="t('settings.globalHotkey')">
      <SettingItem :title="t('settings.enableGlobalHotkey')">
        <ToggleSwitch v-model="enableGlobalHotkey" />
      </SettingItem>
      
      <div class="hotkey-selector" :class="{ 'disabled': !enableGlobalHotkey }">
        <div class="hotkey-modifiers">
          <label class="modifier-label" :class="{ active: modifierKeys.ctrl }" @click="toggleModifier('ctrl')">
            <input type="checkbox" :checked="modifierKeys.ctrl" class="hidden-checkbox" :disabled="!enableGlobalHotkey">
            <span class="modifier-key">Ctrl</span>
          </label>
          <label class="modifier-label" :class="{ active: modifierKeys.shift }" @click="toggleModifier('shift')">
            <input type="checkbox" :checked="modifierKeys.shift" class="hidden-checkbox" :disabled="!enableGlobalHotkey">
            <span class="modifier-key">Shift</span>
          </label>
          <label class="modifier-label" :class="{ active: modifierKeys.alt }" @click="toggleModifier('alt')">
            <input type="checkbox" :checked="modifierKeys.alt" class="hidden-checkbox" :disabled="!enableGlobalHotkey">
            <span class="modifier-key">Alt</span>
          </label>
          <label class="modifier-label" :class="{ active: modifierKeys.win }" @click="toggleModifier('win')">
            <input type="checkbox" :checked="modifierKeys.win" class="hidden-checkbox" :disabled="!enableGlobalHotkey">
            <span class="modifier-key">Win</span>
          </label>
        </div>
        
        <select class="key-select" :value="selectedKey" @change="updateSelectedKey" :disabled="!enableGlobalHotkey">
          <option v-for="key in keyOptions" :key="key" :value="key">{{ key }}</option>
        </select>
        
        <div class="hotkey-preview" v-if="hotkeyPreview">
          <span class="preview-label">预览：</span>
          <span class="preview-hotkey">{{ hotkeyPreview }}</span>
        </div>
      </div>
    </SettingSection>
    
    <SettingSection :title="t('settings.window')">
      <SettingItem :title="t('settings.alwaysOnTop')">
        <ToggleSwitch v-model="alwaysOnTop" />
      </SettingItem>
    </SettingSection>
    
    <SettingSection :title="t('settings.dataStorage')">
      <SettingItem :title="t('settings.useCustomDataPath')">
        <ToggleSwitch v-model="useCustomDataPath" />
      </SettingItem>
      <div class="path-input-section" v-if="useCustomDataPath">
        <input 
          type="text" 
          v-model="customPathInput" 
          @blur="updateCustomPath"
          @keyup.enter="updateCustomPath"
          :placeholder="t('settings.enterCustomPath')" 
          class="path-input"
        />
        <div class="path-hint">{{ t('settings.pathHint') }}</div>
      </div>
      <div class="default-path-info" v-else>
        <div class="path-display default">{{ configStore.config.general.defaultDataPath }}</div>
        <span class="path-label">{{ t('settings.defaultDataPath') }}</span>
      </div>
    </SettingSection>
    
    <SettingSection :title="t('settings.dangerZone')">
      <div class="danger-zone">
        <div class="reset-section">
          <div class="reset-info">
            <h4>{{ t('settings.resetAllSettings') }}</h4>
            <p>{{ t('settings.resetDescription') }}</p>
          </div>
          <button class="reset-button" @click="resetSettings">
            {{ t('settings.reset') }}
          </button>
        </div>
      </div>
    </SettingSection>
  </div>
</template>

<style scoped lang="scss">
.settings-page {
  max-width: 800px;
}

.hotkey-selector {
  padding: 15px 0 5px 20px;
  
  &.disabled {
    opacity: 0.5;
    pointer-events: none;
  }
  
  .hotkey-modifiers {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
    flex-wrap: wrap;
    
    .modifier-label {
      cursor: pointer;
      
      &.disabled {
        cursor: not-allowed;
      }
      
      .hidden-checkbox {
        display: none;
      }
      
      .modifier-key {
        display: inline-block;
        padding: 6px 12px;
        background-color: #444444;
        border: 1px solid #555555;
        border-radius: 4px;
        color: #b0b0b0;
        font-size: 13px;
        transition: all 0.2s ease;
        
        &:hover {
          background-color: #4a4a4a;
        }
      }
      
      &.active .modifier-key {
        background-color: #2c5a9e;
        color: #ffffff;
        border-color: #3a6db1;
      }
    }
  }
  
  .key-select {
    min-width: 80px;
    padding: 8px 12px;
    background-color: #3a3a3a;
    border: 1px solid #555555;
    border-radius: 4px;
    color: #e0e0e0;
    font-size: 13px;
    appearance: none;
    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23e0e0e0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
    background-repeat: no-repeat;
    background-position: right 8px center;
    background-size: 16px;
    padding-right: 30px;
    margin-bottom: 12px;
    
    &:focus {
      outline: none;
      border-color: #4a9eff;
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      background-color: #2a2a2a;
    }
    
    option {
      background-color: #2a2a2a;
    }
  }
  
  .hotkey-preview {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background-color: #252525;
    border: 1px solid #444444;
    border-radius: 4px;
    margin-top: 8px;
    
    .preview-label {
      font-size: 12px;
      color: #888888;
    }
    
    .preview-hotkey {
      font-size: 13px;
      color: #4a9eff;
      font-weight: 500;
      font-family: 'Consolas', 'Courier New', monospace;
    }
  }
}

.path-input-section {
  margin-top: 10px;
  padding-left: 20px;
  padding-right: 20px;
  
  .path-input {
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    padding: 8px 12px;
    background-color: #3a3a3a;
    border: 1px solid #555555;
    border-radius: 4px;
    color: #e0e0e0;
    font-size: 13px;
    transition: all 0.2s ease;
    
    &:focus {
      outline: none;
      border-color: #4a9eff;
      background-color: #404040;
    }
    
    &::placeholder {
      color: #888888;
    }
  }
  
  .path-hint {
    margin-top: 5px;
    color: #888888;
    font-size: 12px;
    line-height: 1.4;
  }
}

.default-path-info {
  margin-top: 10px;
  padding-left: 20px;
  padding-right: 20px;
  
  .path-display {
    padding: 8px 12px;
    background-color: #2a2a2a;
    border: 1px solid #444444;
    border-radius: 4px;
    color: #888888;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    box-sizing: border-box;
    
    &.default {
      font-style: italic;
    }
  }
  
  .path-label {
    display: block;
    margin-top: 4px;
    color: #666666;
    font-size: 12px;
  }
}

.danger-zone {
  padding: 20px;
  background-color: rgba(220, 53, 69, 0.05);
  border: 1px solid rgba(220, 53, 69, 0.2);
  border-radius: 6px;
  margin-top: 10px;
  
  .reset-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    
    .reset-info {
      flex: 1;
      
      h4 {
        margin: 0 0 6px 0;
        color: #ff6b6b;
        font-size: 14px;
        font-weight: 600;
      }
      
      p {
        margin: 0;
        color: #b0b0b0;
        font-size: 13px;
        line-height: 1.4;
      }
    }
    
    .reset-button {
      padding: 8px 16px;
      background-color: #dc3545;
      border: 1px solid #c82333;
      border-radius: 4px;
      color: #ffffff;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s ease;
      white-space: nowrap;
      
      &:hover {
        background-color: #c82333;
        border-color: #bd2130;
      }
      
      &:active {
        transform: translateY(1px);
      }
    }
  }
}
</style> 