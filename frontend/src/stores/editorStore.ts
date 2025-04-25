import {defineStore} from 'pinia';
import {ref} from 'vue';
import {DocumentStats} from '@/types/editor';
import {EditorView} from '@codemirror/view';
import {useConfigStore} from './configStore';

export const useEditorStore = defineStore('editor', () => {
    // 引用配置store
    const configStore = useConfigStore();

    // 状态
    const documentStats = ref<DocumentStats>({
        lines: 0,
        characters: 0,
        selectedCharacters: 0
    });
    // 编辑器视图
    const editorView = ref<EditorView | null>(null);

    // 方法
    function setEditorView(view: EditorView | null) {
        editorView.value = view;
    }

    // 更新文档统计信息
    function updateDocumentStats(stats: DocumentStats) {
        documentStats.value = stats;
    }

    // 应用字体大小
    function applyFontSize() {
        if (!editorView.value) return;
        // 更新编辑器的字体大小
        const editorDOM = editorView.value.dom;
        if (editorDOM) {
            editorDOM.style.fontSize = `${configStore.config.fontSize}px`;
        }
    }

    return {
        // 状态
        documentStats,
        editorView,

        // 配置引用
        config: configStore.config,

        // 方法
        setEditorView,
        updateDocumentStats,
        applyFontSize
    };
});