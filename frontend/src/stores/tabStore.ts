import {defineStore} from 'pinia';
import {computed, ref, watch} from 'vue';
import {useDocumentStore} from './documentStore';
import {useEditorCacheStore} from './editorCacheStore';
import type {Document} from '@/../bindings/voidraft/internal/models/models';

/** 标签页信息 */
export interface TabInfo {
    id: number;
    title: string;
    isActive: boolean;
    lastAccessed: Date;
    document?: Document;
}

export const useTabStore = defineStore('tab', () => {
    // === 依赖的 Store ===
    const documentStore = useDocumentStore();
    const editorCacheStore = useEditorCacheStore();

    // === 状态 ===
    const openTabIds = ref<number[]>([]);
    const activeTabId = ref<number | null>(null);

    // === 计算属性 ===

    // 获取所有打开的标签页信息
    const openTabs = computed((): TabInfo[] => {
        return openTabIds.value.map(id => {
            const document = documentStore.documents[id];
            const editorItem = editorCacheStore.getEditor(id);

            return {
                id,
                title: document?.title || `Document ${id}`,
                isDirty: editorItem?.state.isDirty || false,
                isActive: id === activeTabId.value,
                lastAccessed: editorItem?.lastAccessed || new Date(),
                document
            };
        }).sort((a, b) => {
            // 按最后访问时间排序，最近访问的在前
            return b.lastAccessed.getTime() - a.lastAccessed.getTime();
        });
    });

    // 获取当前活跃的标签页
    const activeTab = computed((): TabInfo | null => {
        if (!activeTabId.value) return null;
        return openTabs.value.find(tab => tab.id === activeTabId.value) || null;
    });

    // 标签页数量
    const tabCount = computed(() => openTabIds.value.length);

    // 是否有标签页打开
    const hasTabs = computed(() => tabCount.value > 0);

    // === 私有方法 ===

    // 添加标签页到列表
    const addTabToList = (documentId: number): void => {
        if (!openTabIds.value.includes(documentId)) {
            openTabIds.value.push(documentId);
        }
    };

    // 从列表中移除标签页
    const removeTabFromList = (documentId: number): void => {
        const index = openTabIds.value.indexOf(documentId);
        if (index > -1) {
            openTabIds.value.splice(index, 1);
        }
    };

    // === 公共方法 ===

    // 打开标签页
    const openTab = async (documentId: number): Promise<boolean> => {
        try {
            // 使用 documentStore 的 openDocument 方法
            const success = await documentStore.openDocument(documentId);

            if (success) {
                // 添加到标签页列表
                addTabToList(documentId);
                // 设置为活跃标签页
                activeTabId.value = documentId;
                return true;
            }

            return false;
        } catch (error) {
            console.error('Failed to open tab:', error);
            return false;
        }
    };

    // 切换到指定标签页
    const switchToTab = async (documentId: number): Promise<boolean> => {
        // 如果标签页已经是活跃状态，直接返回
        if (activeTabId.value === documentId) {
            return true;
        }

        // 如果标签页不在打开列表中，先打开它
        if (!openTabIds.value.includes(documentId)) {
            return await openTab(documentId);
        }

        // 切换到已打开的标签页
        try {
            const success = await documentStore.openDocument(documentId);
            if (success) {
                activeTabId.value = documentId;
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to switch tab:', error);
            return false;
        }
    };

    // 关闭标签页
    const closeTab = async (documentId: number): Promise<boolean> => {
        try {
            // 检查是否有未保存的更改
            const editorItem = editorCacheStore.getEditor(documentId);
            if (editorItem?.state.isDirty) {
                // 这里可以添加确认对话框逻辑
                console.warn(`Document ${documentId} has unsaved changes`);
            }

            // 从标签页列表中移除
            removeTabFromList(documentId);

            // 如果关闭的是当前活跃标签页，需要切换到其他标签页
            if (activeTabId.value === documentId) {
                if (openTabIds.value.length > 0) {
                    // 切换到最近访问的标签页
                    const nextTab = openTabs.value[0];
                    if (nextTab) {
                        await switchToTab(nextTab.id);
                    }
                } else {
                    // 没有其他标签页了
                    activeTabId.value = null;
                }
            }

            // 从编辑器缓存中移除（可选，取决于是否要保持缓存）
            // editorCacheStore.removeEditor(documentId);

            return true;
        } catch (error) {
            console.error('Failed to close tab:', error);
            return false;
        }
    };

    // 关闭所有标签页
    const closeAllTabs = async (): Promise<boolean> => {
        // 清空标签页列表
        openTabIds.value = [];
        activeTabId.value = null;
        return true;
    };

    // 关闭其他标签页（保留指定标签页）
    const closeOtherTabs = async (keepDocumentId: number): Promise<boolean> => {
        try {
            const tabsToClose = openTabIds.value.filter(id => id !== keepDocumentId);

            // 检查其他标签页是否有未保存的更改
            const dirtyOtherTabs = tabsToClose.filter(id => {
                const editorItem = editorCacheStore.getEditor(id);
                return editorItem?.state.isDirty;
            });

            if (dirtyOtherTabs.length > 0) {
                console.warn(`${dirtyOtherTabs.length} other tabs have unsaved changes`);
                // 这里可以添加确认对话框逻辑
            }

            // 只保留指定的标签页
            openTabIds.value = [keepDocumentId];

            // 如果保留的标签页不是当前活跃的，切换到它
            if (activeTabId.value !== keepDocumentId) {
                await switchToTab(keepDocumentId);
            }

            return true;
        } catch (error) {
            console.error('Failed to close other tabs:', error);
            return false;
        }
    };

    // 获取标签页信息
    const getTabInfo = (documentId: number): TabInfo | null => {
        return openTabs.value.find(tab => tab.id === documentId) || null;
    };

    // 检查标签页是否打开
    const isTabOpen = (documentId: number): boolean => {
        return openTabIds.value.includes(documentId);
    };

    // === 监听器 ===

    // 监听 documentStore 的当前文档变化，同步标签页状态
    watch(
        () => documentStore.currentDocument,
        (newDoc) => {
            if (newDoc) {
                // 确保当前文档在标签页列表中
                addTabToList(newDoc.id);
                activeTabId.value = newDoc.id;
            }
        },
        {immediate: true}
    );


    return {
        // 状态
        openTabIds,
        activeTabId,

        // 计算属性
        openTabs,
        activeTab,
        tabCount,
        hasTabs,

        // 方法
        openTab,
        switchToTab,
        closeTab,
        closeAllTabs,
        closeOtherTabs,
        getTabInfo,
        isTabOpen,
    };
}, {
    persist: {
        key: 'voidraft-tabs',
        storage: localStorage,
        pick: ['openTabIds', 'activeTabId']
    }
});