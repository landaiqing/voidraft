import { EditorView } from '@codemirror/view';
import { Extension, Compartment } from '@codemirror/state';

// 字体配置接口
export interface FontConfig {
  fontFamily: string;
  fontSize?: number;
  lineHeight?: number;
  fontWeight?: string;
}

// 创建字体配置compartment
export const fontCompartment = new Compartment();

// 默认鸿蒙字体配置
export const HARMONYOS_FONT_CONFIG: FontConfig = {
  fontFamily: '"HarmonyOS Sans SC", "HarmonyOS Sans", "Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, sans-serif',
  fontSize: 14,
  lineHeight: 1.5,
  fontWeight: 'normal'
};

// 从后端配置创建字体配置
export function createFontConfigFromBackend(backendConfig: {
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  fontWeight?: string;
}): FontConfig {
  return {
    fontFamily: backendConfig.fontFamily || HARMONYOS_FONT_CONFIG.fontFamily,
    fontSize: backendConfig.fontSize || HARMONYOS_FONT_CONFIG.fontSize,
    lineHeight: backendConfig.lineHeight || HARMONYOS_FONT_CONFIG.lineHeight,
    fontWeight: backendConfig.fontWeight || HARMONYOS_FONT_CONFIG.fontWeight,
  };
}

// 创建字体样式扩展
export function createFontExtension(config: Partial<FontConfig> = {}): Extension {
  const fontConfig = { ...HARMONYOS_FONT_CONFIG, ...config };
  
  const styles: Record<string, any> = {
    '&': {
      fontFamily: fontConfig.fontFamily,
      ...(fontConfig.fontSize && { fontSize: `${fontConfig.fontSize}px` }),
      ...(fontConfig.lineHeight && { lineHeight: fontConfig.lineHeight.toString() }),
      ...(fontConfig.fontWeight && { fontWeight: fontConfig.fontWeight }),
    },
    '.cm-content': {
      fontFamily: fontConfig.fontFamily,
      ...(fontConfig.fontSize && { fontSize: `${fontConfig.fontSize}px` }),
      ...(fontConfig.lineHeight && { lineHeight: fontConfig.lineHeight.toString() }),
      ...(fontConfig.fontWeight && { fontWeight: fontConfig.fontWeight }),
    },
    '.cm-editor': {
      fontFamily: fontConfig.fontFamily,
    },
    '.cm-scroller': {
      fontFamily: fontConfig.fontFamily,
    },
    '.cm-gutters': {
      fontFamily: fontConfig.fontFamily,
      ...(fontConfig.fontSize && { fontSize: `${fontConfig.fontSize}px` }),
    },
    '.cm-lineNumbers': {
      fontFamily: fontConfig.fontFamily,
      ...(fontConfig.fontSize && { fontSize: `${Math.max(10, fontConfig.fontSize - 1)}px` }),
    },
    '.cm-tooltip': {
      fontFamily: fontConfig.fontFamily,
      ...(fontConfig.fontSize && { fontSize: `${Math.max(12, fontConfig.fontSize - 1)}px` }),
    },
    '.cm-completionLabel': {
      fontFamily: fontConfig.fontFamily,
    },
    '.cm-completionDetail': {
      fontFamily: fontConfig.fontFamily,
    }
  };
  
  return EditorView.theme(styles);
}

// 创建响应式字体大小扩展
export function createResponsiveFontExtension(baseFontSize: number = 14): Extension {
  return fontCompartment.of(createFontExtension({
    fontSize: baseFontSize,
    lineHeight: 1.5
  }));
}

// 从后端配置创建字体扩展
export function createFontExtensionFromBackend(backendConfig: {
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  fontWeight?: string;
}): Extension {
  const fontConfig = createFontConfigFromBackend(backendConfig);
  return fontCompartment.of(createFontExtension(fontConfig));
}

// 动态更新字体配置
export function updateFontConfig(view: EditorView, config: Partial<FontConfig>): void {
  const newFontExtension = createFontExtension(config);
  
  // 使用compartment重新配置字体扩展
  view.dispatch({
    effects: fontCompartment.reconfigure(newFontExtension)
  });
}

// 预设字体配置
export const FONT_PRESETS = {
  // 鸿蒙字体系列
  harmonyos: {
    name: '鸿蒙字体',
    fontFamily: '"HarmonyOS Sans SC", "HarmonyOS Sans", "Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, sans-serif',
    fontSize: 14,
    lineHeight: 1.5,
    fontWeight: 'normal'
  },
  harmonyosCondensed: {
    name: '鸿蒙紧凑字体',
    fontFamily: '"HarmonyOS Sans Condensed", "HarmonyOS Sans SC", "HarmonyOS Sans", "Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, sans-serif',
    fontSize: 14,
    lineHeight: 1.4,
    fontWeight: 'normal'
  },
  
  // 编程专用字体
  jetbrainsMono: {
    name: 'JetBrains Mono',
    fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Monaco, Consolas, "Ubuntu Mono", monospace',
    fontSize: 14,
    lineHeight: 1.5,
    fontWeight: 'normal'
  },
  firaCode: {
    name: 'Fira Code',
    fontFamily: '"Fira Code", "JetBrains Mono", "SF Mono", Monaco, Consolas, "Ubuntu Mono", monospace',
    fontSize: 14,
    lineHeight: 1.5,
    fontWeight: 'normal'
  },
  sourceCodePro: {
    name: 'Source Code Pro',
    fontFamily: '"Source Code Pro", "SF Mono", Monaco, Consolas, "Ubuntu Mono", monospace',
    fontSize: 14,
    lineHeight: 1.5,
    fontWeight: 'normal'
  },
  
  // 系统字体
  systemMono: {
    name: '系统等宽字体',
    fontFamily: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
    fontSize: 14,
    lineHeight: 1.5,
    fontWeight: 'normal'
  },
  cascadiaCode: {
    name: 'Cascadia Code',
    fontFamily: '"Cascadia Code", "SF Mono", Monaco, Consolas, "Ubuntu Mono", monospace',
    fontSize: 14,
    lineHeight: 1.5,
    fontWeight: 'normal'
  },
  
  // 中文友好字体
  microsoftYaHei: {
    name: '微软雅黑',
    fontFamily: '"Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, sans-serif',
    fontSize: 14,
    lineHeight: 1.5,
    fontWeight: 'normal'
  },
  pingFang: {
    name: '苹方字体',
    fontFamily: '"PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif',
    fontSize: 14,
    lineHeight: 1.5,
    fontWeight: 'normal'
  },
  
  // 经典字体
  arial: {
    name: 'Arial',
    fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
    fontSize: 14,
    lineHeight: 1.5,
    fontWeight: 'normal'
  },
  helvetica: {
    name: 'Helvetica',
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    fontSize: 14,
    lineHeight: 1.5,
    fontWeight: 'normal'
  }
} as const;

// 字体预设类型
export type FontPresetKey = keyof typeof FONT_PRESETS;

// 获取所有字体预设选项
export function getFontPresetOptions() {
  return Object.entries(FONT_PRESETS).map(([key, preset]) => ({
    value: key as FontPresetKey,
    label: preset.name,
    fontFamily: preset.fontFamily
  }));
}

// 根据预设创建字体扩展
export function createPresetFontExtension(preset: keyof typeof FONT_PRESETS, overrides: Partial<FontConfig> = {}): Extension {
  const config = { ...FONT_PRESETS[preset], ...overrides };
  return createFontExtension(config);
} 