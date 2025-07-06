import { Extension, StateField, StateEffect } from '@codemirror/state';
import { EditorView, showTooltip, Tooltip } from '@codemirror/view';
import { createTranslationTooltip } from './tooltip';

/**
 * 翻译器扩展配置
 */
export interface TranslatorConfig {
  /** 默认翻译服务提供商 */
  defaultTranslator: string;
  /** 最小选择字符数才显示翻译按钮 */
  minSelectionLength: number;
  /** 最大翻译字符数 */
  maxTranslationLength: number;
}

/**
 * 默认翻译器配置
 */
export const defaultConfig: TranslatorConfig = {
  defaultTranslator: 'bing',
  minSelectionLength: 2,
  maxTranslationLength: 5000,
};

// 全局配置存储
let currentConfig: TranslatorConfig = {...defaultConfig};
// 存储选择的文本用于翻译
let selectedTextForTranslation = "";


/**
 * 翻译图标SVG
 */
const translationIconSvg = `
<svg class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
  <path d="M599.68 485.056h-8l30.592 164.672c20.352-7.04 38.72-17.344 54.912-31.104a271.36 271.36 0 0 1-40.704-64.64l32.256-4.032c8.896 17.664 19.072 33.28 30.592 46.72 23.872-27.968 42.24-65.152 55.04-111.744l-154.688 0.128z m121.92 133.76c18.368 15.36 39.36 26.56 62.848 33.472l14.784 4.416-8.64 30.336-14.72-4.352a205.696 205.696 0 0 1-76.48-41.728c-20.672 17.92-44.928 31.552-71.232 40.064l20.736 110.912H519.424l-9.984 72.512h385.152c18.112 0 32.704-14.144 32.704-31.616V295.424a32.128 32.128 0 0 0-32.704-31.552H550.528l35.2 189.696h79.424v-31.552h61.44v31.552h102.4v31.616h-42.688c-14.272 55.488-35.712 100.096-64.64 133.568zM479.36 791.68H193.472c-36.224 0-65.472-28.288-65.472-63.168V191.168C128 156.16 157.312 128 193.472 128h327.68l20.544 104.32h352.832c36.224 0 65.472 28.224 65.472 63.104v537.408c0 34.944-29.312 63.168-65.472 63.168H468.608l10.688-104.32zM337.472 548.352v-33.28H272.768v-48.896h60.16V433.28h-60.16v-41.728h64.704v-32.896h-102.4v189.632h102.4z m158.272 0V453.76c0-17.216-4.032-30.272-12.16-39.488-8.192-9.152-20.288-13.696-36.032-13.696a55.04 55.04 0 0 0-24.768 5.376 39.04 39.04 0 0 0-17.088 15.936h-1.984l-5.056-18.56h-28.352V548.48h37.12V480c0-17.088 2.304-29.376 6.912-36.736 4.608-7.424 12.16-11.072 22.528-11.072 7.616 0 13.248 2.56 16.64 7.872 3.52 5.248 5.312 13.056 5.312 23.488v84.736h36.928z" fill="currentColor"></path>
</svg>`;

// 用于设置翻译气泡的状态效果
const setTranslationTooltip = StateEffect.define<Tooltip | null>();

/**
 * 翻译气泡的状态字段
 */
const translationTooltipField = StateField.define<readonly Tooltip[]>({
  create() {
    return [];
  },
  update(tooltips, tr) {
    // 如果文档或选择变化，隐藏气泡
    if (tr.docChanged || tr.selection) {
      return [];
    }
    
    // 检查是否有特定的状态效果来更新tooltips
    for (const effect of tr.effects) {
      if (effect.is(setTranslationTooltip)) {
        return effect.value ? [effect.value] : [];
      }
    }
    
    return tooltips;
  },
  provide: field => showTooltip.computeN([field], state => state.field(field))
});


/**
 * 根据当前选择获取翻译按钮tooltip
 */
function getTranslationButtonTooltips(state: any): readonly Tooltip[] {
  
  // 如果气泡已显示，则不显示按钮
  if (state.field(translationTooltipField).length > 0) return [];
  
  const selection = state.selection.main;
  
  // 如果没有选中文本，不显示按钮
  if (selection.empty) return [];
  
  // 获取选中的文本
  const selectedText = state.sliceDoc(selection.from, selection.to);
  
  // 检查文本是否只包含空格
  if (!selectedText.trim()) {
    return [];
  }
  
  // 检查文本长度条件
  if (selectedText.length < currentConfig.minSelectionLength || 
      selectedText.length > currentConfig.maxTranslationLength) {
    return [];
  }
  
  // 保存选中的文本用于翻译
  selectedTextForTranslation = selectedText;
  
  // 返回翻译按钮tooltip配置
  return [{
    pos: selection.to,
    above: false,
    strictSide: true,
    arrow: false,
    create: (view) => {
      // 创建按钮DOM
      const dom = document.createElement('div');
      dom.className = 'cm-translator-button';
      dom.innerHTML = translationIconSvg;

      // 点击事件
      dom.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // 显示翻译气泡
        showTranslationTooltip(view);
      });

      return { dom };
    }
  }];
}

/**
 * 显示翻译气泡
 */
function showTranslationTooltip(view: EditorView) {
  if (!selectedTextForTranslation) return;
  
  // 创建翻译气泡
  const tooltip = createTranslationTooltip(view, selectedTextForTranslation);
  
  // 更新状态以显示气泡
  view.dispatch({
    effects: setTranslationTooltip.of(tooltip)
  });
}

/**
 * 翻译按钮的状态字段
 */
const translationButtonField = StateField.define<readonly Tooltip[]>({
  create(state) {
    return getTranslationButtonTooltips(state);
  },

  update(tooltips, tr) {
    // 如果文档或选择变化，重新计算tooltip
    if (tr.docChanged || tr.selection) {
      return getTranslationButtonTooltips(tr.state);
    }
    
    // 检查是否有翻译气泡显示，如果有则不显示按钮
    if (tr.state.field(translationTooltipField).length > 0) {
      return [];
    }
    
    return tooltips;
  },

  provide: field => showTooltip.computeN([field], state => state.field(field))
});

/**
 * 创建翻译扩展
 */
export function createTranslatorExtension(config?: Partial<TranslatorConfig>): Extension {
  // 更新配置
  currentConfig = { ...defaultConfig, ...config };
  
  return [
    // 翻译按钮tooltip
    translationButtonField,
    // 翻译气泡tooltip
    translationTooltipField,
    
    // 添加基础样式
    EditorView.baseTheme({
      ".cm-translator-button": {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        background: "var(--bg-secondary, transparent)",
        color: "var(--text-muted, #4285f4)",
        border: "1px solid var(--border-color, #dadce0)",
        borderRadius: "3px",
        padding: "2px",
        width: "24px",
        height: "24px",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.08)",
        userSelect: "none",
        "&:hover": {
          background: "var(--bg-hover, rgba(66, 133, 244, 0.1))"
        }
      },
      
      // 翻译气泡样式
      ".cm-translation-tooltip": {
        background: "var(--bg-secondary, #fff)",
        color: "var(--text-primary, #333)",
        border: "1px solid var(--border-color, #dadce0)",
        borderRadius: "3px",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
        padding: "8px",
        maxWidth: "300px",
        maxHeight: "200px",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "var(--font-family, system-ui, -apple-system, sans-serif)",
        fontSize: "11px"
      },
      
      ".cm-translation-header": {
        marginBottom: "8px",
        flexShrink: "0"
      },
      
      ".cm-translation-controls": {
        display: "flex",
        alignItems: "center",
        gap: "4px",
        flexWrap: "nowrap"
      },
      
      ".cm-translation-select": {
        padding: "2px 4px",
        borderRadius: "3px",
        border: "1px solid var(--border-color, #dadce0)",
        background: "var(--bg-primary, #f5f5f5)",
        fontSize: "11px",
        color: "var(--text-primary, #333)",
        flex: "1",
        minWidth: "0",
        maxWidth: "80px"
      },
      
      ".cm-translation-swap": {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "16px",
        height: "16px",
        borderRadius: "3px",
        border: "1px solid var(--border-color, #dadce0)",
        background: "var(--bg-primary, transparent)",
        color: "var(--text-muted, #666)",
        cursor: "pointer",
        padding: "0",
        flexShrink: "0",
        "&:hover": {
          background: "var(--bg-hover, rgba(66, 133, 244, 0.1))"
          }
      },
      
      // 滚动容器
      ".cm-translation-scroll-container": {
        overflowY: "auto",
        flex: "1",
        minHeight: "0"
      },
      
      ".cm-translation-result": {
        display: "flex",
        flexDirection: "column"
      },
      
      ".cm-translation-result-header": {
        display: "flex",
        justifyContent: "flex-end",
        marginBottom: "4px"
      },
      
      ".cm-translation-result-wrapper": {
        position: "relative",
        width: "100%"
      },
      
      ".cm-translation-copy-btn": {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "20px",
        height: "20px",
        borderRadius: "3px",
        border: "1px solid var(--border-color, #dadce0)",
        background: "var(--bg-primary, transparent)",
        color: "var(--text-muted, #666)",
        cursor: "pointer",
        padding: "0",
        position: "absolute",
        top: "4px",
        right: "4px",
        zIndex: "2",
        opacity: "0.7",
        "&:hover": {
          background: "var(--bg-hover, rgba(66, 133, 244, 0.1))",
          opacity: "1"
        },
        "&.copied": {
          background: "var(--bg-success, #4caf50)",
          color: "white",
          border: "1px solid var(--bg-success, #4caf50)",
          opacity: "1"
        }
      },
      
      ".cm-translation-target": {
        padding: "6px",
        paddingRight: "28px", // 为复制按钮留出空间
        background: "var(--bg-primary, rgba(66, 133, 244, 0.05))",
        color: "var(--text-primary, #333)",
        borderRadius: "3px",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word"
      },
      
      ".cm-translation-notice": {
        fontSize: "10px",
        color: "var(--text-muted, #888)",
        padding: "2px 0",
        fontStyle: "italic",
        textAlign: "center",
        marginBottom: "2px"
      },
      
      ".cm-translation-error": {
        color: "var(--text-danger, #d32f2f)",
        fontStyle: "italic"
      },
      
      ".cm-translation-loading": {
        padding: "8px",
        textAlign: "center",
        color: "var(--text-muted, #666)",
        fontSize: "11px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px"
      },
      
      ".cm-translation-loading::before": {
        content: "''",
        display: "inline-block",
        width: "12px",
        height: "12px",
        borderRadius: "50%",
        border: "2px solid var(--text-muted, #666)",
        borderTopColor: "transparent",
        animation: "cm-translation-spin 1s linear infinite"
      },
      
      "@keyframes cm-translation-spin": {
        "0%": { transform: "rotate(0deg)" },
        "100%": { transform: "rotate(360deg)" }
      }
    })
  ];
}

export default createTranslatorExtension; 