/**
 * Markdown 预览面板的 CodeMirror 状态管理
 */
import { EditorView, showPanel, ViewUpdate, ViewPlugin } from "@codemirror/view";
import { StateEffect, StateField } from "@codemirror/state";
import { getActiveNoteBlock } from "../codeblock/state";
import { usePanelStore } from "@/stores/panelStore";
import { createPreviewPanel } from "./panel";
import type { PreviewState } from "./types";

/**
 * 定义切换预览面板的 Effect
 */
export const togglePreview = StateEffect.define<PreviewState | null>();

/**
 * 关闭面板（带动画）
 */
export function closePreviewWithAnimation(view: EditorView): void {
  const panelStore = usePanelStore();
  
  // 标记开始关闭
  panelStore.startClosingMarkdownPreview();
  
  const panelElement = view.dom.querySelector('.cm-panels.cm-panels-bottom') as HTMLElement;
  if (panelElement) {
    panelElement.style.animation = 'panelSlideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    // 等待动画完成后再关闭面板
    setTimeout(() => {
      view.dispatch({
        effects: togglePreview.of(null)
      });
      panelStore.closeMarkdownPreview();
    }, 280);
  } else {
    view.dispatch({
      effects: togglePreview.of(null)
    });
    panelStore.closeMarkdownPreview();
  }
}

/**
 * 定义预览面板的状态字段
 */
export const previewPanelState = StateField.define<PreviewState | null>({
  create: () => null,
  update(value, tr) {
    const panelStore = usePanelStore();
    
    for (let e of tr.effects) {
      if (e.is(togglePreview)) {
        value = e.value;
      }
    }
    
    // 如果有预览状态，智能管理预览生命周期
    if (value && !value.closing) {
      const activeBlock = getActiveNoteBlock(tr.state as any);
      
      // 关键修复：检查预览状态是否属于当前文档
      // 如果 panelStore 中没有当前文档的预览状态（说明切换了文档），
      // 则不执行关闭逻辑，保持其他文档的预览状态
      if (!panelStore.markdownPreview.isOpen) {
        // 当前文档没有预览，不处理
        return value;
      }
      
      // 场景1：离开 Markdown 块或无激活块 → 关闭预览
      if (!activeBlock || activeBlock.language.name.toLowerCase() !== 'md') {
        if (!panelStore.markdownPreview.isClosing) {
          return { ...value, closing: true };
        }
      } 
      // 场景2：切换到其他块（起始位置变化）→ 关闭预览
      else if (activeBlock.content.from !== value.blockFrom) {
        if (!panelStore.markdownPreview.isClosing) {
          return { ...value, closing: true };
        }
      } 
      // 场景3：还在同一个块内编辑（只有结束位置变化）→ 更新范围，实时预览
      else if (activeBlock.content.to !== value.blockTo) {
        // 更新 panelStore 中的预览范围
        panelStore.updatePreviewRange(value.blockFrom, activeBlock.content.to);
        
        return {
          documentId: value.documentId,
          blockFrom: value.blockFrom,
          blockTo: activeBlock.content.to,
          closing: false
        };
      }
    }
    
    return value;
  },
  provide: f => showPanel.from(f, state => state ? createPreviewPanel : null)
});

/**
 * 创建监听插件
 */
export const previewPanelPlugin = ViewPlugin.fromClass(class {
  private lastState: PreviewState | null | undefined = null;
  private panelStore = usePanelStore();

  constructor(private view: EditorView) {
    this.lastState = view.state.field(previewPanelState, false);
    this.panelStore.setEditorView(view);
  }

  update(update: ViewUpdate) {
    const currentState = update.state.field(previewPanelState, false);
    
    // 检测到面板打开（从 null 变为有值，且不是 closing）
    if (currentState && !currentState.closing && !this.lastState) {
      // 验证面板 DOM 是否真正创建成功
      requestAnimationFrame(() => {
        const panelElement = this.view.dom.querySelector('.cm-markdown-preview-panel');
        if (panelElement) {
          // 面板创建成功，更新 store 状态
          this.panelStore.openMarkdownPreview(currentState.blockFrom, currentState.blockTo);
        }
      });
    }
    
    // 检测到状态变为 closing
    if (currentState?.closing && !this.lastState?.closing) {
      // 触发关闭动画
      closePreviewWithAnimation(this.view);
    }
    
    this.lastState = currentState;
  }
  
  destroy() {
    // 不调用 reset()，因为那会清空所有文档的预览状态
    // 只清理编辑器视图引用
    this.panelStore.setEditorView(null);
  }
});

