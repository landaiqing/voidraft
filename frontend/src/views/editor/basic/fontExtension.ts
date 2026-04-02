import {Compartment, Extension} from '@codemirror/state';
import {EditorView} from '@codemirror/view';

export interface FontConfig {
  fontFamily: string;
  fontSize?: number;
  lineHeight?: number;
  fontWeight?: string;
}

export const fontCompartment = new Compartment();

export const DEFAULT_FONT_CONFIG: FontConfig = {
  fontFamily: 'HarmonyOS',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: '400'
};

const appliedFontConfigCache = new WeakMap<EditorView, FontConfig>();

function normalizeFontConfig(config: Partial<FontConfig>): FontConfig {
  return {...DEFAULT_FONT_CONFIG, ...config};
}

function isSameFontConfig(previous: FontConfig | undefined, next: FontConfig): boolean {
  return previous?.fontFamily === next.fontFamily
    && previous?.fontSize === next.fontSize
    && previous?.lineHeight === next.lineHeight
    && previous?.fontWeight === next.fontWeight;
}

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

export function createFontExtension(config: Partial<FontConfig> = {}): Extension {
  const fontConfig = normalizeFontConfig(config);

  const styles: Record<string, any> = {
    '&': {
      fontFamily: fontConfig.fontFamily,
      ...(fontConfig.fontSize && {fontSize: `${fontConfig.fontSize}px`}),
      ...(fontConfig.lineHeight && {lineHeight: fontConfig.lineHeight.toString()}),
      ...(fontConfig.fontWeight && {fontWeight: fontConfig.fontWeight}),
    },
    '.cm-content': {
      fontFamily: fontConfig.fontFamily,
      ...(fontConfig.fontSize && {fontSize: `${fontConfig.fontSize}px`}),
      ...(fontConfig.lineHeight && {lineHeight: fontConfig.lineHeight.toString()}),
      ...(fontConfig.fontWeight && {fontWeight: fontConfig.fontWeight}),
    },
    '.cm-editor': {
      fontFamily: fontConfig.fontFamily,
    },
    '.cm-scroller': {
      fontFamily: fontConfig.fontFamily,
    },
    '.cm-gutters': {
      fontFamily: fontConfig.fontFamily,
      ...(fontConfig.fontSize && {fontSize: `${fontConfig.fontSize}px`}),
    },
    '.cm-lineNumbers': {
      fontFamily: fontConfig.fontFamily,
      ...(fontConfig.fontSize && {fontSize: `${Math.max(10, fontConfig.fontSize - 1)}px`}),
    },
    '.cm-tooltip': {
      fontFamily: fontConfig.fontFamily,
      ...(fontConfig.fontSize && {fontSize: `${Math.max(12, fontConfig.fontSize - 1)}px`}),
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

export function createFontExtensionFromBackend(backendConfig: {
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  fontWeight?: string;
}): Extension {
  const fontConfig = createFontConfigFromBackend(backendConfig);
  return fontCompartment.of(createFontExtension(fontConfig));
}

export function updateFontConfig(view: EditorView, config: Partial<FontConfig>): void {
  const nextFontConfig = normalizeFontConfig(config);
  if (isSameFontConfig(appliedFontConfigCache.get(view), nextFontConfig)) {
    return;
  }

  appliedFontConfigCache.set(view, nextFontConfig);
  view.dispatch({
    effects: fontCompartment.reconfigure(createFontExtension(nextFontConfig))
  });
}
