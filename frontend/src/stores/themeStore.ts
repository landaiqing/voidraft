import { defineStore } from 'pinia';
import { computed, watch } from 'vue';
import { SystemThemeType } from '@/../bindings/voidraft/internal/models/models';
import { useConfigStore } from './configStore';

/**
 * 主题管理 Store
 * 职责：
 */
export const useThemeStore = defineStore('theme', () => {
  const configStore = useConfigStore();
  
  const currentTheme = computed(() => 
    configStore.config?.appearance?.systemTheme || SystemThemeType.SystemThemeAuto
  );


  // 应用主题到 DOM
  const applyThemeToDOM = (theme: SystemThemeType) => {
    document.documentElement.setAttribute('data-theme', 
      theme === SystemThemeType.SystemThemeAuto ? 'auto' :
      theme === SystemThemeType.SystemThemeDark ? 'dark' : 'light'
    );
  };

  // 设置主题
  const setTheme = async (theme: SystemThemeType) => {
    await configStore.setSystemTheme(theme);
    applyThemeToDOM(theme);
  };

  return {
    currentTheme,
    setTheme,
  };
}); 