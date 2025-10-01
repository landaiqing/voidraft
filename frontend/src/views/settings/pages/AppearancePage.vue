<script setup lang="ts">
import { useConfigStore } from '@/stores/configStore';
import { useThemeStore } from '@/stores/themeStore';
import { useI18n } from 'vue-i18n';
import { computed, watch, onMounted, ref } from 'vue';
import SettingSection from '../components/SettingSection.vue';
import SettingItem from '../components/SettingItem.vue';
import { SystemThemeType, LanguageType } from '@/../bindings/voidraft/internal/models/models';
import { defaultDarkColors } from '@/views/editor/theme/dark';
import { defaultLightColors } from '@/views/editor/theme/light';
import { createDebounce } from '@/common/utils/debounce';
import { createTimerManager } from '@/common/utils/timerUtils';
import PickColors from 'vue-pick-colors';

const { t } = useI18n();
const configStore = useConfigStore();
const themeStore = useThemeStore();

// 创建防抖函数实例
const { debouncedFn: debouncedUpdateColor } = createDebounce(
  (colorKey: string, value: string) => updateLocalColor(colorKey, value),
  { delay: 100 }
);

const { debouncedFn: debouncedResetTheme } = createDebounce(
  async () => {
    const themeType = activeThemeType.value;
    const success = await themeStore.resetThemeColors(themeType);
    
    if (success) {
      tempColors.value = {
        darkTheme: { ...themeStore.themeColors.darkTheme },
        lightTheme: { ...themeStore.themeColors.lightTheme }
      };
      hasUnsavedChanges.value = false;
    }
  },
  { delay: 300 }
);

// 创建定时器管理器
const resetTimer = createTimerManager();

// 添加临时颜色状态
const tempColors = ref({
  darkTheme: { ...defaultDarkColors },
  lightTheme: { ...defaultLightColors }
});

// 标记是否有未保存的更改
const hasUnsavedChanges = ref(false);

// 重置按钮状态
const resetButtonState = ref({
  confirming: false
});

// 当前激活的主题类型
const isDarkMode = computed(() => 
  themeStore.currentTheme === SystemThemeType.SystemThemeDark || 
  (themeStore.currentTheme === SystemThemeType.SystemThemeAuto && 
   window.matchMedia('(prefers-color-scheme: dark)').matches)
);

const activeThemeType = computed(() => isDarkMode.value ? 'darkTheme' : 'lightTheme');

// 当前主题的颜色配置
const currentColors = computed(() => {
  const themeType = activeThemeType.value;
  return tempColors.value[themeType] || 
    (themeType === 'darkTheme' ? defaultDarkColors : defaultLightColors);
});

// 获取当前主题模式
const currentThemeMode = computed(() => isDarkMode.value ? 'dark' : 'light');

// 监听主题颜色变更，
watch(
  () => themeStore.themeColors,
  (newValue) => {
    if (!hasUnsavedChanges.value) {
      tempColors.value.darkTheme = { ...newValue.darkTheme };
      tempColors.value.lightTheme = { ...newValue.lightTheme };
    }
  },
  { deep: true, immediate: true }
);

onMounted(() => {
  tempColors.value = {
    darkTheme: { ...themeStore.themeColors.darkTheme },
    lightTheme: { ...themeStore.themeColors.lightTheme }
  };
});

// 颜色配置
const colorConfig = [
  {
    key: 'basic',
    colors: ['background', 'backgroundSecondary', 'surface']
  },
  {
    key: 'text', 
    colors: ['foreground', 'foregroundSecondary', 'comment']
  },
  {
    key: 'syntax',
    colors: ['keyword', 'string', 'function', 'number', 'operator', 'variable', 'type']
  },
  {
    key: 'interface',
    colors: ['cursor', 'selection', 'selectionBlur', 'activeLine', 'lineNumber', 'activeLineNumber']
  },
  {
    key: 'border',
    colors: ['borderColor', 'borderLight']
  },
  {
    key: 'search',
    colors: ['searchMatch', 'matchingBracket']
  }
];

// 颜色配置分组
const colorGroups = computed(() => 
  colorConfig.map(group => ({
    key: group.key,
    title: t(`settings.themeColors.${group.key}`),
    colors: group.colors.map(colorKey => ({
      key: colorKey,
      label: t(`settings.themeColors.${colorKey}`)
    }))
  }))
);

// 处理重置按钮点击
const handleResetClick = () => {
  if (resetButtonState.value.confirming) {

    debouncedResetTheme();

    resetButtonState.value.confirming = false;
    resetTimer.clear();
  } else {
    resetButtonState.value.confirming = true;
    // 设置3秒后自动恢复
    resetTimer.set(() => {
      resetButtonState.value.confirming = false;
    }, 3000);
  }
};

// 更新本地颜色配置
const updateLocalColor = (colorKey: string, value: string) => {
  const themeType = activeThemeType.value;
  
  // 更新临时颜色
  tempColors.value = {
    ...tempColors.value,
    [themeType]: {
      ...tempColors.value[themeType],
      [colorKey]: value
    }
  };

  hasUnsavedChanges.value = true;
};

// 应用颜色更改到系统
const applyChanges = async () => {
  try {
    // 获取当前主题的自定义颜色
    const customTheme = {
      darkTheme: tempColors.value.darkTheme,
      lightTheme: tempColors.value.lightTheme
    };
    
    // 更新themeStore中的颜色
    themeStore.updateThemeColors(customTheme.darkTheme, customTheme.lightTheme);
    
    // 保存到配置
    await themeStore.saveThemeColors();
    
    // 刷新编辑器主题
    themeStore.refreshEditorTheme();
    
    // 清除未保存标记
    hasUnsavedChanges.value = false;
  } catch (error) {
    console.error('Failed to apply theme change:', error);
  }
};

// 取消颜色更改
const cancelChanges = () => {
  // 恢复到themeStore中的颜色
  tempColors.value = {
    darkTheme: { ...themeStore.themeColors.darkTheme },
    lightTheme: { ...themeStore.themeColors.lightTheme }
  };
  
  // 清除未保存标记
  hasUnsavedChanges.value = false;
};

// 语言选项
const languageOptions = [
  { value: LanguageType.LangZhCN, label: t('languages.zh-CN') },
  { value: LanguageType.LangEnUS, label: t('languages.en-US') },
];

// 系统主题选项
const systemThemeOptions = [
  { value: SystemThemeType.SystemThemeDark, label: t('systemTheme.dark') },
  { value: SystemThemeType.SystemThemeLight, label: t('systemTheme.light') },
  { value: SystemThemeType.SystemThemeAuto, label: t('systemTheme.auto') },
];

// 更新语言设置
const updateLanguage = async (event: Event) => {
  const select = event.target as HTMLSelectElement;
  const selectedLanguage = select.value as LanguageType;
  
  await configStore.setLanguage(selectedLanguage);
};

// 更新系统主题设置
const updateSystemTheme = async (event: Event) => {
  const select = event.target as HTMLSelectElement;
  const selectedSystemTheme = select.value as SystemThemeType;
  
  await themeStore.setTheme(selectedSystemTheme);
};

// 控制颜色选择器显示状态
const showPickerMap = ref<Record<string, boolean>>({});

// 颜色变更处理
const handleColorChange = (colorKey: string, value: string) => {
  debouncedUpdateColor(colorKey, value);
};

// 颜色选择器关闭处理
const handlePickerClose = () => {
  // 可以在此添加额外的逻辑
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
    
    <SettingSection :title="t('settings.systemTheme')">
      <SettingItem :title="t('settings.systemTheme')">
        <select class="select-input" :value="configStore.config.appearance.systemTheme" @change="updateSystemTheme">
          <option v-for="option in systemThemeOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </SettingItem>
    </SettingSection>

    <!-- 自定义主题颜色配置 -->
    <SettingSection :title="t('settings.customThemeColors')">
      <template #title-right>
        <div class="theme-controls">
          <button 
            v-if="!hasUnsavedChanges" 
            :class="['reset-button', resetButtonState.confirming ? 'reset-button-confirming' : '']" 
            @click="handleResetClick"
          >
            {{ resetButtonState.confirming ? t('settings.confirmReset') : t('settings.resetToDefault') }}
          </button>
          <template v-else>
            <button class="apply-button" @click="applyChanges">
              {{ t('settings.apply') }}
            </button>
            <button class="cancel-button" @click="cancelChanges">
              {{ t('settings.cancel') }}
            </button>
          </template>
        </div>
      </template>
      
      <div class="color-groups">
        <div v-for="group in colorGroups" :key="group.key" class="color-group">
          <h4 class="group-title">{{ group.title }}</h4>
          <div class="color-items">
            <SettingItem 
              v-for="color in group.colors" 
              :key="color.key" 
              :title="color.label"
              class="color-setting-item"
            >
              <div class="color-input-wrapper">
                <div class="color-picker-wrapper">
                  <PickColors
                    v-model:value="currentColors[color.key]"
                    v-model:show-picker="showPickerMap[color.key]"
                    :size="28"
                    show-alpha
                    :theme="currentThemeMode"
                    :colors="[]"
                    format="hex"
                    :format-options="['rgb', 'hex', 'hsl', 'hsv']"
                    placement="bottom"
                    position="absolute"
                    :z-index="1000"
                    @change="(val) => handleColorChange(color.key, val)"
                    @close-picker="handlePickerClose"
                  />
                </div>
                <input 
                  type="text" 
                  :value="currentColors[color.key] || ''" 
                  @input="debouncedUpdateColor(color.key, ($event.target as HTMLInputElement).value)"
                  class="color-text-input"
                  :placeholder="t('settings.colorValue')"
                />
              </div>
            </SettingItem>
          </div>
        </div>
      </div>
    </SettingSection>
  </div>
</template>

<style scoped lang="scss">
.settings-page {
  max-width: 1000px;
}

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

// 主题控制区域
.theme-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

// 主题颜色配置样式
.reset-button, .apply-button, .cancel-button {
  padding: 6px 12px;
  font-size: 12px;
  border: 1px solid var(--settings-input-border);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #4a9eff;
  }
  
  &:active {
    transform: translateY(1px);
  }
}

.reset-button {
  background-color: var(--settings-button-bg);
  color: var(--settings-button-text);
  
  &:hover {
    background-color: var(--settings-button-hover-bg);
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

.apply-button {
  background-color: #4a9eff;
  color: white;
  font-weight: 500;
  
  &:hover {
    background-color: #3a8eef;
  }
}

.cancel-button {
  background-color: var(--settings-button-bg);
  color: var(--settings-button-text);
  
  &:hover {
    background-color: var(--settings-button-hover-bg);
  }
}

.color-groups {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.color-group {
  .group-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--settings-text);
    margin: 0 0 12px 0;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--settings-input-border);
  }
  
  .color-items {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 8px;
  }
}

.color-setting-item {
  :deep(.setting-item-content) {
    align-items: center;
  }
  
  :deep(.setting-item-title) {
    font-size: 12px;
    min-width: 120px;
  }
}

.color-input-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.color-picker-wrapper {
  display: flex;
  align-items: center;
  height: 28px;
  cursor: pointer;
  
  :deep(.pick-colors-trigger) {
    border: 1px solid var(--settings-input-border);
    border-radius: 4px;
    overflow: hidden;
  }
}

.color-text-input {
  flex: 1;
  min-width: 160px;
  padding: 4px 8px;
  border: 1px solid var(--settings-input-border);
  border-radius: 4px;
  background-color: var(--settings-input-bg);
  color: var(--settings-text);
  font-size: 11px;
  font-family: 'Courier New', monospace;
  transition: border-color 0.2s ease;
  height: 28px;
  box-sizing: border-box;
  
  &:focus {
    outline: none;
    border-color: #4a9eff;
  }
  
  &::placeholder {
    color: var(--settings-text-secondary);
  }
}
</style>