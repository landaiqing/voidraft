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

  // 状态管理包装器
  const withStateGuard = async <T>(
    operation: () => Promise<T>,
    stateRef: typeof isLoading | typeof isSaving
  ): Promise<T | null> => {
    if (stateRef.value) return null;
    
    stateRef.value = true;
    try {
      return await operation();
    } finally {
      stateRef.value = false;
    }
  };

  // 加载文档
  const loadDocument = () => withStateGuard(
    async () => {
      const doc = await DocumentService.GetActiveDocument();
      activeDocument.value = doc;
      return doc;
    },
    isLoading
  );

  // 保存文档
  const saveDocument = async (content: string): Promise<boolean> => {
    const result = await withStateGuard(
      async () => {
        await DocumentService.UpdateActiveDocumentContent(content);
        lastSaved.value = new Date();
        
        // 使用可选链更新本地副本
        if (activeDocument.value) {
          activeDocument.value.content = content;
          activeDocument.value.meta.lastUpdated = lastSaved.value;
        }
        
        return true;
      },
      isSaving
    );
    
    return result ?? false;
  };

  // 强制保存文档到磁盘
  const forceSaveDocument = async (): Promise<boolean> => {
    const result = await withStateGuard(
      async () => {
        // 直接调用强制保存API
        await DocumentService.ForceSave();
        
        lastSaved.value = new Date();
        
        // 使用可选链更新时间戳
        if (activeDocument.value) {
          activeDocument.value.meta.lastUpdated = lastSaved.value;
        }
        
        return true;
      },
      isSaving
    );
    
    return result ?? false;
  };

  // 初始化
  const initialize = async () => {
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