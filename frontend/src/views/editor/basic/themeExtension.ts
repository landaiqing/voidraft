import { Extension, Compartment } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { SystemThemeType } from '@/../bindings/voidraft/internal/models/models';
import { dark } from '@/views/editor/theme/dark';
import { light } from '@/views/editor/theme/light';

// 主题区间 - 用于动态切换主题
export const themeCompartment = new Compartment();

/**
 * 根据主题类型获取主题扩展
 */
const getThemeExtension = (themeType: SystemThemeType): Extension => {
  // 处理 auto 主题类型
  let actualTheme: SystemThemeType = themeType;
  if (themeType === SystemThemeType.SystemThemeAuto) {
    actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches 
      ? SystemThemeType.SystemThemeDark 
      : SystemThemeType.SystemThemeLight;
  }

  // 直接返回对应的主题扩展
  switch (actualTheme) {
    case SystemThemeType.SystemThemeLight:
      return light;
    case SystemThemeType.SystemThemeDark:
    default:
      return dark;
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

  const extension = getThemeExtension(themeType);
  view.dispatch({
    effects: themeCompartment.reconfigure(extension)
  });
};

