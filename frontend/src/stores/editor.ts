import {defineStore} from 'pinia';
import {ref} from 'vue';
import {DocumentStats} from '@/types/editor';
import {EditorView} from '@codemirror/view';

// 字体大小范围
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 28;
const DEFAULT_FONT_SIZE = 13;

// Tab设置
const DEFAULT_TAB_SIZE = 4;
const MIN_TAB_SIZE = 2;
const MAX_TAB_SIZE = 8;

export const useEditorStore = defineStore('editor', () => {
    // 状态
    const documentStats = ref<DocumentStats>({
        lines: 0,
        characters: 0,
        selectedCharacters: 0
    });
    // 编码
    const encoding = ref('UTF-8');
    // 编辑器视图
    const editorView = ref<EditorView | null>(null);
    // 字体大小
    const fontSize = ref(DEFAULT_FONT_SIZE);
    // Tab键设置
    const enableTabIndent = ref(true);
    // Tab键大小
    const tabSize = ref(DEFAULT_TAB_SIZE);

    // 方法
    function setEditorView(view: EditorView | null) {
        editorView.value = view;
    }

    // 更新文档统计信息
    function updateDocumentStats(stats: DocumentStats) {
        documentStats.value = stats;
    }

    // 设置编码
    function setEncoding(newEncoding: string) {
        encoding.value = newEncoding;
    }

    // 字体缩放
    function increaseFontSize() {
        if (fontSize.value < MAX_FONT_SIZE) {
            fontSize.value += 1;
            applyFontSize();
        }
    }

    // 字体缩放
    function decreaseFontSize() {
        if (fontSize.value > MIN_FONT_SIZE) {
            fontSize.value -= 1;
            applyFontSize();
        }
    }

    // 重置字体大小
    function resetFontSize() {
        fontSize.value = DEFAULT_FONT_SIZE;
        applyFontSize();
    }

    // 应用字体大小
    function applyFontSize() {
        if (!editorView.value) return;
        // 更新编辑器的字体大小
        const editorDOM = editorView.value.dom;
        if (editorDOM) {
            editorDOM.style.fontSize = `${fontSize.value}px`;
        }
    }

    // Tab相关方法
    function toggleTabIndent() {
        enableTabIndent.value = !enableTabIndent.value;
    }
    // 增加Tab大小
    function increaseTabSize() {
        if (tabSize.value < MAX_TAB_SIZE) {
            tabSize.value += 1;
        }
    }
    // 减少Tab大小
    function decreaseTabSize() {
        if (tabSize.value > MIN_TAB_SIZE) {
            tabSize.value -= 1;
        }
    }

    // 设置按钮操作
    function openSettings() {
        console.log('打开设置面板');
        // 此处可以实现设置面板的逻辑
    }

    return {
        // 状态
        documentStats,
        encoding,
        editorView,
        fontSize,
        enableTabIndent,
        tabSize,

        // 方法
        setEditorView,
        updateDocumentStats,
        setEncoding,
        openSettings,
        increaseFontSize,
        decreaseFontSize,
        resetFontSize,
        toggleTabIndent,
        increaseTabSize,
        decreaseTabSize
    };
}, {
    persist: {
        key: 'editor',
        storage: localStorage,
        pick: ['fontSize', 'encoding', 'enableTabIndent', 'tabSize']
    }
});