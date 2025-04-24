import { defineStore } from 'pinia';
import { ref } from 'vue';
import { DocumentStats } from '@/types/editor';
import { EditorView } from '@codemirror/view';

export const useEditorStore = defineStore('editor', () => {
  // 状态
  const documentStats = ref<DocumentStats>({
    lines: 0,
    characters: 0,
    selectedCharacters: 0
  });
  
  const encoding = ref('UTF-8');
  const editorView = ref<EditorView | null>(null);
  
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
    
    // 方法
    setEditorView,
    updateDocumentStats,
    setEncoding,
    openSettings
  };
}); 