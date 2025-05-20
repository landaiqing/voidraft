<script setup lang="ts">
import { useConfigStore } from '@/stores/configStore';
import { useI18n } from 'vue-i18n';
import { ref } from 'vue';
import SettingSection from '../components/SettingSection.vue';
import SettingItem from '../components/SettingItem.vue';
import ToggleSwitch from '../components/ToggleSwitch.vue';

const { t } = useI18n();
const configStore = useConfigStore();

// 选择的键盘修饰键
const selectedModifiers = ref({
  ctrl: false,
  shift: false,
  alt: true,
  altgr: false,
  win: false
});

// 选择的键
const selectedKey = ref('X');

// 可选键列表
const keyOptions = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
];

// 更新选择的键
const updateSelectedKey = (event: Event) => {
  const select = event.target as HTMLSelectElement;
  selectedKey.value = select.value;
};

// 切换修饰键
const toggleModifier = (key: keyof typeof selectedModifiers.value) => {
  selectedModifiers.value[key] = !selectedModifiers.value[key];
};
</script>

<template>
  <div class="settings-page">
    <SettingSection :title="t('settings.globalHotkey')">
      <SettingItem :title="t('settings.enableGlobalHotkey')">
        <ToggleSwitch v-model="configStore.config.alwaysOnTop" /> <!-- 此处使用alwaysOnTop作为示例 -->
      </SettingItem>
      
      <div class="hotkey-selector">
        <div class="hotkey-modifiers">
          <label class="modifier-label" :class="{ active: selectedModifiers.ctrl }">
            <input type="checkbox" v-model="selectedModifiers.ctrl" class="hidden-checkbox">
            <span class="modifier-key">Ctrl</span>
          </label>
          <label class="modifier-label" :class="{ active: selectedModifiers.shift }">
            <input type="checkbox" v-model="selectedModifiers.shift" class="hidden-checkbox">
            <span class="modifier-key">Shift</span>
          </label>
          <label class="modifier-label" :class="{ active: selectedModifiers.alt }">
            <input type="checkbox" v-model="selectedModifiers.alt" class="hidden-checkbox">
            <span class="modifier-key">Alt</span>
          </label>
          <label class="modifier-label" :class="{ active: selectedModifiers.altgr }">
            <input type="checkbox" v-model="selectedModifiers.altgr" class="hidden-checkbox">
            <span class="modifier-key">AltGr</span>
          </label>
          <label class="modifier-label" :class="{ active: selectedModifiers.win }">
            <input type="checkbox" v-model="selectedModifiers.win" class="hidden-checkbox">
            <span class="modifier-key">Win</span>
          </label>
        </div>
        
        <select class="key-select" v-model="selectedKey">
          <option v-for="key in keyOptions" :key="key" :value="key">{{ key }}</option>
        </select>
      </div>
    </SettingSection>
    
    <SettingSection :title="t('settings.window')">
      <SettingItem :title="t('settings.showInSystemTray')">
        <ToggleSwitch v-model="configStore.config.alwaysOnTop" />  <!-- 需要后端实现 -->
      </SettingItem>
      <SettingItem :title="t('settings.alwaysOnTop')">
        <ToggleSwitch v-model="configStore.config.alwaysOnTop" @update:modelValue="configStore.toggleAlwaysOnTop" />
      </SettingItem>
    </SettingSection>
    
    <SettingSection :title="t('settings.bufferFiles')">
      <SettingItem :title="t('settings.useCustomLocation')">
        <ToggleSwitch v-model="configStore.config.alwaysOnTop" /> <!-- 需要后端实现 -->
      </SettingItem>
      <div class="directory-selector">
        <div class="path-display">{{ configStore.config.alwaysOnTop ? 'C:/Custom/Path' : 'Default Location' }}</div>
        <button class="select-button">{{ t('settings.selectDirectory') }}</button>
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
  
  .hotkey-modifiers {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
    flex-wrap: wrap;
    
    .modifier-label {
      cursor: pointer;
      
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
    
    &:focus {
      outline: none;
      border-color: #4a9eff;
    }
    
    option {
      background-color: #2a2a2a;
    }
  }
}

.directory-selector {
  margin-top: 10px;
  padding-left: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  
  .path-display {
    flex: 1;
    padding: 8px 12px;
    background-color: #3a3a3a;
    border: 1px solid #555555;
    border-radius: 4px;
    color: #b0b0b0;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .select-button {
    padding: 8px 12px;
    background-color: #3a3a3a;
    border: 1px solid #555555;
    border-radius: 4px;
    color: #e0e0e0;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s ease;
    white-space: nowrap;
    
    &:hover {
      background-color: #444444;
      border-color: #666666;
    }
    
    &:active {
      transform: translateY(1px);
    }
  }
}
</style> 