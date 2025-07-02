import {defineStore} from 'pinia';
import {computed, ref} from 'vue';
import {DocumentService} from '@/../bindings/voidraft/internal/services';
import {Document} from '@/../bindings/voidraft/internal/models/models';

const SCRATCH_DOCUMENT_ID = 1; // 默认草稿文档ID

export const useDocumentStore = defineStore('document', () => {
    // === 核心状态 ===
    const documents = ref<Record<number, Document>>({});
    const recentDocumentIds = ref<number[]>([SCRATCH_DOCUMENT_ID]);
    const currentDocumentId = ref<number | null>(null);
    const currentDocument = ref<Document | null>(null);

    // === UI状态 ===
    const showDocumentSelector = ref(false);
    const isLoading = ref(false);

    // === 计算属性 ===
    const documentList = computed(() =>
        Object.values(documents.value).sort((a, b) => {
            const aIndex = recentDocumentIds.value.indexOf(a.id);
            const bIndex = recentDocumentIds.value.indexOf(b.id);

            // 按最近使用排序
            if (aIndex !== -1 && bIndex !== -1) {
                return aIndex - bIndex;
            }
            if (aIndex !== -1) return -1;
            if (bIndex !== -1) return 1;

            // 然后按更新时间排序
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        })
    );

    // === 私有方法 ===
    const addRecentDocument = (docId: number) => {
        const recent = recentDocumentIds.value.filter(id => id !== docId);
        recent.unshift(docId);
        recentDocumentIds.value = recent.slice(0, 100); // 保留最近100个
    };

    const setDocuments = (docs: Document[]) => {
        documents.value = {};
        docs.forEach(doc => {
            documents.value[doc.id] = doc;
        });
    };

    // === 公共API ===

    // 更新文档列表
    const updateDocuments = async () => {
        try {
            const docs = await DocumentService.ListAllDocumentsMeta();
            if (docs) {
                setDocuments(docs.filter((doc): doc is Document => doc !== null));
            }
        } catch (error) {
            console.error('Failed to update documents:', error);
        }
    };

    // 打开文档
    const openDocument = async (docId: number): Promise<boolean> => {
        try {
            closeDialog();

            // 获取完整文档数据
            const doc = await DocumentService.GetDocumentByID(docId);
            if (!doc) {
                throw new Error(`Document ${docId} not found`);
            }

            currentDocumentId.value = docId;
            currentDocument.value = doc;
            addRecentDocument(docId);

            return true;
        } catch (error) {
            console.error('Failed to open document:', error);
            return false;
        }
    };

    // 创建新文档
    const createNewDocument = async (title: string): Promise<Document | null> => {
        try {
            const newDoc = await DocumentService.CreateDocument(title);
            if (!newDoc) {
                throw new Error('Failed to create document');
            }

            // 更新文档列表
            documents.value[newDoc.id] = newDoc;

            return newDoc;
        } catch (error) {
            console.error('Failed to create document:', error);
            return null;
        }
    };

    // 保存新文档
    const saveNewDocument = async (title: string, content: string): Promise<boolean> => {
        try {
            const newDoc = await createNewDocument(title);
            if (!newDoc) return false;

            // 更新内容
            await DocumentService.UpdateDocumentContent(newDoc.id, content);
            newDoc.content = content;

            return true;
        } catch (error) {
            console.error('Failed to save new document:', error);
            return false;
        }
    };

    // 更新文档元数据
    const updateDocumentMetadata = async (docId: number, title: string, newPath?: string): Promise<boolean> => {
        try {
            await DocumentService.UpdateDocumentTitle(docId, title);

            // 更新本地状态
            const doc = documents.value[docId];
            if (doc) {
                doc.title = title;
                doc.updatedAt = new Date();
            }

            if (currentDocument.value?.id === docId) {
                currentDocument.value.title = title;
                currentDocument.value.updatedAt = new Date();
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
            if (docId === SCRATCH_DOCUMENT_ID) {
                return false;
            }

            await DocumentService.DeleteDocument(docId);

            // 更新本地状态
            delete documents.value[docId];
            recentDocumentIds.value = recentDocumentIds.value.filter(id => id !== docId);

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

    // === UI控制 ===
    const openDocumentSelector = () => {
        closeDialog();
        showDocumentSelector.value = true;
    };

    const closeDialog = () => {
        showDocumentSelector.value = false;
    };

    // === 初始化 ===
    const initialize = async (): Promise<void> => {
        try {
            await updateDocuments();

            // 如果存在持久化的文档ID，尝试打开该文档
            if (currentDocumentId.value && documents.value[currentDocumentId.value]) {
                await openDocument(currentDocumentId.value);
            } else {
                // 否则获取第一个文档ID并打开
                const firstDocId = await DocumentService.GetFirstDocumentID();
                if (firstDocId && documents.value[firstDocId]) {
                    await openDocument(firstDocId);
                }
            }
        } catch (error) {
            console.error('Failed to initialize document store:', error);
        }
    };

    return {
        // 状态
        documents,
        documentList,
        recentDocumentIds,
        currentDocumentId,
        currentDocument,
        showDocumentSelector,
        isLoading,

        // 方法
        updateDocuments,
        openDocument,
        createNewDocument,
        saveNewDocument,
        updateDocumentMetadata,
        deleteDocument,
        openDocumentSelector,
        closeDialog,
        initialize,
    };
}, {
    persist: {
        key: 'voidraft-document',
        storage: localStorage,
        pick: ['currentDocumentId']
    }
}); 