import {defineStore} from 'pinia';
import {ref} from 'vue';
import {DocumentService} from '@/../bindings/voidraft/internal/services';
import {DocumentSaveResult} from '@/../bindings/voidraft/internal/services/models';
import {Document} from '@/../bindings/voidraft/internal/models/ent/models';
import {OpenDocumentWindow} from '@/../bindings/voidraft/internal/services/windowservice';
import {generateContentHash} from '@/common/utils/hashUtils';
import {createLatestTaskQueue} from '@/common/utils/latestTaskQueue';
import {createTimerManager} from '@/common/utils/timerUtils';
import type {TimerManager} from '@/common/utils/timerUtils';

interface DocumentSavePayload {
  content: string;
  baseUpdatedAt: string;
  localHash: string;
}

interface DocumentSaveMeta {
  lastResult: DocumentSaveResult | null;
  lastSavedLocalHash: string | null;
}

export const useDocumentStore = defineStore('document', () => {
  const currentDocumentId = ref<number | null>(null);
  const currentDocument = ref<Document | null>(null);
  const autoSaveTimers = ref<Map<number, TimerManager>>(new Map());
  const showDocumentSelector = ref(false);
  const isLoading = ref(false);
  const saveQueue = createLatestTaskQueue<number, DocumentSavePayload, DocumentSaveResult, DocumentSaveMeta>({
    createMeta: () => ({
      lastResult: null,
      lastSavedLocalHash: null
    }),
    run: async (docId, payload) => {
      const result = await DocumentService.UpdateDocumentContent(docId, payload.content, payload.baseUpdatedAt);
      if (!result) {
        throw new Error(`Document ${docId} save returned no result`);
      }
      return result;
    },
    same: (current, incoming) => {
      return current.localHash === incoming.localHash && current.baseUpdatedAt === incoming.baseUpdatedAt;
    },
    merge: (_current, incoming) => incoming,
    next: (pending, lastResult) => {
      if (!lastResult.updated_at) {
        return pending;
      }
      return {
        ...pending,
        baseUpdatedAt: lastResult.updated_at
      };
    },
    onSuccess: (docId, payload, result, meta) => {
      meta.lastResult = result;
      meta.lastSavedLocalHash = payload.localHash;
      syncCurrentDocumentAfterSave(docId, payload.content, result);
    }
  });

  const openDocumentSelector = () => {
    showDocumentSelector.value = true;
  };

  const closeDocumentSelector = () => {
    showDocumentSelector.value = false;
  };

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

  const getDocument = async (docId: number): Promise<Document | null> => {
    try {
      return await DocumentService.GetDocumentByID(docId);
    } catch (error) {
      console.error('Failed to get document:', error);
      return null;
    }
  };

  const saveDocument = async (docId: number, content: string): Promise<DocumentSaveResult> => {
    const localHash = generateContentHash(content);
    const cachedResult = getCachedSaveResult(docId, content, localHash);

    if (cachedResult) {
      return cachedResult;
    }

    return saveQueue.enqueue(docId, {
      content,
      baseUpdatedAt: resolveBaseUpdatedAt(docId),
      localHash
    });
  };

  const openDocumentInNewWindow = async (docId: number): Promise<boolean> => {
    try {
      await OpenDocumentWindow(docId);
      return true;
    } catch (error) {
      console.error('Failed to open document in new window:', error);
      return false;
    }
  };

  const createNewDocument = async (title: string): Promise<Document | null> => {
    try {
      const doc = await DocumentService.CreateDocument(title);
      return doc || null;
    } catch (error) {
      console.error('Failed to create document:', error);
      return null;
    }
  };

  const openDocument = async (docId: number): Promise<boolean> => {
    try {
      const doc = await DocumentService.GetDocumentByID(docId);
      if (!doc) {
        throw new Error(`Document ${docId} not found`);
      }

      currentDocumentId.value = docId;
      currentDocument.value = doc;
      syncSaveQueueFromDocument(docId, doc);
      return true;
    } catch (error) {
      console.error('Failed to open document:', error);
      return false;
    }
  };

  const updateDocumentTitle = async (docId: number, title: string): Promise<boolean> => {
    try {
      await DocumentService.UpdateDocumentTitle(docId, title);
      resetSaveMeta(docId);

      if (currentDocument.value?.id === docId) {
        const refreshedDoc = await DocumentService.GetDocumentByID(docId);
        if (refreshedDoc) {
          currentDocument.value = refreshedDoc;
          syncSaveQueueFromDocument(docId, refreshedDoc);
        } else {
          currentDocument.value.title = title;
          currentDocument.value.updated_at = '';
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to update document:', error);
      return false;
    }
  };

  const deleteDocument = async (docId: number): Promise<boolean> => {
    try {
      await DocumentService.DeleteDocument(docId);

      const timer = autoSaveTimers.value.get(docId);
      if (timer) {
        timer.clear();
        autoSaveTimers.value.delete(docId);
      }
      saveQueue.remove(docId);

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

  const cancelAutoSave = (docId: number) => {
    const timer = autoSaveTimers.value.get(docId);
    if (timer) {
      timer.clear();
    }
  };

  const initDocument = async (urlDocumentId?: number): Promise<void> => {
    try {
      const docs = await getDocumentList();

      if (urlDocumentId) {
        await openDocument(urlDocumentId);
      } else if (currentDocumentId.value) {
        await openDocument(currentDocumentId.value);
      } else if (docs.length > 0 && docs[0].id !== undefined) {
        await openDocument(docs[0].id);
      }
    } catch (error) {
      console.error('Failed to initialize document store:', error);
    }
  };

  return {
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
    scheduleAutoSave,
    cancelAutoSave,
    openDocumentSelector,
    closeDocumentSelector,
    initDocument,
  };

  function getCachedSaveResult(docId: number, content: string, localHash: string): DocumentSaveResult | null {
    if (!saveQueue.isIdle(docId)) {
      return null;
    }

    const meta = saveQueue.getMeta(docId);
    if (!meta?.lastResult || meta.lastSavedLocalHash !== localHash) {
      return null;
    }

    syncCurrentDocumentAfterSave(docId, content, meta.lastResult);
    return meta.lastResult;
  }

  function resolveBaseUpdatedAt(docId: number): string {
    const meta = saveQueue.getMeta(docId);
    if (meta?.lastResult?.updated_at) {
      return meta.lastResult.updated_at;
    }
    if (currentDocument.value?.id === docId) {
      return currentDocument.value.updated_at || '';
    }
    return '';
  }

  function resetSaveMeta(docId: number) {
    const meta = saveQueue.getMeta(docId);
    if (!meta) {
      return;
    }

    meta.lastResult = null;
    meta.lastSavedLocalHash = null;
  }

  function syncCurrentDocumentAfterSave(docId: number, content: string, result: DocumentSaveResult) {
    if (currentDocument.value?.id !== docId) {
      return;
    }
    currentDocument.value.content = content;
    currentDocument.value.updated_at = result.updated_at;
  }

  function syncSaveQueueFromDocument(docId: number, doc: Document) {
    const content = doc.content || '';
    saveQueue.updateMeta(docId, (meta) => {
      meta.lastResult = buildSaveResultFromDocument(docId, doc, content);
      meta.lastSavedLocalHash = generateContentHash(content);
    });
  }

  function buildSaveResultFromDocument(docId: number, doc: Document, content: string): DocumentSaveResult {
    return {
      document_id: docId,
      updated_at: doc.updated_at || '',
      content_length: content.length,
      content_hash: generateContentHash(content),
      saved_at: doc.updated_at || '',
      changed: false
    };
  }
}, {
  persist: {
    key: 'voidraft-document',
    storage: localStorage,
    pick: ['currentDocumentId']
  }
});
