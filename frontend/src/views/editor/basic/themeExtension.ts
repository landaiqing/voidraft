import { Extension, Compartment } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { SystemThemeType } from '@/../bindings/voidraft/internal/models/models';
import { createDarkTheme } from '@/views/editor/theme/dark';
import { createLightTheme } from '@/views/editor/theme/light';
import { useThemeStore } from '@/stores/themeStore';

// 主题区间 - 用于动态切换主题
export const themeCompartment = new Compartment();

/**
 * 根据主题类型获取主题扩展
 */
const getThemeExtension = (themeType: SystemThemeType): Extension => {
  const themeStore = useThemeStore();
  
  // 处理 auto 主题类型
  let actualTheme: SystemThemeType = themeType;
  if (themeType === SystemThemeType.SystemThemeAuto) {
    actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches 
      ? SystemThemeType.SystemThemeDark 
      : SystemThemeType.SystemThemeLight;
  }

  // 根据主题类型创建主题
  if (actualTheme === SystemThemeType.SystemThemeLight) {
    return createLightTheme(themeStore.themeColors.lightTheme);
  } else {
    return createDarkTheme(themeStore.themeColors.darkTheme);
  }
};

/**
 * 创建主题扩展（用于编辑器初始化）
 */
export const createThemeExtension = (themeType: SystemThemeType = SystemThemeType.SystemThemeDark): Extension => {
  const extension = getThemeExtension(themeType);
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
    view.dispatch({
      effects: themeCompartment.reconfigure(extension)
    });
  } catch (error) {
    console.error('Failed to update editor theme:', error);
  }
};

