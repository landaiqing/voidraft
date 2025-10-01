import { defineStore } from 'pinia';
import { computed, reactive } from 'vue';
import { SystemThemeType, ThemeType, ThemeColorConfig } from '@/../bindings/voidraft/internal/models/models';
import { ThemeService } from '@/../bindings/voidraft/internal/services';
import { useConfigStore } from './configStore';
import { useEditorStore } from './editorStore';
import { defaultDarkColors } from '@/views/editor/theme/dark';
import { defaultLightColors } from '@/views/editor/theme/light';

/**
 * 主题管理 Store
 * 职责：管理主题状态和颜色配置
 */
export const useThemeStore = defineStore('theme', () => {
  const configStore = useConfigStore();
  
  // 响应式状态
  const themeColors = reactive({
    darkTheme: { ...defaultDarkColors },
    lightTheme: { ...defaultLightColors }
  });
  
  // 计算属性
  const currentTheme = computed(() => 
    configStore.config?.appearance?.systemTheme || SystemThemeType.SystemThemeAuto
  );

  // 获取默认主题颜色
  const getDefaultColors = (themeType: ThemeType) => 
    themeType === ThemeType.ThemeTypeDark ? defaultDarkColors : defaultLightColors;

  // 应用主题到 DOM
  const applyThemeToDOM = (theme: SystemThemeType) => {
    const themeMap = {
      [SystemThemeType.SystemThemeAuto]: 'auto',
      [SystemThemeType.SystemThemeDark]: 'dark',
      [SystemThemeType.SystemThemeLight]: 'light'
    };
    document.documentElement.setAttribute('data-theme', themeMap[theme]);
  };

  // 初始化主题颜色
  const initializeThemeColors = async () => {
    try {
      const themes = await ThemeService.GetDefaultThemes();
      
      // 如果没有获取到主题数据，使用默认值
      if (!themes) {
        Object.assign(themeColors.darkTheme, defaultDarkColors);
        Object.assign(themeColors.lightTheme, defaultLightColors);
        return;
      }

      // 更新主题颜色
      if (themes[ThemeType.ThemeTypeDark]) {
        Object.assign(themeColors.darkTheme, themes[ThemeType.ThemeTypeDark].colors);
      }
      if (themes[ThemeType.ThemeTypeLight]) {
        Object.assign(themeColors.lightTheme, themes[ThemeType.ThemeTypeLight].colors);
      }
    } catch (error) {
      console.warn('Failed to load themes from database, using defaults:', error);
      // 如果数据库加载失败，使用默认主题
      Object.assign(themeColors.darkTheme, defaultDarkColors);
      Object.assign(themeColors.lightTheme, defaultLightColors);
    }
  };

  // 初始化主题
  const initializeTheme = async () => {
    const theme = currentTheme.value;
    applyThemeToDOM(theme);
    await initializeThemeColors();
  };

  // 设置主题
  const setTheme = async (theme: SystemThemeType) => {
    await configStore.setSystemTheme(theme);
    applyThemeToDOM(theme);
    refreshEditorTheme();
  };
  
  // 更新主题颜色 - 合并逻辑，减少重复代码
  const updateThemeColors = (darkColors?: any, lightColors?: any): boolean => {
    let hasChanges = false;
    
    const updateColors = (target: any, source: any) => {
      if (!source) return false;
      
      let changed = false;
      Object.entries(source).forEach(([key, value]) => {
        if (value !== undefined && target[key] !== value) {
          target[key] = value;
          changed = true;
        }
      });
      return changed;
    };
    
    hasChanges = updateColors(themeColors.darkTheme, darkColors) || hasChanges;
    hasChanges = updateColors(themeColors.lightTheme, lightColors) || hasChanges;
    
    return hasChanges;
  };
  
  // 保存主题颜色到数据库
  const saveThemeColors = async () => {
    try {
      const darkColors = ThemeColorConfig.createFrom(themeColors.darkTheme);
      const lightColors = ThemeColorConfig.createFrom(themeColors.lightTheme);
      
      await Promise.all([
        ThemeService.UpdateThemeColors(ThemeType.ThemeTypeDark, darkColors),
        ThemeService.UpdateThemeColors(ThemeType.ThemeTypeLight, lightColors)
      ]);
    } catch (error) {
      console.error('Failed to save theme colors:', error);
      throw error;
    }
  };
  
  // 重置主题颜色
  const resetThemeColors = async (themeType: 'darkTheme' | 'lightTheme') => {
    try {
      const dbThemeType = themeType === 'darkTheme' ? ThemeType.ThemeTypeDark : ThemeType.ThemeTypeLight;
      
      // 1. 调用后端重置服务
      await ThemeService.ResetThemeColors(dbThemeType);
      
      // 2. 更新内存中的颜色状态
      const defaultColors = getDefaultColors(dbThemeType);
      Object.assign(themeColors[themeType], defaultColors);
      
      // 3. 刷新编辑器主题
      refreshEditorTheme();
      
      return true;
    } catch (error) {
      console.error('Failed to reset theme colors:', error);
      return false;
    }
  };
  
  // 刷新编辑器主题
  const refreshEditorTheme = () => {
    // 使用当前主题重新应用DOM主题
    applyThemeToDOM(currentTheme.value);
    
    const editorStore = useEditorStore();
    editorStore?.applyThemeSettings();
  };

  return {
    currentTheme,
    themeColors,
    setTheme,
    initializeTheme,
    applyThemeToDOM,
    updateThemeColors,
    saveThemeColors,
    resetThemeColors,
    refreshEditorTheme
  };
});