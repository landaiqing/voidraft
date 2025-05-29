<script setup lang="ts">
import { useConfigStore } from '@/stores/configStore';
import { useI18n } from 'vue-i18n';
import { ref, computed } from 'vue';
import SettingSection from '../components/SettingSection.vue';
import SettingItem from '../components/SettingItem.vue';
import ToggleSwitch from '../components/ToggleSwitch.vue';
import { TabType } from '@/../bindings/voidraft/internal/models/models';
import { getFontPresetOptions, type FontPresetKey } from '@/editor/extensions/fontExtension';

const { t } = useI18n();
const configStore = useConfigStore();

// 字体预设选项
const fontPresetOptions = getFontPresetOptions();
const currentFontPreset = computed(() => configStore.getCurrentFontPreset());

// 字体预设选择
const handleFontPresetChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  const presetKey = target.value;
  if (presetKey && presetKey !== 'custom') {
    configStore.setFontPreset(presetKey as FontPresetKey);
  }
};

// 字体粗细选项
const fontWeightOptions = [
  { value: '100', label: '极细 (100)' },
  { value: '200', label: '超细 (200)' },
  { value: '300', label: '细 (300)' },
  { value: 'normal', label: '正常 (400)' },
  { value: '500', label: '中等 (500)' },
  { value: '600', label: '半粗 (600)' },
  { value: 'bold', label: '粗体 (700)' },
  { value: '800', label: '超粗 (800)' },
  { value: '900', label: '极粗 (900)' }
];

// 字体粗细选择
const handleFontWeightChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  configStore.setFontWeight(target.value);
};

// 行高控制
const increaseLineHeight = () => {
  const newLineHeight = Math.min(3.0, configStore.config.lineHeight + 0.1);
  configStore.setLineHeight(Math.round(newLineHeight * 10) / 10);
};

const decreaseLineHeight = () => {
  const newLineHeight = Math.max(1.0, configStore.config.lineHeight - 0.1);
  configStore.setLineHeight(Math.round(newLineHeight * 10) / 10);
};

// 字体大小控制
const increaseFontSize = () => {
  configStore.increaseFontSize();
};

const decreaseFontSize = () => {
  configStore.decreaseFontSize();
};

// Tab类型切换
const tabTypeText = computed(() => {
  return configStore.config.tabType === TabType.TabTypeSpaces 
    ? t('settings.spaces') 
    : t('settings.tabs');
});

// Tab大小增减
const increaseTabSize = () => {
  configStore.increaseTabSize();
};

const decreaseTabSize = () => {
  configStore.decreaseTabSize();
};
</script>

<template>
  <div class="settings-page">
    <SettingSection :title="t('settings.fontSettings')">
      <SettingItem 
        :title="t('settings.fontPreset')" 
        :description="t('settings.fontPresetDescription')"
      >
        <select 
          class="font-preset-select" 
          :value="currentFontPreset || 'custom'"
          @change="handleFontPresetChange"
        >
          <option value="custom">自定义</option>
          <option 
            v-for="option in fontPresetOptions" 
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
          <span>{{ configStore.config.fontSize }}px</span>
          <button @click="increaseFontSize" class="control-button">+</button>
        </div>
      </SettingItem>

      <SettingItem 
        :title="t('settings.fontWeight')" 
        :description="t('settings.fontWeightDescription')"
      >
        <select 
          class="font-weight-select" 
          :value="configStore.config.fontWeight"
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
          <span>{{ configStore.config.lineHeight.toFixed(1) }}</span>
          <button @click="increaseLineHeight" class="control-button">+</button>
        </div>
      </SettingItem>

      <div class="font-preview" :style="{ 
        fontSize: `${configStore.config.fontSize}px`,
        fontFamily: configStore.config.fontFamily,
        fontWeight: configStore.config.fontWeight,
        lineHeight: configStore.config.lineHeight
      }">
        <div class="preview-label">字体预览</div>
        <div class="preview-text">
          <span>function example() {</span>
          <span class="indent">console.log("Hello, 世界!");</span>
          <span class="indent">const message = "鸿蒙字体测试";</span>
          <span>}</span>
        </div>
      </div>
    </SettingSection>
    
    <SettingSection :title="t('settings.tabSettings')">
      <SettingItem :title="t('settings.tabSize')">
        <div class="number-control">
          <button @click="decreaseTabSize" class="control-button" :disabled="configStore.config.tabSize <= configStore.MIN_TAB_SIZE">-</button>
          <span>{{ configStore.config.tabSize }}</span>
          <button @click="increaseTabSize" class="control-button" :disabled="configStore.config.tabSize >= configStore.MAX_TAB_SIZE">+</button>
        </div>
      </SettingItem>
      
      <SettingItem :title="t('settings.tabType')">
        <button class="tab-type-toggle" @click="configStore.toggleTabType">
          {{ tabTypeText }}
        </button>
      </SettingItem>
      
      <SettingItem :title="t('settings.enableTabIndent')">
        <ToggleSwitch 
          v-model="configStore.config.enableTabIndent" 
          @update:modelValue="configStore.toggleTabIndent"
        />
      </SettingItem>
    </SettingSection>
    
    <SettingSection :title="t('settings.saveOptions')">
      <SettingItem :title="t('settings.autoSaveDelay')" :description="'单位：毫秒'">
        <input 
          type="number" 
          class="number-input" 
          disabled
          :value="5000"
        />
      </SettingItem>
      
      <SettingItem :title="t('settings.changeThreshold')" :description="'变更字符超过此阈值时触发保存'">
        <input 
          type="number" 
          class="number-input" 
          disabled
          :value="500"
        />
      </SettingItem>
      
      <SettingItem :title="t('settings.minSaveInterval')" :description="'单位：毫秒'">
        <input 
          type="number" 
          class="number-input" 
          disabled
          :value="1000"
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
  gap: 10px;
  
  .control-button {
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #3a3a3a;
    border: 1px solid #555555;
    border-radius: 4px;
    color: #e0e0e0;
    cursor: pointer;
    font-size: 16px;
    transition: all 0.2s ease;
    
    &:hover:not(:disabled) {
      background-color: #444444;
      border-color: #666666;
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
    font-size: 14px;
    color: #e0e0e0;
    background-color: #3a3a3a;
    border: 1px solid #555555;
    border-radius: 4px;
    padding: 5px 8px;
  }
}

.font-size-preview {
  margin: 15px 0 5px 20px;
  padding: 15px;
  background-color: #252525;
  border: 1px solid #444444;
  border-radius: 4px;
  font-family: 'Consolas', 'Courier New', monospace;
  
  .preview-label {
    font-size: 12px;
    color: #888888;
    margin-bottom: 8px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  
  .preview-text {
    display: flex;
    flex-direction: column;
    
    span {
      line-height: 1.4;
      color: #d0d0d0;
    }
    
    .indent {
      padding-left: 20px;
      color: #4a9eff;
    }
  }
}

.font-preview {
  margin: 15px 0 5px 20px;
  padding: 15px;
  background-color: #252525;
  border: 1px solid #444444;
  border-radius: 4px;
  
  .preview-label {
    font-size: 12px;
    color: #888888;
    margin-bottom: 8px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  
  .preview-text {
    display: flex;
    flex-direction: column;
    
    span {
      color: #d0d0d0;
    }
    
    .indent {
      padding-left: 20px;
      color: #4a9eff;
    }
  }
}

.font-preset-select,
.font-weight-select {
  min-width: 180px;
  padding: 8px 12px;
  border: 1px solid #555555;
  border-radius: 4px;
  background-color: #3a3a3a;
  color: #e0e0e0;
  font-size: 13px;
  cursor: pointer;
  
  &:focus {
    outline: none;
    border-color: #4a9eff;
  }
  
  &:hover {
    border-color: #666666;
  }
  
  option {
    background-color: #3a3a3a;
    color: #e0e0e0;
    padding: 4px 8px;
  }
}

.tab-type-toggle {
  min-width: 100px;
  padding: 8px 15px;
  background-color: #3a3a3a;
  border: 1px solid #555555;
  border-radius: 4px;
  color: #e0e0e0;
  cursor: pointer;
  font-size: 13px;
  text-align: center;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: #444444;
    border-color: #666666;
  }
  
  &:active {
    transform: translateY(1px);
  }
}

.number-input {
  width: 100px;
  padding: 8px 12px;
  border: 1px solid #555555;
  border-radius: 4px;
  background-color: #3a3a3a;
  color: #a0a0a0;
  font-size: 13px;
  
  &:focus {
    outline: none;
    border-color: #4a9eff;
  }
  
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
}
</style> 