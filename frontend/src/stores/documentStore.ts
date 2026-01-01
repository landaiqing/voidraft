import {defineStore} from 'pinia';
import {ref} from 'vue';
import {DocumentService} from '@/../bindings/voidraft/internal/services';
import {OpenDocumentWindow} from '@/../bindings/voidraft/internal/services/windowservice';
import {Document} from '@/../bindings/voidraft/internal/models/ent/models';
import type {TimerManager} from '@/common/utils/timerUtils';
import {createTimerManager} from '@/common/utils/timerUtils';

export const useDocumentStore = defineStore('document', () => {

    const currentDocumentId = ref<number | null>(null);
    const currentDocument = ref<Document | null>(null);
    
    // 自动保存定时器
    const autoSaveTimers = ref<Map<number, TimerManager>>(new Map());

    // === UI状态 ===
    const showDocumentSelector = ref(false);
    const isLoading = ref(false);

    // === UI控制方法 ===
    const openDocumentSelector = () => {
        showDocumentSelector.value = true;
    };

    const closeDocumentSelector = () => {
        showDocumentSelector.value = false;
    };


    // 获取文档列表
    const getDocumentList = async (): Promise<Document[]> => {
        try {
            isLoading.value = true;
            const docs = await DocumentService.ListAllDocumentsMeta();
            return docs?.filter((doc): doc is Document => doc !== null) || [];
        } catch (_error) {
            return [];
        } finally {
            isLoading.value = false;
        }
    };
    
    // 获取单个文档
    const getDocument = async (docId: number): Promise<Document | null> => {
        try {
            return await DocumentService.GetDocumentByID(docId);
        } catch (error) {
            console.error('Failed to get document:', error);
            return null;
        }
    };
    
    // 保存文档内容
    const saveDocument = async (docId: number, content: string): Promise<Document | null> => {
        try {
            await DocumentService.UpdateDocumentContent(docId, content);
            return await DocumentService.GetDocumentByID(docId);
        } catch (error) {
            console.error('Failed to save document:', error);
            throw error;
        }
    };

    // 在新窗口中打开文档
    const openDocumentInNewWindow = async (docId: number): Promise<boolean> => {
        try {
            await OpenDocumentWindow(docId);
            return true;
        } catch (error) {
            console.error('Failed to open document in new window:', error);
            return false;
        }
    };

    // 创建新文档
    const createNewDocument = async (title: string): Promise<Document | null> => {
        try {
            const doc = await DocumentService.CreateDocument(title);
            return doc || null;
        } catch (error) {
            console.error('Failed to create document:', error);
            return null;
        }
    };

    // 打开文档
    const openDocument = async (docId: number): Promise<boolean> => {
        try {
            const doc = await DocumentService.GetDocumentByID(docId);
            if (!doc) {
                throw new Error(`Document ${docId} not found`);
            }

            currentDocumentId.value = docId;
            currentDocument.value = doc;
            return true;
        } catch (error) {
            console.error('Failed to open document:', error);
            return false;
        }
    };

    // 更新文档标题
    const updateDocumentTitle = async (docId: number, title: string): Promise<boolean> => {
        try {
            await DocumentService.UpdateDocumentTitle(docId, title);

            // 更新当前文档状态
            if (currentDocument.value?.id === docId) {
                currentDocument.value.title = title;
                currentDocument.value.updated_at = new Date().toISOString();
            }

            return true;
        } catch (error) {
            console.error('Failed to update document title:', error);
            return false;
        }
    };

    // 删除文档
    const deleteDocument = async (docId: number): Promise<boolean> => {
        try {
            await DocumentService.DeleteDocument(docId);

            // 清理定时器
            const timer = autoSaveTimers.value.get(docId);
            if (timer) {
                timer.clear();
                autoSaveTimers.value.delete(docId);
            }

            // 如果删除的是当前文档，切换到第一个可用文档
            if (currentDocumentId.value === docId) {
                const docs = await getDocumentList();
                if (docs.length > 0 && docs[0].id !== undefined) {
                    await openDocument(docs[0].id);
                } else {
                    currentDocumentId.value = null;
                    currentDocument.value = null;
                }
            }

            return true;
        } catch (error) {
            console.error('Failed to delete document:', error);
            return false;
        }
    };
    
    // 调度自动保存
    const scheduleAutoSave = (docId: number, saveCallback: () => Promise<void>, delay: number = 2000) => {
        let timer = autoSaveTimers.value.get(docId);
        if (!timer) {
            timer = createTimerManager();
            autoSaveTimers.value.set(docId, timer);
        }
        
        timer.set(async () => {
            try {
                await saveCallback();
            } catch (error) {
                console.error(`auto save for document ${docId} failed:`, error);
            }
        }, delay);
    };
    
    // 取消自动保存
    const cancelAutoSave = (docId: number) => {
        const timer = autoSaveTimers.value.get(docId);
        if (timer) {
            timer.clear();
        }
    };

    // 初始化文档
    const initDocument = async (urlDocumentId?: number): Promise<void> => {
        try {
            const docs = await getDocumentList();

            // 优先使用URL参数中的文档ID
            if (urlDocumentId) {
                await openDocument(urlDocumentId);
            } else if (currentDocumentId.value) {
                // 使用持久化的文档ID
                await openDocument(currentDocumentId.value);
            } else if (docs.length > 0 && docs[0].id !== undefined) {
                // 打开第一个文档
                await openDocument(docs[0].id);
            }
        } catch (error) {
            console.error('Failed to initialize document store:', error);
        }
    };

    return {
        // 状态
        currentDocumentId,
        currentDocument,
        showDocumentSelector,
        isLoading,

        getDocumentList,
        getDocument,
        saveDocument,
        createNewDocument,
        updateDocumentTitle,
        deleteDocument,
        openDocument,
        openDocumentInNewWindow,
        
        // 自动保存
        scheduleAutoSave,
        cancelAutoSave,
        
        // UI 控制
        openDocumentSelector,
        closeDocumentSelector,
        
        // 初始化
        initDocument,
    };
}, {
    persist: {
        key: 'voidraft-document',
        storage: localStorage,
        pick: ['currentDocumentId']
    }
});