import { defineStore } from 'pinia';
import { computed, shallowRef, type ShallowRef } from 'vue';
import { EditorView } from '@codemirror/view';
import { ensureSyntaxTree } from '@codemirror/language';
import { LruCache, type CacheItem, type DisposableCacheItem, createHash } from '@/common/cache';
import { removeExtensionManagerView } from '@/views/editor/manager';

/** 语法树缓存信息 */
interface SyntaxTreeCache {
  readonly lastDocLength: number;
  readonly lastContentHash: string;
  readonly lastParsed: Date;
}

/** 编辑器状态 */
interface EditorState {
  content: string;
  isDirty: boolean;
  lastModified: Date;
}

/** 编辑器缓存项 */
export interface EditorCacheItem extends CacheItem, DisposableCacheItem {
  readonly view: EditorView;
  readonly documentId: number;
  state: EditorState;
  autoSaveTimer: number | null;
  syntaxTreeCache: SyntaxTreeCache | null;
}

// === 缓存配置 ===
const CACHE_CONFIG = {
  maxSize: 5,
  syntaxTreeExpireTime: 30000, // 30秒
} as const;

export const useEditorCacheStore = defineStore('editorCache', () => {
  // === 状态 ===
  const containerElement: ShallowRef<HTMLElement | null> = shallowRef(null);

  // === 内部方法 ===
  const cleanupEditor = (item: EditorCacheItem): void => {
    try {
      // 清除自动保存定时器
      if (item.autoSaveTimer) {
        clearTimeout(item.autoSaveTimer);
        item.autoSaveTimer = null;
      }

      // 从扩展管理器中移除视图
      removeExtensionManagerView(item.documentId);

      // 移除DOM元素
      item.view.dom?.remove();

      // 销毁编辑器
      item.view.destroy?.();
    } catch (error) {
      console.error(`Failed to cleanup editor ${item.documentId}:`, error);
    }
  };

  const createEditorCacheItem = (
    documentId: number,
    view: EditorView,
    content: string
  ): EditorCacheItem => {
    const now = new Date();
    
    const item: EditorCacheItem = {
      id: documentId,
      lastAccessed: now,
      createdAt: now,
      view,
      documentId,
      state: {
        content,
        isDirty: false,
        lastModified: now
      },
      autoSaveTimer: null,
      syntaxTreeCache: null,
      dispose: () => cleanupEditor(item)
    };
    
    return item;
  };

  const shouldRebuildSyntaxTree = (
    item: EditorCacheItem,
    docLength: number,
    contentHash: string
  ): boolean => {
    const { syntaxTreeCache } = item;
    if (!syntaxTreeCache) return true;

    const now = Date.now();
    const isExpired = (now - syntaxTreeCache.lastParsed.getTime()) > CACHE_CONFIG.syntaxTreeExpireTime;
    const isContentChanged = syntaxTreeCache.lastDocLength !== docLength || 
                            syntaxTreeCache.lastContentHash !== contentHash;

    return isExpired || isContentChanged;
  };

  const buildSyntaxTree = (view: EditorView, item: EditorCacheItem): void => {
    const docLength = view.state.doc.length;
    const content = view.state.doc.toString();
    const contentHash = createHash(content);

    if (!shouldRebuildSyntaxTree(item, docLength, contentHash)) {
      return;
    }

    try {
      ensureSyntaxTree(view.state, docLength, 5000);
      
      item.syntaxTreeCache = {
        lastDocLength: docLength,
        lastContentHash: contentHash,
        lastParsed: new Date()
      };
    } catch (error) {
      console.warn(`Failed to build syntax tree for editor ${item.documentId}:`, error);
    }
  };

  // === 缓存实例 ===
  const cache = new LruCache<EditorCacheItem>({
    maxSize: CACHE_CONFIG.maxSize,
    onEvict: cleanupEditor
  });

  // === 计算属性 ===
  const cacheSize = computed(() => cache.size());
  const cacheStats = computed(() => cache.getStats());
  const allEditors = computed(() => cache.getAll());
  const dirtyEditors = computed(() => 
    allEditors.value.filter(item => item.state.isDirty)
  );

  // === 公共方法 ===

  // 容器管理
  const setContainer = (element: HTMLElement | null): void => {
    containerElement.value = element;
  };

  const getContainer = (): HTMLElement | null => containerElement.value;

  // 基础缓存操作
  const addEditor = (documentId: number, view: EditorView, content: string): void => {
    const item = createEditorCacheItem(documentId, view, content);
    cache.set(documentId, item);
    
    // 初始化语法树缓存
    buildSyntaxTree(view, item);
  };

  const getEditor = (documentId: number): EditorCacheItem | null => {
    return cache.get(documentId);
  };

  const hasEditor = (documentId: number): boolean => {
    return cache.has(documentId);
  };

  const removeEditor = (documentId: number): boolean => {
    return cache.remove(documentId);
  };

  const clearAll = (): void => {
    cache.clear();
  };

  // 编辑器状态管理
  const updateEditorContent = (documentId: number, content: string): boolean => {
    const item = cache.get(documentId);
    if (!item) return false;

    item.state.content = content;
    item.state.isDirty = false;
    item.state.lastModified = new Date();
    item.syntaxTreeCache = null; // 清理语法树缓存
    
    return true;
  };

  const markEditorDirty = (documentId: number): boolean => {
    const item = cache.get(documentId);
    if (!item) return false;

    item.state.isDirty = true;
    item.state.lastModified = new Date();
    item.syntaxTreeCache = null; // 清理语法树缓存
    
    return true;
  };

  // 自动保存管理
  const setAutoSaveTimer = (documentId: number, timer: number): boolean => {
    const item = cache.get(documentId);
    if (!item) return false;

    // 清除之前的定时器
    if (item.autoSaveTimer) {
      clearTimeout(item.autoSaveTimer);
    }
    item.autoSaveTimer = timer;
    
    return true;
  };

  const clearAutoSaveTimer = (documentId: number): boolean => {
    const item = cache.get(documentId);
    if (!item || !item.autoSaveTimer) return false;

    clearTimeout(item.autoSaveTimer);
    item.autoSaveTimer = null;
    
    return true;
  };

  // 语法树管理
  const ensureSyntaxTreeCached = (view: EditorView, documentId: number): void => {
    const item = cache.get(documentId);
    if (!item) return;

    buildSyntaxTree(view, item);
  };

  const cleanupExpiredSyntaxTrees = (): void => {
    const now = Date.now();
    allEditors.value.forEach(item => {
      if (item.syntaxTreeCache && 
          (now - item.syntaxTreeCache.lastParsed.getTime()) > CACHE_CONFIG.syntaxTreeExpireTime) {
        item.syntaxTreeCache = null;
      }
    });
  };

  return {
    // 容器管理
    setContainer,
    getContainer,
    
    // 基础缓存操作
    addEditor,
    getEditor,
    hasEditor,
    removeEditor,
    clearAll,
    
    // 编辑器状态管理
    updateEditorContent,
    markEditorDirty,
    
    // 自动保存管理
    setAutoSaveTimer,
    clearAutoSaveTimer,
    
    // 语法树管理
    ensureSyntaxTreeCached,
    cleanupExpiredSyntaxTrees,
    
    // 计算属性
    cacheSize,
    cacheStats,
    allEditors,
    dirtyEditors
  };
});