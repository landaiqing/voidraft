<script setup lang="ts">
import { useConfigStore } from '@/stores/configStore';
import { FONT_OPTIONS } from '@/stores/configStore';
import { useErrorHandler } from '@/utils/errorHandler';
import { useI18n } from 'vue-i18n';
import { ref, computed, onMounted } from 'vue';
import SettingSection from '../components/SettingSection.vue';
import SettingItem from '../components/SettingItem.vue';
import ToggleSwitch from '../components/ToggleSwitch.vue';
import { TabType } from '../../../../bindings/voidraft/internal/models/models';

const { t } = useI18n();
const configStore = useConfigStore();
const { safeCall } = useErrorHandler();

// 确保配置已加载
onMounted(async () => {
  if (!configStore.configLoaded) {
    await configStore.initConfig();
  }
});

// 字体选择选项
const fontFamilyOptions = FONT_OPTIONS;
const currentFontFamily = computed(() => configStore.config.editing.fontFamily);

// 字体选择
const handleFontFamilyChange = async (event: Event) => {
  const target = event.target as HTMLSelectElement;
  const fontFamily = target.value;
  if (fontFamily) {
    await safeCall(
      () => configStore.setFontFamily(fontFamily),
      'config.fontFamilyUpdateFailed'
    );
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
const handleFontWeightChange = async (event: Event) => {
  const target = event.target as HTMLSelectElement;
  await safeCall(
    () => configStore.setFontWeight(target.value),
    'config.fontWeightUpdateFailed'
  );
};

// 行高控制
const increaseLineHeight = async () => {
  const newLineHeight = Math.min(3.0, configStore.config.editing.lineHeight + 0.1);
  await safeCall(
    () => configStore.setLineHeight(Math.round(newLineHeight * 10) / 10),
    'config.lineHeightIncreaseFailed'
  );
};

const decreaseLineHeight = async () => {
  const newLineHeight = Math.max(1.0, configStore.config.editing.lineHeight - 0.1);
  await safeCall(
    () => configStore.setLineHeight(Math.round(newLineHeight * 10) / 10),
    'config.lineHeightDecreaseFailed'
  );
};

// 字体大小控制
const increaseFontSize = async () => {
  await safeCall(
    () => configStore.increaseFontSize(),
    'config.fontSizeIncreaseFailed'
  );
};

const decreaseFontSize = async () => {
  await safeCall(
    () => configStore.decreaseFontSize(),
    'config.fontSizeDecreaseFailed'
  );
};

// Tab类型切换
const tabTypeText = computed(() => {
  return configStore.config.editing.tabType === TabType.TabTypeSpaces 
    ? t('settings.spaces') 
    : t('settings.tabs');
});

// Tab大小增减
const increaseTabSize = async () => {
  await safeCall(
    () => configStore.increaseTabSize(),
    'config.tabSizeIncreaseFailed'
  );
};

const decreaseTabSize = async () => {
  await safeCall(
    () => configStore.decreaseTabSize(),
    'config.tabSizeDecreaseFailed'
  );
};

// Tab相关操作
const handleToggleTabIndent = async () => {
  await safeCall(
    () => configStore.toggleTabIndent(),
    'config.tabIndentToggleFailed'
  );
};

const handleToggleTabType = async () => {
  await safeCall(
    () => configStore.toggleTabType(),
    'config.tabTypeToggleFailed'
  );
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

      <div class="font-preview" :style="{ 
        fontSize: `${configStore.config.editing.fontSize}px`,
        fontFamily: configStore.config.editing.fontFamily,
        fontWeight: configStore.config.editing.fontWeight,
        lineHeight: configStore.config.editing.lineHeight
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
          <button @click="decreaseTabSize" class="control-button" :disabled="configStore.config.editing.tabSize <= configStore.tabSize.min">-</button>
          <span>{{ configStore.config.editing.tabSize }}</span>
          <button @click="increaseTabSize" class="control-button" :disabled="configStore.config.editing.tabSize >= configStore.tabSize.max">+</button>
        </div>
      </SettingItem>
      
      <SettingItem :title="t('settings.tabType')">
        <button class="tab-type-toggle" @click="handleToggleTabType">
          {{ tabTypeText }}
        </button>
      </SettingItem>
      
      <SettingItem :title="t('settings.enableTabIndent')">
        <ToggleSwitch 
          v-model="configStore.config.editing.enableTabIndent" 
          @update:modelValue="handleToggleTabIndent"
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

.font-family-select,
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