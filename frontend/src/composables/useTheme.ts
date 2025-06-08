import { useConfigStore } from '@/stores/configStore';
import { useEditorTheme } from './useEditorTheme';
import type { ThemeType } from '@/types';

/**
 * 主题管理 - 用于设置页面
 */
export function useTheme() {
  const configStore = useConfigStore();
  const { preloadThemes, getThemeSystemInfo } = useEditorTheme();

  /**
   * 设置主题 - 同时更新配置和预览
   */
  const setTheme = async (themeType: ThemeType): Promise<void> => {
    try {
      // 更新配置存储（这会自动触发编辑器主题更新）
      await configStore.setTheme(themeType);
      
      console.info(`Theme switched to: ${themeType}`);
    } catch (error) {
      console.error('Failed to set theme:', error);
      throw error;
    }
  };

  /**
   * 预加载常用主题
   */
  const preloadCommonThemes = async (): Promise<void> => {
    const commonThemes: ThemeType[] = [
      'default-dark' as ThemeType,
      'dracula' as ThemeType,
      'github-dark' as ThemeType,
      'material-dark' as ThemeType
    ];
    
    try {
      await preloadThemes(commonThemes);
      console.info('Common themes preloaded successfully');
    } catch (error) {
      console.warn('Some themes failed to preload:', error);
    }
  };

  /**
   * 获取主题状态
   */
  const getThemeStatus = () => ({
    current: configStore.config.appearance.theme,
    ...getThemeSystemInfo()
  });

  return {
    setTheme,
    preloadCommonThemes,
    getThemeStatus,
  };
} 