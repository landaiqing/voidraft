import {defineStore} from 'pinia';
import {computed, ref} from 'vue';
import {DocumentService} from '@/../bindings/voidraft/internal/services';
import {OpenDocumentWindow} from '@/../bindings/voidraft/internal/services/windowservice';
import {Document} from '@/../bindings/voidraft/internal/models/models';
import {useTabStore} from "@/stores/tabStore";

export const useDocumentStore = defineStore('document', () => {
    const DEFAULT_DOCUMENT_ID = ref<number>(1); // 默认草稿文档ID

    // === 核心状态 ===
    const documents = ref<Record<number, Document>>({});
    const currentDocumentId = ref<number | null>(null);
    const currentDocument = ref<Document | null>(null);

    // === 编辑器状态持久化 ===
    const documentStates = ref<Record<number, {
        cursorPos: number;
        scrollTop: number;
    }>>({});

    // === UI状态 ===
    const showDocumentSelector = ref(false);
    const selectorError = ref<{ docId: number; message: string } | null>(null);
    const isLoading = ref(false);

    // === 计算属性 ===
    const documentList = computed(() =>
        Object.values(documents.value).sort((a, b) => {
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        })
    );

    // === 私有方法 ===
    const setDocuments = (docs: Document[]) => {
        documents.value = {};
        docs.forEach(doc => {
            documents.value[doc.id] = doc;
        });
    };

    // === 错误处理 ===
    const setError = (docId: number, message: string) => {
        selectorError.value = {docId, message};
        // 3秒后自动清除错误状态
        setTimeout(() => {
            if (selectorError.value?.docId === docId) {
                selectorError.value = null;
            }
        }, 3000);
    };

    const clearError = () => {
        selectorError.value = null;
    };

    // === UI控制方法 ===
    const openDocumentSelector = () => {
        showDocumentSelector.value = true;
        clearError();
    };

    const closeDocumentSelector = () => {
        showDocumentSelector.value = false;
        clearError();
    };

    const toggleDocumentSelector = () => {
        if (showDocumentSelector.value) {
            closeDocumentSelector();
        } else {
            openDocumentSelector();
        }
    };

    // === 文档操作方法 ===

    // 在新窗口中打开文档
    const openDocumentInNewWindow = async (docId: number): Promise<boolean> => {
        try {
            await OpenDocumentWindow(docId);
            const tabStore = useTabStore();
            if (tabStore.isTabsEnabled && tabStore.hasTab(docId)) {
                tabStore.closeTab(docId);
            }
            
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
            if (doc) {
                documents.value[doc.id] = doc;
                return doc;
            }
            return null;
        } catch (error) {
            console.error('Failed to create document:', error);
            return null;
        }
    };

    // 获取文档列表
    const getDocumentMetaList = async () => {
        try {
            isLoading.value = true;
            const docs = await DocumentService.ListAllDocumentsMeta();
            if (docs) {
                setDocuments(docs.filter((doc): doc is Document => doc !== null));
            }
        } catch (error) {
            console.error('Failed to update documents:', error);
        } finally {
            isLoading.value = false;
        }
    };

    // 打开文档
    const openDocument = async (docId: number): Promise<boolean> => {
        try {
            closeDocumentSelector();

            // 获取完整文档数据
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

    // 更新文档元数据
    const updateDocumentMetadata = async (docId: number, title: string): Promise<boolean> => {
        try {
            await DocumentService.UpdateDocumentTitle(docId, title);

            // 更新本地状态
            const doc = documents.value[docId];
            if (doc) {
                doc.title = title;
                doc.updatedAt = new Date().toISOString();
            }

            if (currentDocument.value?.id === docId) {
                currentDocument.value.title = title;
                currentDocument.value.updatedAt = new Date().toISOString();
            }

            return true;
        } catch (error) {
            console.error('Failed to update document metadata:', error);
            return false;
        }
    };

    // 删除文档
    const deleteDocument = async (docId: number): Promise<boolean> => {
        try {
            // 检查是否是默认文档（使用ID判断）
            if (docId === DEFAULT_DOCUMENT_ID.value) {
                return false;
            }

            await DocumentService.DeleteDocument(docId);

            // 更新本地状态
            delete documents.value[docId];

            // 如果删除的是当前文档，切换到第一个可用文档
            if (currentDocumentId.value === docId) {
                const availableDocs = Object.values(documents.value);
                if (availableDocs.length > 0) {
                    await openDocument(availableDocs[0].id);
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

    // === 初始化 ===
    const initialize = async (urlDocumentId?: number): Promise<void> => {
        try {
            await getDocumentMetaList();

            // 优先使用URL参数中的文档ID
            if (urlDocumentId && documents.value[urlDocumentId]) {
                await openDocument(urlDocumentId);
            } else if (currentDocumentId.value && documents.value[currentDocumentId.value]) {
                // 如果URL中没有指定文档ID，则使用持久化的文档ID
                await openDocument(currentDocumentId.value);
            } else {
                // 否则打开默认文档
                await openDocument(DEFAULT_DOCUMENT_ID.value);
            }
        } catch (error) {
            console.error('Failed to initialize document store:', error);
        }
    };

    return {
        DEFAULT_DOCUMENT_ID,
        // 状态
        documents,
        documentList,
        currentDocumentId,
        currentDocument,
        documentStates,
        showDocumentSelector,
        selectorError,
        isLoading,

        // 方法
        getDocumentMetaList,
        openDocument,
        openDocumentInNewWindow,
        createNewDocument,
        updateDocumentMetadata,
        deleteDocument,
        openDocumentSelector,
        closeDocumentSelector,
        toggleDocumentSelector,
        setError,
        clearError,
        initialize,
    };
}, {
    persist: {
        key: 'voidraft-document',
        storage: localStorage,
        pick: ['currentDocumentId', 'documents', 'documentStates']
    }
});