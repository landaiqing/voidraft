<script setup lang="ts">
import { useConfigStore } from '@/stores/configStore';
import { useErrorHandler } from '@/utils/errorHandler';
import { useI18n } from 'vue-i18n';
import { ref } from 'vue';
import SettingSection from '../components/SettingSection.vue';
import SettingItem from '../components/SettingItem.vue';
import { LanguageType } from '../../../../bindings/voidraft/internal/models/models';

const { t } = useI18n();
const configStore = useConfigStore();
const { safeCall } = useErrorHandler();

// 语言选项
const languageOptions = [
  { value: LanguageType.LangZhCN, label: t('languages.zh-CN') },
  { value: LanguageType.LangEnUS, label: t('languages.en-US') },
];

// 更新语言设置
const updateLanguage = async (event: Event) => {
  const select = event.target as HTMLSelectElement;
  const selectedLanguage = select.value as LanguageType;
  
  await safeCall(
    () => configStore.setLanguage(selectedLanguage),
    'config.languageChangeFailed'
  );
};

// 主题选择（未实际实现，仅界面展示）
const themeOptions = [
  { id: 'dark', name: '深色', color: '#2a2a2a' },
  { id: 'darker', name: '暗黑', color: '#1a1a1a' },
  { id: 'light', name: '浅色', color: '#f5f5f5' },
  { id: 'blue', name: '蓝调', color: '#1e3a5f' },
];

const selectedTheme = ref('dark');

const selectTheme = (themeId: string) => {
  selectedTheme.value = themeId;
};
</script>

<template>
  <div class="settings-page">
    <SettingSection :title="t('settings.language')">
      <SettingItem :title="t('settings.language')">
        <select class="select-input" :value="configStore.config.appearance.language" @change="updateLanguage">
          <option v-for="option in languageOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </SettingItem>
    </SettingSection>
    
    <SettingSection :title="t('settings.appearance')">
      <div class="theme-selector">
        <div class="selector-label">主题</div>
        <div class="theme-options">
          <div 
            v-for="theme in themeOptions" 
            :key="theme.id"
            class="theme-option"
            :class="{ active: selectedTheme === theme.id }"
            @click="selectTheme(theme.id)"
          >
            <div class="color-preview" :style="{ backgroundColor: theme.color }"></div>
            <div class="theme-name">{{ theme.name }}</div>
          </div>
        </div>
      </div>
      
      <div class="editor-preview">
        <div class="preview-header">
          <div class="preview-title">预览</div>
        </div>
        <div class="preview-content">
          <div class="preview-line"><span class="line-number">1</span><span class="keyword">function</span> <span class="function">example</span>() {</div>
          <div class="preview-line"><span class="line-number">2</span>  <span class="keyword">const</span> greeting = <span class="string">"Hello, World!"</span>;</div>
          <div class="preview-line"><span class="line-number">3</span>  <span class="function">console.log</span>(greeting);</div>
          <div class="preview-line"><span class="line-number">4</span>}</div>
        </div>
      </div>
    </SettingSection>
  </div>
</template>

<style scoped lang="scss">
.settings-page {
  max-width: 800px;
}

.select-input {
  min-width: 150px;
  padding: 8px 12px;
  border: 1px solid #555555;
  border-radius: 4px;
  background-color: #3a3a3a;
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

.theme-selector {
  padding: 15px 16px;
  
  .selector-label {
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 15px;
    color: #e0e0e0;
  }
  
  .theme-options {
    display: flex;
    gap: 15px;
    flex-wrap: wrap;
    
    .theme-option {
      width: 100px;
      cursor: pointer;
      transition: all 0.2s ease;
      
      .color-preview {
        height: 60px;
        border-radius: 4px;
        border: 2px solid transparent;
        transition: all 0.2s ease;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }
      
      .theme-name {
        margin-top: 6px;
        font-size: 13px;
        text-align: center;
        color: #c0c0c0;
      }
      
      &:hover .color-preview {
        border-color: rgba(255, 255, 255, 0.3);
      }
      
      &.active .color-preview {
        border-color: #4a9eff;
      }
      
      &.active .theme-name {
        color: #ffffff;
      }
    }
  }
}

.editor-preview {
  margin: 20px 16px;
  background-color: #252525;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
  
  .preview-header {
    padding: 10px 16px;
    background-color: #353535;
    border-bottom: 1px solid #444444;
    
    .preview-title {
      font-size: 13px;
      color: #b0b0b0;
    }
  }
  
  .preview-content {
    padding: 12px 0;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 14px;
    
    .preview-line {
      padding: 3px 16px;
      line-height: 1.5;
      white-space: pre;
      
      &:hover {
        background-color: rgba(255, 255, 255, 0.03);
      }
      
      .line-number {
        color: #707070;
        display: inline-block;
        width: 25px;
        margin-right: 15px;
        text-align: right;
        user-select: none;
      }
      
      .keyword {
        color: #569cd6;
      }
      
      .function {
        color: #dcdcaa;
      }
      
      .string {
        color: #ce9178;
      }
    }
  }
}

.coming-soon-placeholder {
  padding: 20px;
  background-color: #333333;
  border-radius: 6px;
  color: #a0a0a0;
  text-align: center;
  font-style: italic;
  font-size: 14px;
}
</style> 