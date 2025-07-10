import {computed} from 'vue';
import {defineStore} from 'pinia';
import {IsDocumentWindowOpen} from "@/../bindings/voidraft/internal/services/windowservice";


export const useWindowStore = defineStore('window', () => {
    // 判断是否为主窗口
    const isMainWindow = computed(() => {
        const urlParams = new URLSearchParams(window.location.search);
        return !urlParams.has('documentId');
    });

    // 获取当前窗口的documentId
    const currentDocumentId = computed(() => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('documentId');
    });
    /**
     * 判断文档窗口是否打开
     * @param documentId 文档ID
     */
    async function isDocumentWindowOpen(documentId: number) {
        return IsDocumentWindowOpen(documentId);
    }

    return {
        isMainWindow,
        currentDocumentId,
        isDocumentWindowOpen
    };
});