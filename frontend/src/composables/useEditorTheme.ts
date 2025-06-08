import { ref, computed, shallowRef } from 'vue';
import { Extension, Compartment } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import type { ThemeType } from '@/types';

// 主题加载器类型
type ThemeLoader = () => Promise<Extension>;

// 默认主题常量
const DEFAULT_THEME = 'default-dark' as ThemeType;

// 主题加载映射
const themeLoaderMap = new Map<string, ThemeLoader>();

// 初始化主题加载器
const initThemeLoaders = () => {
  themeLoaderMap.set('default-dark', () => import('@/views/editor/theme/default-dark').then(m => m.defaultDark));
  themeLoaderMap.set('dracula', () => import('@/views/editor/theme/dracula').then(m => m.dracula));
  themeLoaderMap.set('aura', () => import('@/views/editor/theme/aura').then(m => m.aura));
  themeLoaderMap.set('github-dark', () => import('@/views/editor/theme/github-dark').then(m => m.githubDark));
  themeLoaderMap.set('github-light', () => import('@/views/editor/theme/github-light').then(m => m.githubLight));
  themeLoaderMap.set('material-dark', () => import('@/views/editor/theme/material-dark').then(m => m.materialDark));
  themeLoaderMap.set('material-light', () => import('@/views/editor/theme/material-light').then(m => m.materialLight));
  themeLoaderMap.set('solarized-dark', () => import('@/views/editor/theme/solarized-dark').then(m => m.solarizedDark));
  themeLoaderMap.set('solarized-light', () => import('@/views/editor/theme/solarized-light').then(m => m.solarizedLight));
  themeLoaderMap.set('tokyo-night', () => import('@/views/editor/theme/tokyo-night').then(m => m.tokyoNight));
  themeLoaderMap.set('tokyo-night-storm', () => import('@/views/editor/theme/tokyo-night-storm').then(m => m.tokyoNightStorm));
  themeLoaderMap.set('tokyo-night-day', () => import('@/views/editor/theme/tokyo-night-day').then(m => m.tokyoNightDay));
};

// 延迟初始化
initThemeLoaders();

// 全局状态
const currentTheme = ref<ThemeType>(DEFAULT_THEME);
const themeCompartment = new Compartment();
const themeCache = new Map<ThemeType, Extension>();
const failedThemes = new Set<ThemeType>(); // 记录加载失败的主题

/**
 * 编辑器主题管理
 */
export function useEditorTheme() {
  
  /**
   * 安全加载主题扩展
   */
  const loadTheme = async (targetTheme: ThemeType): Promise<Extension> => {
    // 1. 从缓存快速返回
    const cached = themeCache.get(targetTheme);
    if (cached) return cached;

    // 2. 检查是否已知失败的主题，避免重复尝试
    if (failedThemes.has(targetTheme) && targetTheme !== DEFAULT_THEME) {
      console.info(`Theme ${targetTheme} is known to fail, attempting default theme directly`);
      return attemptLoadTheme(DEFAULT_THEME).catch(() => [] as Extension);
    }

    // 3. 使用 try-catch 链和 nullish coalescing，替代递归
    const result = await attemptLoadTheme(targetTheme)
      .catch(async (error) => {
        // 仅当目标主题不是默认主题时，才尝试默认主题
        if (targetTheme !== DEFAULT_THEME) {
          console.warn(`Theme ${targetTheme} failed, fallback to ${DEFAULT_THEME}:`, error);
          return attemptLoadTheme(DEFAULT_THEME).catch((fallbackError) => {
            console.error(`Fallback theme ${DEFAULT_THEME} also failed:`, fallbackError);
            return [] as Extension; // 最终回退到空扩展
          });
        }
        // 如果默认主题也失败了，返回空扩展
        console.error(`Default theme ${DEFAULT_THEME} failed:`, error);
        return [] as Extension;
      });

    return result;
  };

  /**
   * 单纯的主题加载尝试 - 不处理回退逻辑
   */
  const attemptLoadTheme = async (themeType: ThemeType): Promise<Extension> => {
    // 获取加载器，使用 optional chaining 和 nullish coalescing
    const loader = themeLoaderMap.get(themeType);
    
    if (!loader) {
      const error = new Error(`Theme loader not found: ${themeType}`);
      failedThemes.add(themeType);
      throw error;
    }

    try {
      const extension = await loader();
      
      // 缓存成功加载的主题
      themeCache.set(themeType, extension);
      // 从失败列表中移除（如果存在）
      failedThemes.delete(themeType);
      
      return extension;
    } catch (error) {
      // 记录失败的主题
      failedThemes.add(themeType);
      console.error(`Failed to load theme: ${themeType}`, error);
      throw error;
    }
  };

  /**
   * 创建可配置的主题扩展
   */
  const createThemeExtension = async (themeType: ThemeType): Promise<Extension> => {
    const extension = await loadTheme(themeType);
    currentTheme.value = themeType;
    return themeCompartment.of(extension);
  };

  /**
   * 更新编辑器主题 - 使用防抖和错误处理
   */
  const updateTheme = async (view: EditorView, themeType: ThemeType): Promise<void> => {
    // 使用可选链操作符检查 view
    if (!view?.dispatch || themeType === currentTheme.value) {
      return;
    }

    const extension = await loadTheme(themeType);
    
    // 使用 try-catch 包装 dispatch，避免编辑器状态异常
    try {
      view.dispatch({
        effects: themeCompartment.reconfigure(extension)
      });
      currentTheme.value = themeType;
    } catch (error) {
      console.error('Failed to dispatch theme update:', error);
      throw error; // 重新抛出，让调用者处理
    }
  };

  /**
   * 批量预加载主题 - 使用 Promise.allSettled 确保部分失败不影响其他
   */
  const preloadThemes = async (themes: ThemeType[]): Promise<PromiseSettledResult<Extension>[]> => {
    const uniqueThemes = [...new Set(themes)]; // 去重
    return Promise.allSettled(
      uniqueThemes.map(theme => loadTheme(theme))
    );
  };

  /**
   * 重置主题系统状态
   */
  const resetThemeSystem = (): void => {
    themeCache.clear();
    failedThemes.clear();
    currentTheme.value = DEFAULT_THEME;
  };

  /**
   * 获取主题系统状态信息
   */
  const getThemeSystemInfo = () => ({
    currentTheme: currentTheme.value,
    cachedThemes: Array.from(themeCache.keys()),
    failedThemes: Array.from(failedThemes),
    availableThemes: Array.from(themeLoaderMap.keys()),
  });

  return {
    // 状态
    currentTheme: computed(() => currentTheme.value),
    
    // 核心方法
    createThemeExtension,
    updateTheme,
    loadTheme,
    
    // 批量操作
    preloadThemes,
    
    // 工具方法
    resetThemeSystem,
    getThemeSystemInfo,
    
    // 缓存管理
    clearCache: () => themeCache.clear(),
    clearFailedThemes: () => failedThemes.clear(),
  };
} 