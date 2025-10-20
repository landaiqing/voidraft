import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {SystemThemeType, ThemeType, Theme, ThemeColorConfig} from '@/../bindings/voidraft/internal/models/models';
import { ThemeService } from '@/../bindings/voidraft/internal/services';
import { useConfigStore } from './configStore';
import { useEditorStore } from './editorStore';
import type { ThemeColors } from '@/views/editor/theme/types';

/**
 * 主题管理 Store
 * 职责：管理主题状态、颜色配置和预设主题列表
 */
export const useThemeStore = defineStore('theme', () => {
  const configStore = useConfigStore();
  
  // 所有主题列表
  const allThemes = ref<Theme[]>([]);
  
  // 当前主题的颜色配置
  const currentColors = ref<ThemeColors | null>(null);
  
  // 计算属性：当前系统主题模式
  const currentTheme = computed(() => 
    configStore.config?.appearance?.systemTheme || SystemThemeType.SystemThemeAuto
  );

  // 计算属性：当前是否为深色模式
  const isDarkMode = computed(() => 
    currentTheme.value === SystemThemeType.SystemThemeDark || 
    (currentTheme.value === SystemThemeType.SystemThemeAuto && 
     window.matchMedia('(prefers-color-scheme: dark)').matches)
  );

  // 计算属性：根据类型获取主题列表
  const darkThemes = computed(() => 
    allThemes.value.filter(t => t.type === ThemeType.ThemeTypeDark)
  );
  
  const lightThemes = computed(() => 
    allThemes.value.filter(t => t.type === ThemeType.ThemeTypeLight)
  );
  
  // 计算属性：当前可用的主题列表
  const availableThemes = computed(() => 
    isDarkMode.value ? darkThemes.value : lightThemes.value
  );

  // 应用主题到 DOM
  const applyThemeToDOM = (theme: SystemThemeType) => {
    const themeMap = {
      [SystemThemeType.SystemThemeAuto]: 'auto',
      [SystemThemeType.SystemThemeDark]: 'dark',
      [SystemThemeType.SystemThemeLight]: 'light'
    };
    document.documentElement.setAttribute('data-theme', themeMap[theme]);
  };

  // 从数据库加载所有主题
  const loadAllThemes = async () => {
    try {
      const themes = await ThemeService.GetAllThemes();
      allThemes.value = (themes || []).filter((t): t is Theme => t !== null);
      return allThemes.value;
    } catch (error) {
      console.error('Failed to load themes from database:', error);
      allThemes.value = [];
      return [];
    }
  };

  // 初始化主题颜色
  const initializeThemeColors = async () => {
    // 加载所有主题
    await loadAllThemes();
    
    // 从配置获取当前主题名称并加载
    const currentThemeName = configStore.config?.appearance?.currentTheme || 'default-dark';
    
    const theme = allThemes.value.find(t => t.name === currentThemeName);

    if (!theme) {
      console.error(`Theme not found: ${currentThemeName}`);
      return;
    }

    // 直接设置当前主题颜色
    currentColors.value = theme.colors as ThemeColors;
  };

  // 初始化主题
  const initializeTheme = async () => {
    const theme = currentTheme.value;
    applyThemeToDOM(theme);
    await initializeThemeColors();
  };

  // 设置系统主题模式（深色/浅色/自动）
  const setTheme = async (theme: SystemThemeType) => {
    await configStore.setSystemTheme(theme);
    applyThemeToDOM(theme);
    refreshEditorTheme();
  };
  
  // 切换到指定的预设主题
  const switchToTheme = async (themeName: string) => {
    const theme = allThemes.value.find(t => t.name === themeName);
    if (!theme) {
      console.error('Theme not found:', themeName);
      return false;
    }

    // 直接设置当前主题颜色
    currentColors.value = theme.colors as ThemeColors;
    
    // 持久化到配置
    await configStore.setCurrentTheme(themeName);
    
    // 刷新编辑器
    refreshEditorTheme();
    return true;
  };
  
  // 更新当前主题的颜色配置
  const updateCurrentColors = (colors: Partial<ThemeColors>) => {
    if (!currentColors.value) return;
    Object.assign(currentColors.value, colors);
  };
  
  // 保存当前主题颜色到数据库
  const saveCurrentTheme = async () => {
    if (!currentColors.value) {
      throw new Error('No theme selected');
    }

    const theme = allThemes.value.find(t => t.name === currentColors.value!.name);
    if (!theme) {
      throw new Error('Theme not found');
    }
    
    await ThemeService.UpdateTheme(theme.id, currentColors.value as ThemeColorConfig);
    return true;
  };
  
  // 重置当前主题为预设配置
  const resetCurrentTheme = async () => {
    if (!currentColors.value) {
      throw new Error('No theme selected');
    }
    
    // 调用后端重置
    await ThemeService.ResetTheme(0, currentColors.value.name);
    
    // 重新加载所有主题
    await loadAllThemes();

    const updatedTheme = allThemes.value.find(t => t.name === currentColors.value!.name);
    
    if (updatedTheme) {
      currentColors.value = updatedTheme.colors as ThemeColors;
    }
    
    refreshEditorTheme();
    return true;
  };
  
  // 刷新编辑器主题
  const refreshEditorTheme = () => {
    applyThemeToDOM(currentTheme.value);
    
    const editorStore = useEditorStore();
    editorStore?.applyThemeSettings();
  };

  return {
    // 状态
    allThemes,
    darkThemes,
    lightThemes,
    availableThemes,
    currentTheme,
    currentColors,
    isDarkMode,
    
    // 方法
    setTheme,
    switchToTheme,
    initializeTheme,
    loadAllThemes,
    updateCurrentColors,
    saveCurrentTheme,
    resetCurrentTheme,
    refreshEditorTheme,
    applyThemeToDOM,
  };
});