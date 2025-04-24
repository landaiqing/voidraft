<script setup lang="ts">
import {onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view';
import {Compartment, EditorState, Extension} from '@codemirror/state';
import {baseDark, customHighlightActiveLine} from "@/editor/theme/base-dark";
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  indentOnInput,
  indentUnit,
  syntaxHighlighting
} from '@codemirror/language';
import {defaultKeymap, history, historyKeymap, indentSelection,} from '@codemirror/commands';
import {highlightSelectionMatches, searchKeymap} from '@codemirror/search';
import {autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap} from '@codemirror/autocomplete';
import {lintKeymap} from '@codemirror/lint';
import {fontTheme} from "@/editor/font/font";
import {useEditorStore} from '@/stores/editor';

const editorStore = useEditorStore();

const props = defineProps({
  initialDoc: {
    type: String,
    default: '// 在此处编写代码'
  }
});

// 使用Compartment可以动态更新特定的配置而不重建整个编辑器
const tabSizeCompartment = new Compartment();
const tabKeyCompartment = new Compartment();

const editorElement = ref<HTMLElement | null>(null);

// 处理滚轮缩放字体
const handleWheel = (event: WheelEvent) => {
  // 检查是否按住了Ctrl键
  if (event.ctrlKey) {
    // 阻止默认行为（防止页面缩放）
    event.preventDefault();

    // 根据滚轮方向增大或减小字体
    if (event.deltaY < 0) {
      // 向上滚动，增大字体
      editorStore.increaseFontSize();
    } else {
      // 向下滚动，减小字体
      editorStore.decreaseFontSize();
    }
  }
};

// 自定义Tab键处理函数
const tabHandler = (view: EditorView): boolean => {
  // 如果有选中文本，使用indentSelection
  if (!view.state.selection.main.empty) {
    return indentSelection(view);
  }

  // 获取当前的tabSize值
  const currentTabSize = editorStore.tabSize;
  // 创建相应数量的空格
  const spaces = ' '.repeat(currentTabSize);

  // 在光标位置插入空格
  const {state, dispatch} = view;
  dispatch(state.update(state.replaceSelection(spaces), {scrollIntoView: true}));
  return true;
};

// 获取Tab相关的扩展
const getTabExtensions = (): Extension[] => {
  const extensions: Extension[] = [];

  // 设置缩进单位
  const tabSize = editorStore.tabSize;
  extensions.push(tabSizeCompartment.of(indentUnit.of(' '.repeat(tabSize))));

  // 如果启用了Tab缩进，添加自定义Tab键映射
  if (editorStore.enableTabIndent) {
    extensions.push(tabKeyCompartment.of(keymap.of([{
      key: "Tab",
      run: tabHandler
    }])));
  } else {
    extensions.push(tabKeyCompartment.of([]));
  }

  return extensions;
};

// 创建编辑器
const createEditor = () => {
  if (!editorElement.value) return;

  const extensions = [
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
    customHighlightActiveLine,
    highlightActiveLine(),
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
    }),
    ...getTabExtensions()
  ];

  const state = EditorState.create({
    doc: props.initialDoc,
    extensions
  });

  const view = new EditorView({
    state,
    parent: editorElement.value
  });

  // 将编辑器实例保存到store
  editorStore.setEditorView(view);

  // 初始化统计
  updateStats();

  // 应用初始字体大小
  editorStore.applyFontSize();
};

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

// 动态更新Tab配置，不需要重建编辑器
const updateTabConfig = () => {
  if (!editorStore.editorView) return;

  // 更新Tab大小配置
  const tabSize = editorStore.tabSize;

  const view = editorStore.editorView;

  // 更新indentUnit配置
  view.dispatch({
    effects: tabSizeCompartment.reconfigure(indentUnit.of(' '.repeat(tabSize)))
  });

  // 更新Tab键映射
  const tabKeymap = editorStore.enableTabIndent
      ? keymap.of([{key: "Tab", run: tabHandler}])
      : [];

  view.dispatch({
    effects: tabKeyCompartment.reconfigure(tabKeymap)
  });
};

// 重新配置编辑器（仅在必要时完全重建）
const reconfigureEditor = () => {
  if (!editorStore.editorView) return;

  // 尝试动态更新配置
  updateTabConfig();
};

// 监听Tab设置变化
watch(() => editorStore.tabSize, () => {
  reconfigureEditor();
});
// 监听Tab缩进设置变化
watch(() => editorStore.enableTabIndent, () => {
  reconfigureEditor();
});

onMounted(() => {
  // 创建编辑器
  createEditor();

  // 添加滚轮事件监听
  if (editorElement.value) {
    editorElement.value.addEventListener('wheel', handleWheel, {passive: false});
  }
});

onBeforeUnmount(() => {
  // 移除滚轮事件监听
  if (editorElement.value) {
    editorElement.value.removeEventListener('wheel', handleWheel);
  }

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