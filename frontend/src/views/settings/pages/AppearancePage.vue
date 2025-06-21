<script setup lang="ts">
import { useConfigStore } from '@/stores/configStore';
import { useThemeStore } from '@/stores/themeStore';
import { useErrorHandler } from '@/utils/errorHandler';
import { useI18n } from 'vue-i18n';
import SettingSection from '../components/SettingSection.vue';
import SettingItem from '../components/SettingItem.vue';
import { SystemThemeType, LanguageType } from '@/../bindings/voidraft/internal/models/models';

const { t } = useI18n();
const configStore = useConfigStore();
const themeStore = useThemeStore();
const { safeCall } = useErrorHandler();

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
    () => themeStore.setTheme(selectedSystemTheme),
    'config.systemThemeChangeFailed'
  );
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
</style> 