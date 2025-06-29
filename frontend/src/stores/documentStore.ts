import {defineStore} from 'pinia';
import {computed, ref} from 'vue';
import {DocumentService} from '@/../bindings/voidraft/internal/services';
import {Document} from '@/../bindings/voidraft/internal/models/models';

export const useDocumentStore = defineStore('document', () => {
    // 状态
    const currentDocument = ref<Document | null>(null);
    const isLoading = ref(false);
    const isSaving = ref(false);
    const lastSaved = ref<Date | null>(null);

    // 计算属性
    const documentContent = computed(() => currentDocument.value?.content ?? '');
    const documentTitle = computed(() => currentDocument.value?.title ?? '');
    const hasDocument = computed(() => !!currentDocument.value);
    const isSaveInProgress = computed(() => isSaving.value);
    const lastSavedTime = computed(() => lastSaved.value);

    // 加载文档
    const loadDocument = async (documentId = 1): Promise<Document | null> => {
        if (isLoading.value) return currentDocument.value;

        isLoading.value = true;
        try {
            const doc = await DocumentService.GetDocumentByID(documentId);
            if (doc) {
                currentDocument.value = doc;
                return doc;
            }
            return null;
        } catch (error) {
            return null;
        } finally {
            isLoading.value = false;
        }
    };

    // 保存文档内容
    const saveDocumentContent = async (content: string): Promise<boolean> => {
        // 如果内容没有变化，直接返回成功
        if (currentDocument.value?.content === content) {
            return true;
        }

        // 如果正在保存中，直接返回
        if (isSaving.value) {
            return false;
        }

        isSaving.value = true;
        try {
            const documentId = currentDocument.value?.id || 1;
            await DocumentService.UpdateDocumentContent(documentId, content);
            
            const now = new Date();
            lastSaved.value = now;

            // 更新本地副本
            if (currentDocument.value) {
                currentDocument.value.content = content;
                currentDocument.value.updatedAt = now;
            }

            return true;
        } catch (error) {
            return false;
        } finally {
            isSaving.value = false;
        }
    };

    // 保存文档标题
    const saveDocumentTitle = async (title: string): Promise<boolean> => {
        if (!currentDocument.value || currentDocument.value.title === title) {
            return true;
        }

        try {
            await DocumentService.UpdateDocumentTitle(currentDocument.value.id, title);
            const now = new Date();
            lastSaved.value = now;
            currentDocument.value.title = title;
            currentDocument.value.updatedAt = now;
            return true;
        } catch (error) {
            return false;
        }
    };

    // 初始化
    const initialize = async (): Promise<void> => {
        await loadDocument();
    };

    return {
        // 状态
        currentDocument,
        isLoading,
        isSaving,
        lastSaved,

        // 计算属性
        documentContent,
        documentTitle,
        hasDocument,
        isSaveInProgress,
        lastSavedTime,

        // 方法
        loadDocument,
        saveDocumentContent,
        saveDocumentTitle,
        initialize
    };
}); 