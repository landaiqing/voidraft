import {defineStore} from 'pinia';
import {ref} from 'vue';

export interface DocumentStats {
    lines: number;
    characters: number;
    selectedCharacters: number;
}

export interface FoldRange {
    // 字符偏移（备用）
    from: number;
    to: number;
    
    // 行号
    fromLine: number;
    toLine: number;
}

export const useEditorStateStore = defineStore('editorState', () => {
    // 光标位置存储 Record<docId, cursorPosition>
    const cursorPositions = ref<Record<number, number>>({});

    // 文档统计数据存储 Record<docId, DocumentStats>
    const documentStats = ref<Record<number, DocumentStats>>({});

    // 折叠状态存储 Record<docId, FoldRange[]>
    const foldStates = ref<Record<number, FoldRange[]>>({});

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

    // 保存折叠状态
    const saveFoldState = (docId: number, foldRanges: FoldRange[]) => {
        foldStates.value[docId] = foldRanges;
    };

    // 获取折叠状态
    const getFoldState = (docId: number): FoldRange[] => {
        return foldStates.value[docId] || [];
    };

    // 清除文档状态
    const clearDocumentState = (docId: number) => {
        delete cursorPositions.value[docId];
        delete documentStats.value[docId];
        delete foldStates.value[docId];
    };

    // 清除所有状态
    const clearAllStates = () => {
        cursorPositions.value = {};
        documentStats.value = {};
        foldStates.value = {};
    };

    return {
        cursorPositions,
        documentStats,
        foldStates,
        saveCursorPosition,
        getCursorPosition,
        saveDocumentStats,
        getDocumentStats,
        saveFoldState,
        getFoldState,
        clearDocumentState,
        clearAllStates
    };
}, {
    persist: {
        key: 'voidraft-editor-state',
        storage: localStorage,
        pick: ['cursorPositions', 'foldStates']
    }
});

