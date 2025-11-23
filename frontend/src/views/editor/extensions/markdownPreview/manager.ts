import type { EditorView } from '@codemirror/view';
import { shallowRef, type ShallowRef } from 'vue';

/**
 * 预览面板位置配置
 */
interface PreviewPosition {
  height: number;
}

/**
 * 预览状态
 */
interface PreviewState {
  visible: boolean;
  position: PreviewPosition;
  content: string;
  blockFrom: number;
  blockTo: number;
  documentId: number | null;
  view: EditorView | null;
}

/**
 * Markdown 预览管理器类
 */
class MarkdownPreviewManager {
  private state: ShallowRef<PreviewState> = shallowRef({
    visible: false,
    position: { height: 300 },
    content: '',
    blockFrom: 0,
    blockTo: 0,
    documentId: null,
    view: null
  });

  /**
   * 获取状态（供 Vue 组件使用）
   */
  useState() {
    return this.state;
  }

  /**
   * 显示预览面板
   */
  show(view: EditorView, documentId: number, blockFrom: number, blockTo: number): void {
    const content = view.state.doc.sliceString(blockFrom, blockTo);
    
    // 计算初始高度（编辑器容器高度的 50%）
    const containerHeight = view.dom.parentElement?.clientHeight || view.dom.clientHeight;
    const defaultHeight = Math.floor(containerHeight * 0.5);
    
    this.state.value = {
      visible: true,
      position: { height: Math.max(100, defaultHeight) },
      content,
      blockFrom,
      blockTo,
      documentId,
      view
    };
  }

  /**
   * 更新预览内容（文档编辑时调用）
   */
  updateContent(content: string, blockFrom: number, blockTo: number): void {
    if (!this.state.value.visible) return;

    this.state.value = {
      ...this.state.value,
      content,
      blockFrom,
      blockTo
    };
  }

  /**
   * 更新面板高度
   */
  updateHeight(height: number): void {
    if (!this.state.value.visible) return;

    this.state.value = {
      ...this.state.value,
      position: { height: Math.max(100, height) }
    };
  }

  /**
   * 隐藏预览面板
   */
  hide(): void {
    if (!this.state.value.visible) return;

    const view = this.state.value.view;
    
    this.state.value = {
      visible: false,
      position: { height: 300 },
      content: '',
      blockFrom: 0,
      blockTo: 0,
      documentId: null,
      view: null
    };

    // 关闭后聚焦编辑器
    if (view) {
      view.focus();
    }
  }

  /**
   * 检查预览是否可见
   */
  isVisible(): boolean {
    return this.state.value.visible;
  }

  /**
   * 获取当前预览的文档 ID
   */
  getCurrentDocumentId(): number | null {
    return this.state.value.documentId;
  }

  /**
   * 获取当前预览的块范围
   */
  getCurrentBlockRange(): { from: number; to: number } | null {
    if (!this.state.value.visible) return null;
    return {
      from: this.state.value.blockFrom,
      to: this.state.value.blockTo
    };
  }

  /**
   * 清理资源
   */
  destroy(): void {
    this.state.value = {
      visible: false,
      position: { height: 300 },
      content: '',
      blockFrom: 0,
      blockTo: 0,
      documentId: null,
      view: null
    };
  }
}

/**
 * 导出单例
 */
export const markdownPreviewManager = new MarkdownPreviewManager();

