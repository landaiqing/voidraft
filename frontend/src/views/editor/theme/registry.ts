import { Extension } from '@codemirror/state';
import type { ThemeColors } from './types';
import { createBaseTheme } from './base';

// 深色主题导入
import { config as draculaConfig } from './dark/dracula';
import { config as auraConfig } from './dark/aura';
import { config as githubDarkConfig } from './dark/github-dark';
import { config as materialDarkConfig } from './dark/material-dark';
import { config as oneDarkConfig } from './dark/one-dark';
import { config as solarizedDarkConfig } from './dark/solarized-dark';
import { config as tokyoNightConfig } from './dark/tokyo-night';
import { config as tokyoNightStormConfig } from './dark/tokyo-night-storm';

// 浅色主题导入
import { config as githubLightConfig } from './light/github-light';
import { config as materialLightConfig } from './light/material-light';
import { config as solarizedLightConfig } from './light/solarized-light';
import { config as tokyoNightDayConfig } from './light/tokyo-night-day';

/**
 * 主题配置映射表
 * key: 主题名称（与数据库中的 name 字段一致）
 * value: 主题颜色配置
 */
const themeConfigMap: Record<string, ThemeColors> = {
  // 深色主题
  'dracula': draculaConfig,
  'aura': auraConfig,
  'github-dark': githubDarkConfig,
  'material-dark': materialDarkConfig,
  'one-dark': oneDarkConfig,
  'solarized-dark': solarizedDarkConfig,
  'tokyo-night': tokyoNightConfig,
  'tokyo-night-storm': tokyoNightStormConfig,
  
  // 浅色主题
  'github-light': githubLightConfig,
  'material-light': materialLightConfig,
  'solarized-light': solarizedLightConfig,
  'tokyo-night-day': tokyoNightDayConfig,
};

/**
 * 根据主题名称获取主题配置
 */
export function getThemeConfig(themeName: string): ThemeColors | null {
  return themeConfigMap[themeName] || null;
}


/**
 * 根据自定义颜色配置创建主题
 */
export function createThemeByColors(colors: ThemeColors): Extension {
  return createBaseTheme(colors);
}


