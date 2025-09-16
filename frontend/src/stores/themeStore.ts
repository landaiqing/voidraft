import {defineStore} from 'pinia';
import {computed, reactive} from 'vue';
import {SystemThemeType, ThemeType, ThemeColorConfig} from '@/../bindings/voidraft/internal/models/models';
import {ThemeService} from '@/../bindings/voidraft/internal/services';
import {useConfigStore} from './configStore';
import {useEditorStore} from './editorStore';
import {defaultDarkColors} from '@/views/editor/theme/dark';
import {defaultLightColors} from '@/views/editor/theme/light';

/**
 * 主题管理 Store
 * 职责：管理主题状态和颜色配置
 */
export const useThemeStore = defineStore('theme', () => {
  const configStore = useConfigStore();
  
  // 响应式状态 - 存储当前使用的主题颜色
  const themeColors = reactive({
    darkTheme: { ...defaultDarkColors },
    lightTheme: { ...defaultLightColors }
  });
  
  // 计算属性 - 当前选择的主题类型
  const currentTheme = computed(() => 
    configStore.config?.appearance?.systemTheme || SystemThemeType.SystemThemeAuto
  );

  // 初始化主题颜色 - 从数据库加载
  const initializeThemeColors = async () => {
    try {
      const themes = await ThemeService.GetDefaultThemes();
      if (!themes) {
          Object.assign(themeColors.darkTheme, defaultDarkColors);
          Object.assign(themeColors.lightTheme, defaultLightColors);
      }
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

  // 应用主题到 DOM
  const applyThemeToDOM = (theme: SystemThemeType) => {
    document.documentElement.setAttribute('data-theme', 
      theme === SystemThemeType.SystemThemeAuto ? 'auto' :
      theme === SystemThemeType.SystemThemeDark ? 'dark' : 'light'
    );
  };

  // 初始化主题
  const initializeTheme = async () => {
    const theme = configStore.config?.appearance?.systemTheme || SystemThemeType.SystemThemeAuto;
    applyThemeToDOM(theme);
    await initializeThemeColors();
  };

  // 设置主题
  const setTheme = async (theme: SystemThemeType) => {
    await configStore.setSystemTheme(theme);
    applyThemeToDOM(theme);
    refreshEditorTheme();
  };
  
  // 更新主题颜色
  const updateThemeColors = (darkColors: any = null, lightColors: any = null): boolean => {
    let hasChanges = false;
    
    if (darkColors) {
      Object.entries(darkColors).forEach(([key, value]) => {
        if (value !== undefined && themeColors.darkTheme[key] !== value) {
          themeColors.darkTheme[key] = value;
          hasChanges = true;
        }
      });
    }
    
    if (lightColors) {
      Object.entries(lightColors).forEach(([key, value]) => {
        if (value !== undefined && themeColors.lightTheme[key] !== value) {
          themeColors.lightTheme[key] = value;
          hasChanges = true;
        }
      });
    }
    
    return hasChanges;
  };
  
  // 保存主题颜色到数据库
  const saveThemeColors = async () => {
    try {
      const darkColors = ThemeColorConfig.createFrom(themeColors.darkTheme);
      const lightColors = ThemeColorConfig.createFrom(themeColors.lightTheme);
      
      await ThemeService.UpdateThemeColors(ThemeType.ThemeTypeDark, darkColors);
      await ThemeService.UpdateThemeColors(ThemeType.ThemeTypeLight, lightColors);
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
      if (themeType === 'darkTheme') {
        Object.assign(themeColors.darkTheme, defaultDarkColors);
      } else {
        Object.assign(themeColors.lightTheme, defaultLightColors);
      }
      
      // 3. 刷新编辑器主题
      refreshEditorTheme();
      
      return true;
    } catch (error) {
      console.error('Failed to reset theme colors:', error);
      return false;
    }
  };
  
  // 刷新编辑器主题（在主题颜色更改后调用）
  const refreshEditorTheme = () => {
    // 使用当前主题重新应用DOM主题
    const theme = currentTheme.value;
    applyThemeToDOM(theme);
    
    const editorStore = useEditorStore();
    if (editorStore) {
      editorStore.applyThemeSettings();
    }
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