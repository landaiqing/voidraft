<script setup lang="ts">
import {onBeforeUnmount, onMounted, ref} from 'vue';
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view';
import {EditorState} from '@codemirror/state';
import {baseDark} from "@/editor/theme/base-dark";
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting
} from '@codemirror/language';
import {defaultKeymap, history, historyKeymap} from '@codemirror/commands';
import {highlightSelectionMatches, searchKeymap} from '@codemirror/search';
import {autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap} from '@codemirror/autocomplete';
import {lintKeymap} from '@codemirror/lint';
import {fontTheme} from "@/editor/font/font";
import { useEditorStore } from '@/stores/editor';

// 使用Pinia store
const editorStore = useEditorStore();

const props = defineProps({
  initialDoc: {
    type: String,
    default: '// 在此处编写代码'
  }
});

const editorElement = ref<HTMLElement | null>(null);

// 更新统计信息
const updateStats = () => {
  if (!editorStore.editorView) return;
  
  const view = editorStore.editorView;
  const state = view.state;
  const doc = state.doc;
  const text = doc.toString();
  
  // 计算选中的字符数
  let selectedChars = 0;
  const selections = state.selection;
  if (selections) {
    for (let i = 0; i < selections.ranges.length; i++) {
      const range = selections.ranges[i];
      selectedChars += range.to - range.from;
    }
  }
  
  editorStore.updateDocumentStats({
    lines: doc.lines,
    characters: text.length,
    selectedCharacters: selectedChars
  });
};

onMounted(() => {
  if (!editorElement.value) return;

  const state = EditorState.create({
    doc: props.initialDoc,
    extensions: [
      baseDark,
      fontTheme,
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      dropCursor(),
      EditorView.lineWrapping,
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle, {fallback: true}),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      rectangularSelection(),
      crosshairCursor(),
      highlightSelectionMatches(),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        ...lintKeymap
      ]),
      EditorView.updateListener.of(update => {
        if (update.docChanged || update.selectionSet) {
          updateStats();
        }
      })
    ]
  });

  const view = new EditorView({
    state,
    parent: editorElement.value
  });
  
  // 将编辑器实例保存到store
  editorStore.setEditorView(view);
  
  // 初始化统计
  updateStats();
});

onBeforeUnmount(() => {
  if (editorStore.editorView) {
    editorStore.editorView.destroy();
    editorStore.setEditorView(null);
  }
});
</script>

<template>
  <div class="editor-container">
    <div ref="editorElement" class="editor"></div>
  </div>
</template>

<style scoped lang="scss">
.editor-container {
  width: 100%;
  height: 100%;
  overflow: hidden;

  .editor {
    width: 100%;
    height: 100%;
  }
}

:deep(.cm-editor) {
  height: 100%;
  width: 100%;
}

:deep(.cm-scroller) {
  overflow: auto;
}
</style> 