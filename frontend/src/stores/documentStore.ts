import {defineStore} from 'pinia';
import {computed, ref} from 'vue';
import {DocumentService} from '@/../bindings/voidraft/internal/services';
import {Document} from '@/../bindings/voidraft/internal/models/models';

export const useDocumentStore = defineStore('document', () => {
  // 状态
  const activeDocument = ref<Document | null>(null);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const lastSaved = ref<Date | null>(null);

  // 计算属性
  const documentContent = computed(() => activeDocument.value?.content ?? '');
  const documentTitle = computed(() => activeDocument.value?.meta?.title ?? '');
  const hasActiveDocument = computed(() => !!activeDocument.value);
  const isSaveInProgress = computed(() => isSaving.value);
  const lastSavedTime = computed(() => lastSaved.value);

  // 加载文档
  const loadDocument = async (): Promise<Document | null> => {
    if (isLoading.value) return null;
    
    isLoading.value = true;
    try {
      const doc = await DocumentService.GetActiveDocument();
      activeDocument.value = doc;
      return doc;
    } catch (error) {
      return null;
    } finally {
      isLoading.value = false;
    }
  };

  // 保存文档
  const saveDocument = async (content: string): Promise<boolean> => {
    if (isSaving.value) return false;
    
    isSaving.value = true;
    try {
      await DocumentService.UpdateActiveDocumentContent(content);
      lastSaved.value = new Date();
      
      // 更新本地副本
      if (activeDocument.value) {
        activeDocument.value.content = content;
        activeDocument.value.meta.lastUpdated = lastSaved.value;
      }
      
      return true;
    } catch (error) {
      return false;
    } finally {
      isSaving.value = false;
    }
  };

  // 强制保存文档到磁盘
  const forceSaveDocument = async (): Promise<boolean> => {
    if (isSaving.value) return false;
    
    isSaving.value = true;
    try {
      await DocumentService.ForceSave();
      lastSaved.value = new Date();
      
      // 更新时间戳
      if (activeDocument.value) {
        activeDocument.value.meta.lastUpdated = lastSaved.value;
      }
      
      return true;
    } catch (error) {
      return false;
    } finally {
      isSaving.value = false;
    }
  };

  // 初始化
  const initialize = async (): Promise<void> => {
    await loadDocument();
  };

  return {
    // 状态
    activeDocument,
    isLoading,
    isSaving,
    lastSaved,
    
    // 计算属性
    documentContent,
    documentTitle,
    hasActiveDocument,
    isSaveInProgress,
    lastSavedTime,
    
    // 方法
    loadDocument,
    saveDocument,
    forceSaveDocument,
    initialize
  };
}); 