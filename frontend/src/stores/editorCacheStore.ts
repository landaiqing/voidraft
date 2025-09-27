import { defineStore } from 'pinia';
import { ref } from 'vue';
import { EditorView } from '@codemirror/view';
import { ensureSyntaxTree } from '@codemirror/language';
import { LRUCache, type CacheItem, type DisposableCacheItem, createContentHash } from '@/common/cache';
import { removeExtensionManagerView } from '@/views/editor/manager';

// 编辑器缓存项接口
export interface EditorCacheItem extends CacheItem, DisposableCacheItem {
  view: EditorView;
  documentId: number;
  content: string;
  isDirty: boolean;
  lastModified: Date;
  autoSaveTimer: number | null;
  syntaxTreeCache: {
    lastDocLength: number;
    lastContentHash: string;
    lastParsed: Date;
  } | null;
}

export const useEditorCacheStore = defineStore('editorCache', () => {
  // 清理编辑器实例的函数
  const cleanupEditorInstance = (item: EditorCacheItem) => {
    try {
      // 清除自动保存定时器
      if (item.autoSaveTimer) {
        clearTimeout(item.autoSaveTimer);
        item.autoSaveTimer = null;
      }

      // 从扩展管理器中移除视图
      removeExtensionManagerView(item.documentId);

      // 移除DOM元素
      if (item.view && item.view.dom && item.view.dom.parentElement) {
        item.view.dom.remove();
      }

      // 销毁编辑器
      if (item.view && item.view.destroy) {
        item.view.destroy();
      }
    } catch (error) {
      console.error('Error cleaning up editor instance:', error);
    }
  };

  // 创建编辑器缓存项
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
      content,
      isDirty: false,
      lastModified: now,
      autoSaveTimer: null,
      syntaxTreeCache: null,
      dispose: () => cleanupEditorInstance(item)
    };
    
    return item;
  };

  // 编辑器缓存配置
  const EDITOR_CACHE_CONFIG = {
    maxSize: 5, // 最多缓存5个编辑器实例
    onEvict: (item: EditorCacheItem) => {
      // 清理被驱逐的编辑器实例
      cleanupEditorInstance(item);
    }
  };
  // 编辑器缓存实例
  const cache = new LRUCache<EditorCacheItem>(EDITOR_CACHE_CONFIG);
  
  // 容器元素
  const containerElement = ref<HTMLElement | null>(null);

  // 设置容器元素
  const setContainer = (element: HTMLElement | null) => {
    containerElement.value = element;
  };

  // 获取容器元素
  const getContainer = () => containerElement.value;

  // 添加编辑器到缓存
  const addEditor = (documentId: number, view: EditorView, content: string) => {
    const item = createEditorCacheItem(documentId, view, content);
    cache.set(documentId, item);
    
    // 初始化语法树缓存
    ensureSyntaxTreeCached(view, documentId);
  };

  // 获取编辑器实例
  const getEditor = (documentId: number): EditorCacheItem | null => {
    return cache.get(documentId);
  };

  // 检查编辑器是否存在
  const hasEditor = (documentId: number): boolean => {
    return cache.has(documentId);
  };

  // 移除编辑器
  const removeEditor = (documentId: number): boolean => {
    return cache.remove(documentId);
  };

  // 获取所有编辑器实例
  const getAllEditors = (): EditorCacheItem[] => {
    return cache.getAll();
  };

  // 清空所有编辑器
  const clearAll = () => {
    cache.clear();
  };

  // 获取缓存大小
  const size = (): number => {
    return cache.size();
  };

  // 获取缓存统计信息
  const getStats = () => {
    return cache.getStats();
  };

  // 缓存化的语法树确保方法
  const ensureSyntaxTreeCached = (view: EditorView, documentId: number): void => {
    const item = cache.get(documentId);
    if (!item) return;

    const docLength = view.state.doc.length;
    const content = view.state.doc.toString();
    const contentHash = createContentHash(content);
    const now = new Date();

    // 检查是否需要重新构建语法树
    const syntaxCache = item.syntaxTreeCache;
    const shouldRebuild = !syntaxCache || 
      syntaxCache.lastDocLength !== docLength || 
      syntaxCache.lastContentHash !== contentHash ||
      (now.getTime() - syntaxCache.lastParsed.getTime()) > 30000; // 30秒过期

    if (shouldRebuild) {
      try {
        ensureSyntaxTree(view.state, docLength, 5000);
        
        // 更新缓存
        item.syntaxTreeCache = {
          lastDocLength: docLength,
          lastContentHash: contentHash,
          lastParsed: now
        };
      } catch (error) {
        console.warn('Failed to ensure syntax tree:', error);
      }
    }
  };

  // 更新编辑器内容
  const updateEditorContent = (documentId: number, content: string) => {
    const item = cache.get(documentId);
    if (item) {
      item.content = content;
      item.isDirty = false;
      item.lastModified = new Date();
      // 清理语法树缓存，因为内容已更新
      item.syntaxTreeCache = null;
    }
  };

  // 标记编辑器为脏状态
  const markEditorDirty = (documentId: number) => {
    const item = cache.get(documentId);
    if (item) {
      item.isDirty = true;
      item.lastModified = new Date();
      // 清理语法树缓存，下次访问时重新构建
      item.syntaxTreeCache = null;
    }
  };

  // 设置自动保存定时器
  const setAutoSaveTimer = (documentId: number, timer: number) => {
    const item = cache.get(documentId);
    if (item) {
      // 清除之前的定时器
      if (item.autoSaveTimer) {
        clearTimeout(item.autoSaveTimer);
      }
      item.autoSaveTimer = timer;
    }
  };

  // 清除自动保存定时器
  const clearAutoSaveTimer = (documentId: number) => {
    const item = cache.get(documentId);
    if (item && item.autoSaveTimer) {
      clearTimeout(item.autoSaveTimer);
      item.autoSaveTimer = null;
    }
  };

  // 获取脏状态的编辑器
  const getDirtyEditors = (): EditorCacheItem[] => {
    return cache.getAll().filter(item => item.isDirty);
  };

  // 清理过期的语法树缓存
  const cleanupExpiredSyntaxTrees = () => {
    const now = new Date();
    cache.getAll().forEach(item => {
      if (item.syntaxTreeCache && 
          (now.getTime() - item.syntaxTreeCache.lastParsed.getTime()) > 30000) {
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
    getAllEditors,
    clearAll,
    size,
    getStats,

    ensureSyntaxTreeCached,
    updateEditorContent,
    markEditorDirty,
    setAutoSaveTimer,
    clearAutoSaveTimer,
    getDirtyEditors,
    cleanupExpiredSyntaxTrees
  };
});