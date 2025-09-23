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

// 默认字体配置
export const DEFAULT_FONT_CONFIG: FontConfig = {
  fontFamily: 'HarmonyOS',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: '400'
};

// 从后端配置创建字体配置
export function createFontConfigFromBackend(backendConfig: {
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  fontWeight?: string;
}): FontConfig {
  return {
    fontFamily: backendConfig.fontFamily || DEFAULT_FONT_CONFIG.fontFamily,
    fontSize: backendConfig.fontSize || DEFAULT_FONT_CONFIG.fontSize,
    lineHeight: backendConfig.lineHeight || DEFAULT_FONT_CONFIG.lineHeight,
    fontWeight: backendConfig.fontWeight || DEFAULT_FONT_CONFIG.fontWeight,
  };
}

// 创建字体样式扩展
export function createFontExtension(config: Partial<FontConfig> = {}): Extension {
  const fontConfig = { ...DEFAULT_FONT_CONFIG, ...config };
  
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