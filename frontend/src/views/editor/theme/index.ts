import { Extension } from '@codemirror/state';
import type { ThemeColors } from './types';
import { createBaseTheme } from './base';

/**
 * 根据自定义颜色配置创建主题
 */
export function createThemeByColors(colors: ThemeColors): Extension {
  return createBaseTheme(colors);
}


