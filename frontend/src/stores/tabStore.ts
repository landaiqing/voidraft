import {defineStore} from 'pinia';
import {computed, readonly, ref} from 'vue';
import {useConfigStore} from './configStore';
import {useDocumentStore} from './documentStore';
import type {Document} from '@/../bindings/voidraft/internal/models/models';

export interface Tab {
    documentId: number;  // 直接使用文档ID作为唯一标识
    title: string;       // 标签页标题
}

export const useTabStore = defineStore('tab', () => {
    // === 依赖store ===
    const configStore = useConfigStore();
    const documentStore = useDocumentStore();

    // === 核心状态 ===
    const tabsMap = ref<Record<number, Tab>>({});
    const tabOrder = ref<number[]>([]);  // 维护标签页顺序
    const draggedTabId = ref<number | null>(null);

    // === 计算属性 ===

    const isTabsEnabled = computed(() => configStore.config.general.enableTabs);
    const canCloseTab = computed(() => tabOrder.value.length > 1);
    const currentDocumentId = computed(() => documentStore.currentDocumentId);

    // 按顺序返回标签页数组（用于UI渲染）
    const tabs = computed(() => {
        return tabOrder.value
            .map(documentId => tabsMap.value[documentId])
            .filter(tab => tab !== undefined) as Tab[];
    });

    // === 私有方法 ===
    const hasTab = (documentId: number): boolean => {
        return documentId in tabsMap.value;
    };

    const getTab = (documentId: number): Tab | undefined => {
        return tabsMap.value[documentId];
    };

    const updateTabTitle = (documentId: number, title: string) => {
        const tab = tabsMap.value[documentId];
        if (tab) {
            tab.title = title;
        }
    };

    // === 公共方法 ===

    /**
     * 添加或激活标签页
     */
    const addOrActivateTab = (document: Document) => {
        const documentId = document.id;

        if (hasTab(documentId)) {
            // 标签页已存在，无需重复添加
            return;
        }

        // 创建新标签页
        const newTab: Tab = {
            documentId,
            title: document.title
        };

        tabsMap.value[documentId] = newTab;
        tabOrder.value.push(documentId);
    };

    /**
     * 关闭标签页
     */
    const closeTab = (documentId: number) => {
        if (!hasTab(documentId)) return;

        const tabIndex = tabOrder.value.indexOf(documentId);
        if (tabIndex === -1) return;

        // 从映射和顺序数组中移除
        delete tabsMap.value[documentId];
        tabOrder.value.splice(tabIndex, 1);

        // 如果关闭的是当前文档，需要切换到其他文档
        if (documentStore.currentDocument?.id === documentId) {
            // 优先选择下一个标签页，如果没有则选择上一个
            let nextIndex = tabIndex;
            if (nextIndex >= tabOrder.value.length) {
                nextIndex = tabOrder.value.length - 1;
            }

            if (nextIndex >= 0 && tabOrder.value[nextIndex]) {
                const nextDocumentId = tabOrder.value[nextIndex];
                switchToTabAndDocument(nextDocumentId);
            }
        }
    };

    /**
     * 批量关闭标签页
     * @param documentIds 要关闭的文档ID数组
     */
    const closeTabs = (documentIds: number[]) => {
        documentIds.forEach(documentId => {
            if (!hasTab(documentId)) return;

            const tabIndex = tabOrder.value.indexOf(documentId);
            if (tabIndex === -1) return;

            // 从映射和顺序数组中移除
            delete tabsMap.value[documentId];
            tabOrder.value.splice(tabIndex, 1);
        });
    };

    /**
     * 切换到指定标签页并打开对应文档
     */
    const switchToTabAndDocument = (documentId: number) => {
        if (!hasTab(documentId)) return;

        // 如果点击的是当前已激活的文档，不需要重复请求
        if (documentStore.currentDocumentId === documentId) {
            return;
        }

        documentStore.openDocument(documentId);
    };

    /**
     * 移动标签页位置
     */
    const moveTab = (fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 ||
            fromIndex >= tabOrder.value.length || toIndex >= tabOrder.value.length) {
            return;
        }

        const [movedTab] = tabOrder.value.splice(fromIndex, 1);
        tabOrder.value.splice(toIndex, 0, movedTab);
    };

    /**
     * 获取标签页在顺序中的索引
     */
    const getTabIndex = (documentId: number): number => {
        return tabOrder.value.indexOf(documentId);
    };

    /**
     * 验证并清理无效的标签页
     */
    const validateTabs = () => {
        const validDocIds = Object.keys(documentStore.documents).map(Number);
        
        // 找出无效的标签页（文档已被删除）
        const invalidTabIds = tabOrder.value.filter(docId => !validDocIds.includes(docId));
        
        if (invalidTabIds.length > 0) {
            // 批量清理无效标签页
            invalidTabIds.forEach(docId => {
                delete tabsMap.value[docId];
            });
            tabOrder.value = tabOrder.value.filter(docId => validDocIds.includes(docId));
        }
    };

    /**
     * 初始化标签页（当前文档）
     */
    const initializeTab = () => {
        // 先验证并清理无效的标签页（处理持久化的脏数据）
        validateTabs();
        
        if (isTabsEnabled.value) {
            const currentDoc = documentStore.currentDocument;
            if (currentDoc) {
                addOrActivateTab(currentDoc);
            }
        }
    };

    // === 公共方法 ===

    /**
     * 关闭其他标签页（除了指定的标签页）
     */
    const closeOtherTabs = (keepDocumentId: number) => {
        if (!hasTab(keepDocumentId)) return;

        // 获取所有其他标签页的ID
        const otherTabIds = tabOrder.value.filter(id => id !== keepDocumentId);

        // 批量关闭其他标签页
        closeTabs(otherTabIds);

        // 如果当前打开的文档在被关闭的标签中，需要切换到保留的文档
        if (otherTabIds.includes(documentStore.currentDocumentId!)) {
            switchToTabAndDocument(keepDocumentId);
        }
    };

    /**
     * 关闭指定标签页右侧的所有标签页
     */
    const closeTabsToRight = (documentId: number) => {
        const index = getTabIndex(documentId);
        if (index === -1) return;

        // 获取右侧所有标签页的ID
        const rightTabIds = tabOrder.value.slice(index + 1);

        // 批量关闭右侧标签页
        closeTabs(rightTabIds);

        // 如果当前打开的文档在被关闭的右侧标签中，需要切换到指定的文档
        if (rightTabIds.includes(documentStore.currentDocumentId!)) {
            switchToTabAndDocument(documentId);
        }
    };

    /**
     * 关闭指定标签页左侧的所有标签页
     */
    const closeTabsToLeft = (documentId: number) => {
        const index = getTabIndex(documentId);
        if (index <= 0) return;

        // 获取左侧所有标签页的ID
        const leftTabIds = tabOrder.value.slice(0, index);

        // 批量关闭左侧标签页
        closeTabs(leftTabIds);

        // 如果当前打开的文档在被关闭的左侧标签中，需要切换到指定的文档
        if (leftTabIds.includes(documentStore.currentDocumentId!)) {
            switchToTabAndDocument(documentId);
        }
    };

    /**
     * 清空所有标签页
     */
    const clearAllTabs = () => {
        tabsMap.value = {};
        tabOrder.value = [];
    };

    // === 公共API ===
    return {
        tabsMap,
        tabOrder,
        
        // 状态
        tabs: readonly(tabs),
        draggedTabId,

        // 计算属性
        isTabsEnabled,
        canCloseTab,
        currentDocumentId,

        // 方法
        addOrActivateTab,
        closeTab,
        closeOtherTabs,
        closeTabsToLeft,
        closeTabsToRight,
        switchToTabAndDocument,
        moveTab,
        getTabIndex,
        initializeTab,
        clearAllTabs,
        updateTabTitle,
        validateTabs,

        // 工具方法
        hasTab,
        getTab
    };
}, {
    persist: {
        key: 'voidraft-tabs',
        storage: localStorage,
        pick: ['tabsMap', 'tabOrder'],
    },
});
