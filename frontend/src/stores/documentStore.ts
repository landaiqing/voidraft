import {defineStore} from 'pinia';
import {computed, ref} from 'vue';
import {DocumentService} from '@/../bindings/voidraft/internal/services';
import {Document} from '@/../bindings/voidraft/internal/models/models';
import {useLogStore} from './logStore';
import {useI18n} from 'vue-i18n';

export const useDocumentStore = defineStore('document', () => {
  const logStore = useLogStore();
  const { t } = useI18n();

  // 状态
  const activeDocument = ref<Document | null>(null);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const lastSaved = ref<Date | null>(null);

  // 计算属性
  const documentContent = computed(() => activeDocument.value?.content || '');
  const documentTitle = computed(() => activeDocument.value?.meta?.title || '');
  const hasActiveDocument = computed(() => !!activeDocument.value);
  const isSaveInProgress = computed(() => isSaving.value);
  const lastSavedTime = computed(() => lastSaved.value);

  // 加载文档
  async function loadDocument() {
    if (isLoading.value) return;
    
    isLoading.value = true;
    try {
        activeDocument.value = await DocumentService.GetActiveDocument();
      logStore.info(t('document.loadSuccess'));
    } catch (err) {
      console.error('Failed to load document:', err);
      logStore.error(t('document.loadFailed'));
      activeDocument.value = null;
    } finally {
      isLoading.value = false;
    }
  }

  // 保存文档
  async function saveDocument(content: string): Promise<boolean> {
    if (isSaving.value) return false;
    
    isSaving.value = true;
    try {
      await DocumentService.UpdateActiveDocumentContent(content);
      lastSaved.value = new Date();
      
      // 如果我们有活动文档，更新本地副本
      if (activeDocument.value) {
        activeDocument.value.content = content;
        activeDocument.value.meta.lastUpdated = lastSaved.value;
      }
      
      logStore.info(t('document.saveSuccess'));
      return true;
    } catch (err) {
      console.error('Failed to save document:', err);
      logStore.error(t('document.saveFailed'));
      return false;
    } finally {
      isSaving.value = false;
    }
  }

  // 强制保存文档到磁盘
  async function forceSaveDocument(content: string): Promise<boolean> {
    if (isSaving.value) return false;
    
    isSaving.value = true;
    try {
      // 先更新内容
      await DocumentService.UpdateActiveDocumentContent(content);
      // 然后强制保存
      await DocumentService.ForceSave();
      
      lastSaved.value = new Date();
      
      // 如果我们有活动文档，更新本地副本
      if (activeDocument.value) {
        activeDocument.value.content = content;
        activeDocument.value.meta.lastUpdated = lastSaved.value;
      }
      
      logStore.info(t('document.manualSaveSuccess'));
      return true;
    } catch (err) {
      console.error('Failed to force save document:', err);
      logStore.error(t('document.saveFailed'));
      return false;
    } finally {
      isSaving.value = false;
    }
  }

  // 初始化
  async function initialize() {
    await loadDocument();
  }

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