import { Extension, Compartment } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { createThemeByColors } from '@/views/editor/theme';
import { useThemeStore } from '@/stores/themeStore';

// 主题区间 - 用于动态切换主题
export const themeCompartment = new Compartment();

/**
 * 根据主题类型获取主题扩展
 */
const getThemeExtension = (): Extension => {
  const themeStore = useThemeStore();
  
  // 获取有效主题颜色
  const colors = themeStore.getEffectiveColors();

  // 使用颜色配置创建主题
  return createThemeByColors(colors);
};

/**
 * 创建主题扩展（用于编辑器初始化）
 */
export const createThemeExtension = (): Extension => {
  const extension = getThemeExtension();
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
    
    view.dispatch({
      effects: themeCompartment.reconfigure(extension)
    });
  } catch (error) {
    console.error('Failed to update editor theme:', error);
  }
};
