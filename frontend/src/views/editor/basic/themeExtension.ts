import { Extension, Compartment } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { SystemThemeType } from '@/../bindings/voidraft/internal/models/models';
import { createThemeByColors } from '@/views/editor/theme/registry';
import { useThemeStore } from '@/stores/themeStore';

// 主题区间 - 用于动态切换主题
export const themeCompartment = new Compartment();

/**
 * 根据主题类型获取主题扩展
 */
const getThemeExtension = (themeType: SystemThemeType): Extension | null => {
  const themeStore = useThemeStore();
  
  // 处理 auto 主题类型
  let isDark = themeType === SystemThemeType.SystemThemeDark;
  if (themeType === SystemThemeType.SystemThemeAuto) {
    isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  // 根据主题类型获取对应的颜色配置
  const colors = isDark ? themeStore.currentColors.dark : themeStore.currentColors.light;
  
  if (!colors) {
    console.warn('Theme colors not loaded yet');
    return null;
  }

  // 使用颜色配置创建主题
  return createThemeByColors(colors);
};

/**
 * 创建主题扩展（用于编辑器初始化）
 */
export const createThemeExtension = (themeType: SystemThemeType = SystemThemeType.SystemThemeDark): Extension => {
  const extension = getThemeExtension(themeType);
  
  // 如果主题未加载，返回空扩展
  if (!extension) {
    return themeCompartment.of([]);
  }
  
  return themeCompartment.of(extension);
};

/**
 * 更新编辑器主题
 */
export const updateEditorTheme = (view: EditorView, themeType: SystemThemeType): void => {
  if (!view?.dispatch) {
    return;
  }

  try {
    const extension = getThemeExtension(themeType);
    
    // 如果主题未加载，不更新
    if (!extension) {
      console.warn('Cannot update theme: theme not loaded');
      return;
    }
    
    view.dispatch({
      effects: themeCompartment.reconfigure(extension)
    });
  } catch (error) {
    console.error('Failed to update editor theme:', error);
  }
};

