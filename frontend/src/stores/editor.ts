import { defineStore } from 'pinia';
import { ref } from 'vue';
import { DocumentStats } from '@/types/editor';
import { EditorView } from '@codemirror/view';

// 字体大小范围
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 28;
const DEFAULT_FONT_SIZE = 12;

export const useEditorStore = defineStore('editor', () => {
  // 状态
  const documentStats = ref<DocumentStats>({
    lines: 0,
    characters: 0,
    selectedCharacters: 0
  });
  
  const encoding = ref('UTF-8');
  const editorView = ref<EditorView | null>(null);
  const fontSize = ref(DEFAULT_FONT_SIZE);
  
  // 方法
  function setEditorView(view: EditorView | null) {
    editorView.value = view;
  }
  
  function updateDocumentStats(stats: DocumentStats) {
    documentStats.value = stats;
  }
  
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
  
  function decreaseFontSize() {
    if (fontSize.value > MIN_FONT_SIZE) {
      fontSize.value -= 1;
      applyFontSize();
    }
  }
  
  function resetFontSize() {
    fontSize.value = DEFAULT_FONT_SIZE;
    applyFontSize();
  }
  
  function applyFontSize() {
    if (!editorView.value) return;
    
    // 更新编辑器的字体大小
    const editorDOM = editorView.value.dom;
    if (editorDOM) {
      editorDOM.style.fontSize = `${fontSize.value}px`;
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
    
    // 方法
    setEditorView,
    updateDocumentStats,
    setEncoding,
    openSettings,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    applyFontSize
  };
}); 