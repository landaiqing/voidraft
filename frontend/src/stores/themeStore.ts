import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';
import {SystemThemeType, ThemeType, Theme, ThemeColorConfig} from '@/../bindings/voidraft/internal/models/models';
import { ThemeService } from '@/../bindings/voidraft/internal/services';
import { useConfigStore } from './configStore';
import { useEditorStore } from './editorStore';
import type { ThemeColors } from '@/views/editor/theme/types';
import { getThemeConfig } from '@/views/editor/theme/registry';

/**
 * 主题管理 Store
 * 职责：管理主题状态、颜色配置和预设主题列表
 */
export const useThemeStore = defineStore('theme', () => {
  const configStore = useConfigStore();
  
  // 所有主题列表（从数据库加载）
  const allThemes = ref<Theme[]>([]);
  
  // 当前选中的主题 ID
  const currentThemeIds = reactive({
    dark: 0,   // 当前深色主题ID
    light: 0,  // 当前浅色主题ID
  });
  
  // 当前主题的颜色配置（用于编辑器渲染）
  const currentColors = reactive<{
    dark: ThemeColors | null;
    light: ThemeColors | null;
  }>({
    dark: null,
    light: null,
  });
  
  // 计算属性：当前系统主题模式
  const currentTheme = computed(() => 
    configStore.config?.appearance?.systemTheme || SystemThemeType.SystemThemeAuto
  );

  // 计算属性：根据类型获取主题列表
  const darkThemes = computed(() => 
    allThemes.value.filter(t => t.type === ThemeType.ThemeTypeDark)
  );
  
  const lightThemes = computed(() => 
    allThemes.value.filter(t => t.type === ThemeType.ThemeTypeLight)
  );
  
  // 计算属性：获取当前激活的主题对象
  const activeTheme = computed(() => {
    const isDark = currentTheme.value === SystemThemeType.SystemThemeDark || 
      (currentTheme.value === SystemThemeType.SystemThemeAuto && 
       window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    return isDark ? currentColors.dark : currentColors.light;
  });

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
  
  // 根据主题对象加载颜色配置
  const loadThemeColors = (theme: Theme): ThemeColors => {
    // 优先使用数据库中的颜色配置
    const dbColors = theme.colors as unknown as ThemeColors;
    
    // 如果数据库颜色不完整，尝试从预设主题获取
    if (!dbColors || Object.keys(dbColors).length < 10) {
      const presetConfig = getThemeConfig(theme.name);
      if (presetConfig) {
        return presetConfig;
      }
    }
    
    return dbColors;
  };

  // 初始化主题颜色（加载默认主题）
  const initializeThemeColors = async () => {
    try {
      // 加载所有主题
      await loadAllThemes();
      
      // 查找默认主题
      const defaultDark = allThemes.value.find(
        t => t.type === ThemeType.ThemeTypeDark && t.isDefault
      );
      const defaultLight = allThemes.value.find(
        t => t.type === ThemeType.ThemeTypeLight && t.isDefault
      );
      
      // 设置默认主题
      if (defaultDark) {
        currentThemeIds.dark = defaultDark.id;
        currentColors.dark = loadThemeColors(defaultDark);
      }
      
      if (defaultLight) {
        currentThemeIds.light = defaultLight.id;
        currentColors.light = loadThemeColors(defaultLight);
      }
      
      // 如果没有找到默认主题，使用第一个可用主题
      if (!currentColors.dark && darkThemes.value.length > 0) {
        const fallback = darkThemes.value[0];
        currentThemeIds.dark = fallback.id;
        currentColors.dark = loadThemeColors(fallback);
      }
      
      if (!currentColors.light && lightThemes.value.length > 0) {
        const fallback = lightThemes.value[0];
        currentThemeIds.light = fallback.id;
        currentColors.light = loadThemeColors(fallback);
      }
    } catch (error) {
      console.error('Failed to initialize theme colors:', error);
      // 使用预设主题作为后备
      currentColors.dark = getThemeConfig('default-dark');
      currentColors.light = getThemeConfig('default-light');
    }
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
  
  // 切换到指定的预设主题（通过主题ID）
  const switchToTheme = async (themeId: number) => {
    try {
      const theme = allThemes.value.find(t => t.id === themeId);
      if (!theme) {
        console.error('Theme not found:', themeId);
        return false;
      }
      
      // 加载主题颜色
      const colors = loadThemeColors(theme);
      
      // 根据主题类型更新对应的颜色配置
      if (theme.type === ThemeType.ThemeTypeDark) {
        currentThemeIds.dark = themeId;
        currentColors.dark = colors;
      } else {
        currentThemeIds.light = themeId;
        currentColors.light = colors;
      }
      
      // 刷新编辑器主题
      refreshEditorTheme();
      return true;
    } catch (error) {
      console.error('Failed to switch theme:', error);
      return false;
    }
  };
  
  // 更新当前主题的颜色配置
  const updateCurrentColors = (colors: Partial<ThemeColors>, isDark: boolean) => {
    const target = isDark ? currentColors.dark : currentColors.light;
    if (!target) return;
    
    Object.assign(target, colors);
  };
  
  // 保存当前主题颜色到数据库
  const saveCurrentTheme = async (isDark: boolean) => {
    try {
      const themeId = isDark ? currentThemeIds.dark : currentThemeIds.light;
      const colors = isDark ? currentColors.dark : currentColors.light;
      
      if (!themeId || !colors) {
        throw new Error('No theme selected');
      }
      
      // 转换为数据库格式并保存
      const dbColors = colors as ThemeColorConfig; // ThemeColorConfig from bindings
      await ThemeService.UpdateTheme(themeId, dbColors);
      
      return true;
    } catch (error) {
      console.error('Failed to save theme:', error);
      throw error;
    }
  };
  
  // 重置当前主题为预设配置
  const resetCurrentTheme = async (isDark: boolean) => {
    try {
      const themeId = isDark ? currentThemeIds.dark : currentThemeIds.light;
      
      if (!themeId) {
        throw new Error('No theme selected');
      }
      
      // 调用后端重置服务
      await ThemeService.ResetTheme(themeId);
      
      // 重新加载主题
      await loadAllThemes();
      const theme = allThemes.value.find(t => t.id === themeId);
      
      if (theme) {
        const colors = loadThemeColors(theme);
        if (isDark) {
          currentColors.dark = colors;
        } else {
          currentColors.light = colors;
        }
      }
      
      // 刷新编辑器主题
      refreshEditorTheme();
      
      return true;
    } catch (error) {
      console.error('Failed to reset theme:', error);
      return false;
    }
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
    currentTheme,
    currentThemeIds,
    currentColors,
    activeTheme,
    
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