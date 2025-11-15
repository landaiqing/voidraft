import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { EditorView } from '@codemirror/view';
import { useDocumentStore } from './documentStore';

/**
 * 单个文档的预览状态
 */
interface DocumentPreviewState {
  isOpen: boolean;
  isClosing: boolean;
  blockFrom: number;
  blockTo: number;
}

/**
 * 面板状态管理 Store
 * 管理编辑器中各种面板的显示状态（按文档ID区分）
 */
export const usePanelStore = defineStore('panel', () => {
  // 当前编辑器视图引用
  const editorView = ref<EditorView | null>(null);

  // 每个文档的预览状态 Map<documentId, PreviewState>
  const documentPreviews = ref<Map<number, DocumentPreviewState>>(new Map());

  /**
   * 获取当前文档的预览状态
   */
  const markdownPreview = computed(() => {
    const documentStore = useDocumentStore();
    const currentDocId = documentStore.currentDocumentId;
    
    if (currentDocId === null) {
      return {
        isOpen: false,
        isClosing: false,
        blockFrom: 0,
        blockTo: 0
      };
    }

    return documentPreviews.value.get(currentDocId) || {
      isOpen: false,
      isClosing: false,
      blockFrom: 0,
      blockTo: 0
    };
  });

  /**
   * 设置编辑器视图
   */
  const setEditorView = (view: EditorView | null) => {
    editorView.value = view;
  };

  /**
   * 打开 Markdown 预览面板
   */
  const openMarkdownPreview = (from: number, to: number) => {
    const documentStore = useDocumentStore();
    const currentDocId = documentStore.currentDocumentId;
    
    if (currentDocId === null) return;

    documentPreviews.value.set(currentDocId, {
      isOpen: true,
      isClosing: false,
      blockFrom: from,
      blockTo: to
    });
  };

  /**
   * 开始关闭 Markdown 预览面板
   */
  const startClosingMarkdownPreview = () => {
    const documentStore = useDocumentStore();
    const currentDocId = documentStore.currentDocumentId;
    
    if (currentDocId === null) return;

    const state = documentPreviews.value.get(currentDocId);
    if (state?.isOpen) {
      documentPreviews.value.set(currentDocId, {
        ...state,
        isClosing: true
      });
    }
  };

  /**
   * 关闭 Markdown 预览面板
   */
  const closeMarkdownPreview = () => {
    const documentStore = useDocumentStore();
    const currentDocId = documentStore.currentDocumentId;
    
    if (currentDocId === null) return;

    documentPreviews.value.set(currentDocId, {
      isOpen: false,
      isClosing: false,
      blockFrom: 0,
      blockTo: 0
    });
  };

  /**
   * 更新预览块的范围（用于实时预览）
   */
  const updatePreviewRange = (from: number, to: number) => {
    const documentStore = useDocumentStore();
    const currentDocId = documentStore.currentDocumentId;
    
    if (currentDocId === null) return;

    const state = documentPreviews.value.get(currentDocId);
    if (state?.isOpen) {
      documentPreviews.value.set(currentDocId, {
        ...state,
        blockFrom: from,
        blockTo: to
      });
    }
  };

  /**
   * 检查指定块是否正在预览
   */
  const isBlockPreviewing = (from: number, to: number): boolean => {
    const preview = markdownPreview.value;
    return preview.isOpen &&
           preview.blockFrom === from &&
           preview.blockTo === to;
  };

  /**
   * 重置所有面板状态
   */
  const reset = () => {
    documentPreviews.value.clear();
    editorView.value = null;
  };

  /**
   * 清理指定文档的预览状态（文档关闭时调用）
   */
  const clearDocumentPreview = (documentId: number) => {
    documentPreviews.value.delete(documentId);
  };

  return {
    // 状态
    editorView,
    markdownPreview,

    // 方法
    setEditorView,
    openMarkdownPreview,
    startClosingMarkdownPreview,
    closeMarkdownPreview,
    updatePreviewRange,
    isBlockPreviewing,
    reset,
    clearDocumentPreview
  };
});

