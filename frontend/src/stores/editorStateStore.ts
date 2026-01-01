import {defineStore} from 'pinia';
import {ref} from 'vue';

export interface DocumentStats {
    lines: number;
    characters: number;
    selectedCharacters: number;
}

export const useEditorStateStore = defineStore('editorState', () => {
    // 光标位置存储 Record<docId, cursorPosition>
    const cursorPositions = ref<Record<number, number>>({});

    // 文档统计数据存储 Record<docId, DocumentStats>
    const documentStats = ref<Record<number, DocumentStats>>({});

    // 保存光标位置
    const saveCursorPosition = (docId: number, position: number) => {
        cursorPositions.value[docId] = position;
    };

    // 获取光标位置
    const getCursorPosition = (docId: number): number | undefined => {
        return cursorPositions.value[docId];
    };

    // 保存文档统计数据
    const saveDocumentStats = (docId: number, stats: DocumentStats) => {
        documentStats.value[docId] = stats;
    };

    // 获取文档统计数据
    const getDocumentStats = (docId: number): DocumentStats => {
        return documentStats.value[docId] || {
            lines: 0,
            characters: 0,
            selectedCharacters: 0
        };
    };

    // 清除文档状态
    const clearDocumentState = (docId: number) => {
        delete cursorPositions.value[docId];
        delete documentStats.value[docId];
    };

    // 清除所有状态
    const clearAllStates = () => {
        cursorPositions.value = {};
        documentStats.value = {};
    };

    return {
        cursorPositions,
        documentStats,
        saveCursorPosition,
        getCursorPosition,
        saveDocumentStats,
        getDocumentStats,
        clearDocumentState,
        clearAllStates
    };
}, {
    persist: {
        key: 'voidraft-editor-state',
        storage: localStorage,
        pick: ['cursorPositions']
    }
});

