<script setup lang="ts">
import { useConfigStore } from '@/stores/configStore';
import { useI18n } from 'vue-i18n';
import {computed, onMounted } from 'vue';
import SettingSection from '../components/SettingSection.vue';
import SettingItem from '../components/SettingItem.vue';
import ToggleSwitch from '../components/ToggleSwitch.vue';
import { TabType } from '@/../bindings/voidraft/internal/models/';

const { t } = useI18n();
const configStore = useConfigStore();

// 确保配置已加载
onMounted(async () => {
  if (!configStore.configLoaded) {
    await configStore.initConfig();
  }
});

// 字体选择选项
const fontFamilyOptions = computed(() => configStore.localizedFontOptions);
const currentFontFamily = computed(() => configStore.config.editing.fontFamily);

// 字体选择
const handleFontFamilyChange = async (event: Event) => {
  const target = event.target as HTMLSelectElement;
  const fontFamily = target.value;
  if (fontFamily) {
    await configStore.setFontFamily(fontFamily);
  }
};

// 字体粗细选项
const fontWeightOptions = [
  { value: '100', label: t('settings.fontWeights.100') },
  { value: '200', label: t('settings.fontWeights.200') },
  { value: '300', label: t('settings.fontWeights.300') },
  { value: 'normal', label: t('settings.fontWeights.normal') },
  { value: '500', label: t('settings.fontWeights.500') },
  { value: '600', label: t('settings.fontWeights.600') },
  { value: 'bold', label: t('settings.fontWeights.bold') },
  { value: '800', label: t('settings.fontWeights.800') },
  { value: '900', label: t('settings.fontWeights.900') }
];

// 字体粗细选择
const handleFontWeightChange = async (event: Event) => {
  const target = event.target as HTMLSelectElement;
  await configStore.setFontWeight(target.value);
};

// 行高控制
const increaseLineHeight = async () => {
  const newLineHeight = Math.min(3.0, configStore.config.editing.lineHeight + 0.1);
  await configStore.setLineHeight(Math.round(newLineHeight * 10) / 10);
};

const decreaseLineHeight = async () => {
  const newLineHeight = Math.max(1.0, configStore.config.editing.lineHeight - 0.1);
  await configStore.setLineHeight(Math.round(newLineHeight * 10) / 10);
};

// 字体大小控制
const increaseFontSize = async () => {
  await configStore.increaseFontSize();
};

const decreaseFontSize = async () => {
  await configStore.decreaseFontSize();
};

// Tab类型切换
const tabTypeText = computed(() => {
  return configStore.config.editing.tabType === TabType.TabTypeSpaces 
    ? t('settings.spaces') 
    : t('settings.tabs');
});

// Tab大小增减
const increaseTabSize = async () => {
  await configStore.increaseTabSize();
};

const decreaseTabSize = async () => {
  await configStore.decreaseTabSize();
};

// Tab相关操作
const handleToggleTabType = async () => {
  await configStore.toggleTabType();
};

// 创建双向绑定的计算属性
const enableTabIndent = computed({
  get: () => configStore.config.editing.enableTabIndent,
  set: async (value: boolean) => {
    await configStore.setEnableTabIndent(value);
  }
});

// 保存选项处理器
const handleAutoSaveDelayChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const value = parseInt(target.value, 10);
  if (!isNaN(value) && value >= 1000 && value <= 30000) {
    await configStore.setAutoSaveDelay(value);
  }
};


</script>

<template>
  <div class="settings-page">
    <SettingSection :title="t('settings.fontSettings')">
      <SettingItem 
        :title="t('settings.fontFamily')" 
        :description="t('settings.fontFamilyDescription')"
      >
        <select 
          class="font-family-select" 
          :value="currentFontFamily"
          @change="handleFontFamilyChange"
        >
          <option 
            v-for="option in fontFamilyOptions" 
            :key="option.value" 
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </SettingItem>

      <SettingItem 
        :title="t('settings.fontSize')" 
        :description="t('settings.fontSizeDescription')"
      >
        <div class="number-control">
          <button @click="decreaseFontSize" class="control-button">-</button>
          <span>{{ configStore.config.editing.fontSize }}px</span>
          <button @click="increaseFontSize" class="control-button">+</button>
        </div>
      </SettingItem>

      <SettingItem 
        :title="t('settings.fontWeight')" 
        :description="t('settings.fontWeightDescription')"
      >
        <select 
          class="font-weight-select" 
          :value="configStore.config.editing.fontWeight"
          @change="handleFontWeightChange"
        >
          <option 
            v-for="option in fontWeightOptions" 
            :key="option.value" 
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </SettingItem>

      <SettingItem 
        :title="t('settings.lineHeight')" 
        :description="t('settings.lineHeightDescription')"
      >
        <div class="number-control">
          <button @click="decreaseLineHeight" class="control-button">-</button>
          <span>{{ configStore.config.editing.lineHeight.toFixed(1) }}</span>
          <button @click="increaseLineHeight" class="control-button">+</button>
        </div>
      </SettingItem>


    </SettingSection>
    
    <SettingSection :title="t('settings.tabSettings')">
      <SettingItem :title="t('settings.enableTabIndent')">
        <ToggleSwitch 
          v-model="enableTabIndent"
        />
      </SettingItem>
      
      <SettingItem :title="t('settings.tabSize')" :class="{ 'disabled-setting': !enableTabIndent }">
        <div class="number-control" :class="{ 'disabled': !enableTabIndent }">
          <button 
            @click="decreaseTabSize" 
            class="control-button" 
            :disabled="!enableTabIndent || configStore.config.editing.tabSize <= configStore.tabSize.min"
          >-</button>
          <span>{{ configStore.config.editing.tabSize }}</span>
          <button 
            @click="increaseTabSize" 
            class="control-button" 
            :disabled="!enableTabIndent || configStore.config.editing.tabSize >= configStore.tabSize.max"
          >+</button>
        </div>
      </SettingItem>
      
      <SettingItem :title="t('settings.tabType')" :class="{ 'disabled-setting': !enableTabIndent }">
        <button 
          class="tab-type-toggle" 
          :class="{ 'disabled': !enableTabIndent }"
          :disabled="!enableTabIndent"
          @click="handleToggleTabType"
        >
          {{ tabTypeText }}
        </button>
      </SettingItem>
    </SettingSection>
    
    <SettingSection :title="t('settings.saveOptions')">
      <SettingItem :title="t('settings.autoSaveDelay')">
        <input 
          type="number" 
          class="number-input" 
          :value="configStore.config.editing.autoSaveDelay"
          @change="handleAutoSaveDelayChange"
        />
      </SettingItem>
    </SettingSection>
  </div>
</template>

<style scoped lang="scss">
.settings-page {
  max-width: 800px;
}

.number-control {
  display: flex;
  align-items: center;
  gap: 8px;
  
  .control-button {
    width: 28px;
    height: 28px;
    border: 1px solid var(--settings-input-border);
    background-color: var(--settings-input-bg);
    color: var(--settings-text);
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    transition: all 0.2s ease;
    
    &:hover:not(:disabled) {
      background-color: var(--settings-hover);
      border-color: var(--settings-border);
    }
    
    &:active:not(:disabled) {
      transform: translateY(1px);
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
  
  span {
    min-width: 50px;
    text-align: center;
    font-size: 12px;
    color: var(--settings-text);
    background-color: var(--settings-input-bg);
    border: 1px solid var(--settings-input-border);
    border-radius: 4px;
    padding: 5px 8px;
  }
}



.font-family-select,
.font-weight-select {
  min-width: 180px;
  padding: 8px 12px;
  border: 1px solid var(--settings-input-border);
  border-radius: 4px;
  background-color: var(--settings-input-bg);
  color: var(--settings-text);
  font-size: 12px;
  cursor: pointer;
  
  &:focus {
    outline: none;
    border-color: #4a9eff;
  }
  
  &:hover {
    border-color: var(--settings-border);
  }
  
  option {
    background-color: var(--settings-input-bg);
    color: var(--settings-text);
    padding: 4px 8px;
  }
}

.tab-type-toggle {
  min-width: 100px;
  padding: 8px 15px;
  background-color: var(--settings-input-bg);
  border: 1px solid var(--settings-input-border);
  border-radius: 4px;
  color: var(--settings-text);
  cursor: pointer;
  font-size: 12px;
  text-align: center;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: var(--settings-hover);
    border-color: var(--settings-border);
  }
  
  &:active {
    transform: translateY(1px);
  }
}

.number-input {
  width: 100px;
  padding: 8px 12px;
  border: 1px solid var(--settings-input-border);
  border-radius: 4px;
  background-color: var(--settings-input-bg);
  color: var(--settings-text);
  font-size: 12px;
  
  &:focus {
    outline: none;
    border-color: #4a9eff;
  }
  
  &:hover {
    border-color: var(--settings-border);
  }
  
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    background-color: var(--settings-hover);
    color: var(--text-muted);
  }
}

// 禁用状态样式
.disabled-setting {
  opacity: 0.6;
  pointer-events: none;
}

.number-control.disabled {
  opacity: 0.5;
  
  .control-button {
    cursor: not-allowed;
    
    &:hover {
      background-color: var(--settings-input-bg);
      border-color: var(--settings-input-border);
    }
  }
  
  span {
    opacity: 0.7;
  }
}

.tab-type-toggle.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  
  &:hover {
    background-color: var(--settings-input-bg);
    border-color: var(--settings-input-border);
    transform: none;
  }
  
  &:active {
    transform: none;
  }
}
</style> 