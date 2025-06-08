<script setup lang="ts">
import { useConfigStore } from '@/stores/configStore';
import { useErrorHandler } from '@/utils/errorHandler';
import { useI18n } from 'vue-i18n';
import { ref, computed, watch } from 'vue';
import SettingSection from '../components/SettingSection.vue';
import SettingItem from '../components/SettingItem.vue';
import type { ThemeType, SystemThemeType } from '@/types';
import { LanguageType } from '@/../bindings/voidraft/internal/models';
import { AVAILABLE_THEMES } from '@/types/theme';
import { useTheme } from '@/composables/useTheme';

const { t } = useI18n();
const configStore = useConfigStore();
const { safeCall } = useErrorHandler();
const { setTheme: setThemeComposable } = useTheme();

// 语言选项
const languageOptions = [
  { value: LanguageType.LangZhCN, label: t('languages.zh-CN') },
  { value: LanguageType.LangEnUS, label: t('languages.en-US') },
];

// 系统主题选项
const systemThemeOptions = [
  { value: 'dark' as SystemThemeType, label: t('systemTheme.dark') },
  { value: 'light' as SystemThemeType, label: t('systemTheme.light') },
  { value: 'auto' as SystemThemeType, label: t('systemTheme.auto') },
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

// 更新系统主题设置
const updateSystemTheme = async (event: Event) => {
  const select = event.target as HTMLSelectElement;
  const selectedSystemTheme = select.value as SystemThemeType;
  
  await safeCall(
    () => configStore.setSystemTheme(selectedSystemTheme),
    'config.systemThemeChangeFailed'
  );
};

// 主题选择
const themeOptions = computed(() => AVAILABLE_THEMES);
const selectedTheme = ref<ThemeType>(configStore.config.appearance.theme || 'default-dark' as ThemeType);

// 当前主题预览信息
const currentPreviewTheme = computed(() => {
  const theme = themeOptions.value.find(t => t.id === selectedTheme.value);
  return theme || themeOptions.value[0];
});

// 选择主题
const selectTheme = async (themeId: ThemeType) => {
  selectedTheme.value = themeId;
  
  // 更新配置（这会自动触发编辑器主题更新）
  await safeCall(
    () => configStore.setTheme(themeId),
    'config.themeChangeFailed'
  );

  // 同步更新预览（用于设置页面的预览区域）
  await setThemeComposable(themeId);
};

// 监听配置变化，同步主题选择
watch(() => configStore.config.appearance.theme, (newTheme) => {
  if (newTheme && newTheme !== selectedTheme.value) {
    selectedTheme.value = newTheme;
    setThemeComposable(newTheme);
  }
}, { immediate: true });
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
    
    <SettingSection :title="t('settings.systemTheme')">
      <SettingItem :title="t('settings.systemTheme')">
        <select class="select-input" :value="configStore.config.appearance.systemTheme" @change="updateSystemTheme">
          <option v-for="option in systemThemeOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </SettingItem>
    </SettingSection>
    
    <SettingSection :title="t('settings.appearance')">
      <div class="appearance-content">
        <div class="theme-selection-area">
          <div class="theme-selector">
            <div class="selector-label">{{ t('settings.theme') }}</div>
            <div class="theme-options">
              <div 
                v-for="theme in themeOptions" 
                :key="theme.id"
                class="theme-option"
                :class="{ active: selectedTheme === theme.id }"
                @click="selectTheme(theme.id)"
              >
                <div class="color-preview" :style="{ backgroundColor: theme.previewColors.background }"></div>
                <div class="theme-name">{{ theme.displayName }}</div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="preview-area">
          <div class="editor-preview" :style="{ backgroundColor: currentPreviewTheme.previewColors.background }">
            <div class="preview-header" :style="{ backgroundColor: currentPreviewTheme.previewColors.background, borderBottomColor: currentPreviewTheme.previewColors.foreground + '33' }">
              <div class="preview-title" :style="{ color: currentPreviewTheme.previewColors.foreground }">{{ currentPreviewTheme.displayName }} 预览</div>
            </div>
            <div class="preview-content" :style="{ color: currentPreviewTheme.previewColors.foreground }">
              <div class="preview-line">
                <span class="line-number" :style="{ color: currentPreviewTheme.previewColors.comment }">1</span>
                <span class="keyword" :style="{ color: currentPreviewTheme.previewColors.keyword }">function</span>
                <span>&nbsp;</span>
                <span class="function" :style="{ color: currentPreviewTheme.previewColors.function }">exampleFunc</span>() {
              </div>
              <div class="preview-line">
                <span class="line-number" :style="{ color: currentPreviewTheme.previewColors.comment }">2</span>
                <span>&nbsp;&nbsp;</span>
                <span class="keyword" :style="{ color: currentPreviewTheme.previewColors.keyword }">const</span>
                <span> hello = </span>
                <span class="string" :style="{ color: currentPreviewTheme.previewColors.string }">"你好，世界！"</span>;
              </div>
              <div class="preview-line">
                <span class="line-number" :style="{ color: currentPreviewTheme.previewColors.comment }">3</span>
                <span>&nbsp;&nbsp;</span>
                <span class="function" :style="{ color: currentPreviewTheme.previewColors.function }">console.log</span>(hello);
              </div>
              <div class="preview-line">
                <span class="line-number" :style="{ color: currentPreviewTheme.previewColors.comment }">4</span>
                <span>&nbsp;&nbsp;</span>
                <span class="comment" :style="{ color: currentPreviewTheme.previewColors.comment }">// 这是中文注释</span>
              </div>
              <div class="preview-line">
                <span class="line-number" :style="{ color: currentPreviewTheme.previewColors.comment }">5</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SettingSection>
  </div>
</template>

<style scoped lang="scss">
.settings-page {
  max-width: 1000px;
  padding-bottom: 48px;
}

.appearance-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
  
  @media (min-width: 768px) {
    flex-direction: row;
    gap: 32px;
  }
}

.theme-selection-area {
  flex: 1;
  min-width: 0;
}

.preview-area {
  flex: 0 0 400px;
  
  @media (max-width: 767px) {
    flex: none;
  }
}

.select-input {
  min-width: 150px;
  padding: 8px 12px;
  border: 1px solid var(--settings-input-border);
  border-radius: 4px;
  background-color: var(--settings-input-bg);
  color: var(--settings-text);
  font-size: 13px;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23666666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 8px center;
  background-size: 16px;
  padding-right: 30px;
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

.theme-selector {
  padding: 0;
  
  .selector-label {
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 15px;
    color: #e0e0e0;
  }
  
  .theme-options {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 16px;
    justify-content: start;
    
    .theme-option {
      cursor: pointer;
      transition: all 0.2s ease;
      
      .color-preview {
        height: 70px;
        border-radius: 6px;
        border: 2px solid transparent;
        transition: all 0.2s ease;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
        position: relative;
        
        &::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          opacity: 0;
          transition: opacity 0.2s ease;
        }
      }
      
      .theme-name {
        margin-top: 8px;
        font-size: 13px;
        text-align: center;
        color: #c0c0c0;
        font-weight: 500;
      }
      
      &:hover {
        transform: translateY(-2px);
        
        .color-preview {
          border-color: rgba(255, 255, 255, 0.4);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
          
          &::before {
            opacity: 1;
          }
        }
      }
      
      &.active {
        .color-preview {
          border-color: #4a9eff;
          box-shadow: 0 4px 20px rgba(74, 158, 255, 0.3);
          
          &::after {
            content: '✓';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #4a9eff;
            font-size: 18px;
            font-weight: bold;
            text-shadow: 0 0 4px rgba(74, 158, 255, 0.8);
          }
        }
        
        .theme-name {
          color: #4a9eff;
          font-weight: 600;
        }
      }
    }
  }
}

.editor-preview {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  width: 100%;
  max-width: 400px;
  
  .preview-header {
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    
    .preview-title {
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
      
      &::before {
        content: '🎨';
        font-size: 16px;
      }
    }
  }
  
  .preview-content {
    padding: 16px 0;
    font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.6;
    
    .preview-line {
      padding: 2px 16px;
      transition: background-color 0.2s ease;
      
      &:hover {
        background-color: rgba(255, 255, 255, 0.05);
      }
      
      .line-number {
        display: inline-block;
        width: 24px;
        margin-right: 12px;
        text-align: right;
        user-select: none;
        font-size: 12px;
        opacity: 0.7;
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