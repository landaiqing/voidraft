import {defineStore} from 'pinia';
import {computed, reactive} from 'vue';
import {SystemThemeType} from '@/../bindings/voidraft/internal/models/models';
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

  // 初始化主题颜色 - 从配置加载
  const initializeThemeColors = () => {
    const customTheme = configStore.config?.appearance?.customTheme;
    if (customTheme) {
      if (customTheme.darkTheme) {
        Object.assign(themeColors.darkTheme, customTheme.darkTheme);
      }
      if (customTheme.lightTheme) {
        Object.assign(themeColors.lightTheme, customTheme.lightTheme);
      }
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
  const initializeTheme = () => {
    const theme = configStore.config?.appearance?.systemTheme || SystemThemeType.SystemThemeAuto;
    applyThemeToDOM(theme);
    initializeThemeColors();
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
  
  // 保存主题颜色到配置
  const saveThemeColors = async () => {
    const customTheme = {
      darkTheme: { ...themeColors.darkTheme },
      lightTheme: { ...themeColors.lightTheme }
    };
    
    await configStore.setCustomTheme(customTheme);
  };
  
  // 重置主题颜色
  const resetThemeColors = async (themeType: 'darkTheme' | 'lightTheme') => {
    try {
      // 1. 更新内存中的颜色状态
      if (themeType === 'darkTheme') {
        Object.assign(themeColors.darkTheme, defaultDarkColors);
      }
      
      if (themeType === 'lightTheme') {
        Object.assign(themeColors.lightTheme, defaultLightColors);
      }
      
      // 2. 保存到配置
      await saveThemeColors();
      
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