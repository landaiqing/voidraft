import { Extension, StateField, StateEffect, StateEffectType } from '@codemirror/state';
import { EditorView, showTooltip, Tooltip } from '@codemirror/view';
import { createTranslationTooltip } from './tooltip';
import { 
  TranslatorConfig, 
  DEFAULT_TRANSLATION_CONFIG, 
  TRANSLATION_ICON_SVG 
} from '@/common/constant/translation';


class TranslatorExtension {
  private config: TranslatorConfig;
  private setTranslationTooltip: StateEffectType<Tooltip | null>;
  private translationTooltipField: StateField<readonly Tooltip[]>;
  private translationButtonField: StateField<readonly Tooltip[]>;

  constructor(config?: Partial<TranslatorConfig>) {
    // 初始化配置
    this.config = {
      minSelectionLength: DEFAULT_TRANSLATION_CONFIG.minSelectionLength,
      maxTranslationLength: DEFAULT_TRANSLATION_CONFIG.maxTranslationLength,
      ...config
    };

    // 初始化状态效果
    this.setTranslationTooltip = StateEffect.define<Tooltip | null>();

    // 初始化翻译气泡状态字段
    this.translationTooltipField = StateField.define<readonly Tooltip[]>({
      create: () => [],
      update: (tooltips, tr) => {
        // 检查是否有特定的状态效果来更新tooltips
        for (const effect of tr.effects) {
          if (effect.is(this.setTranslationTooltip)) {
            return effect.value ? [effect.value] : [];
          }
        }
        
        // 如果文档或选择变化，隐藏气泡
        if (tr.docChanged || tr.selection) {
          return [];
        }
        
        return tooltips;
      },
      provide: field => showTooltip.computeN([field], state => state.field(field))
    });

    // 初始化翻译按钮状态字段
    this.translationButtonField = StateField.define<readonly Tooltip[]>({
      create: (state) => this.getTranslationButtonTooltips(state),
      update: (tooltips, tr) => {
        // 如果文档或选择变化，重新计算tooltip
        if (tr.docChanged || tr.selection) {
          return this.getTranslationButtonTooltips(tr.state);
        }
        
        // 检查是否有翻译气泡显示，如果有则不显示按钮
        if (tr.state.field(this.translationTooltipField).length > 0) {
          return [];
        }
        
        return tooltips;
      },
      provide: field => showTooltip.computeN([field], state => state.field(field))
    });
  }

  /**
   * 根据当前选择获取翻译按钮tooltip
   */
  private getTranslationButtonTooltips(state: any): readonly Tooltip[] {
    // 如果气泡已显示，则不显示按钮
    if (state.field(this.translationTooltipField).length > 0) return [];
    
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
    if (selectedText.length < this.config.minSelectionLength || 
        selectedText.length > this.config.maxTranslationLength) {
      return [];
    }
    
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
        dom.innerHTML = TRANSLATION_ICON_SVG;

        // 点击事件
        dom.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // 显示翻译气泡
          this.showTranslationTooltip(view);
        });

        return { dom };
      }
    }];
  }

  /**
   * 显示翻译气泡
   */
  private showTranslationTooltip(view: EditorView) {
    // 直接从当前选择获取文本
    const selection = view.state.selection.main;
    if (selection.empty) return;
    
    const selectedText = view.state.sliceDoc(selection.from, selection.to);
    if (!selectedText.trim()) return;
    
    // 创建翻译气泡
    const tooltip = createTranslationTooltip(view, selectedText);
    
    // 更新状态以显示气泡
    view.dispatch({
      effects: this.setTranslationTooltip.of(tooltip)
    });
  }

  /**
   * 创建扩展
   */
  createExtension(): Extension {
    return [
      // 翻译按钮tooltip
      this.translationButtonField,
      // 翻译气泡tooltip
      this.translationTooltipField,
      
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
          fontSize: "11px",
          userSelect: "none",
          cursor: "grab"
        },
        
        // 拖拽状态样式
        ".cm-translation-dragging": {
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
          zIndex: "1000",
          cursor: "grabbing !important"
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
}

/**
 * 创建翻译扩展
 */
export function createTranslatorExtension(config?: Partial<TranslatorConfig>): Extension {
  const translatorExtension = new TranslatorExtension(config);
  return translatorExtension.createExtension();
}

export default createTranslatorExtension;