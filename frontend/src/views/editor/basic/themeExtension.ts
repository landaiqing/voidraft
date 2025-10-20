import { Extension, Compartment } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { createThemeByColors } from '@/views/editor/theme';
import { useThemeStore } from '@/stores/themeStore';

// 主题区间 - 用于动态切换主题
export const themeCompartment = new Compartment();

/**
 * 根据主题类型获取主题扩展
 */
const getThemeExtension = (): Extension | null => {
  const themeStore = useThemeStore();
  
  // 直接获取当前主题颜色配置
  const colors = themeStore.currentColors;
  
  if (!colors) {
    return null;
  }

  // 使用颜色配置创建主题
  return createThemeByColors(colors);
};

/**
 * 创建主题扩展（用于编辑器初始化）
 */
export const createThemeExtension = (): Extension => {
  const extension = getThemeExtension();
  
  // 如果主题未加载，返回空扩展
  if (!extension) {
    return themeCompartment.of([]);
  }
  
  return themeCompartment.of(extension);
};

/**
 * 更新编辑器主题
 */
export const updateEditorTheme = (view: EditorView): void => {
  if (!view?.dispatch) {
    return;
  }

  try {
    const extension = getThemeExtension();
    
    // 如果主题未加载，不更新
    if (!extension) {
      return;
    }
    
    view.dispatch({
      effects: themeCompartment.reconfigure(extension)
    });
  } catch (error) {
    console.error('Failed to update editor theme:', error);
  }
};

