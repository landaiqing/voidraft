<script setup lang="ts">
import {onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {EditorState, Extension} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import {useEditorStore} from '@/stores/editorStore';
import {useConfigStore} from '@/stores/configStore';
import {createBasicSetup} from './extensions/basicSetup';
import {
  createStatsUpdateExtension,
  createWheelZoomHandler,
  getTabExtensions,
  updateStats,
  updateTabConfig
} from './extensions';

const editorStore = useEditorStore();
const configStore = useConfigStore();

const props = defineProps({
  initialDoc: {
    type: String,
    default: '// 在此处编写文本...'
  }
});

const editorElement = ref<HTMLElement | null>(null);

// 创建编辑器
const createEditor = () => {
  if (!editorElement.value) return;

  // 获取基本扩展
  const basicExtensions = createBasicSetup();

  // 获取Tab相关扩展
  const tabExtensions = getTabExtensions(
      configStore.config.tabSize,
      configStore.config.enableTabIndent,
      configStore.config.tabType
  );

  // 创建统计信息更新扩展
  const statsExtension = createStatsUpdateExtension(
      editorStore.updateDocumentStats
  );

  // 组合所有扩展
  const extensions: Extension[] = [
    ...basicExtensions,
    ...tabExtensions,
    statsExtension
  ];

  // 创建编辑器状态
  const state = EditorState.create({
    doc: props.initialDoc,
    extensions
  });

  // 创建编辑器视图
  const view = new EditorView({
    state,
    parent: editorElement.value
  });

  // 将编辑器实例保存到store
  editorStore.setEditorView(view);

  // 应用初始字体大小
  editorStore.applyFontSize();

  // 立即更新统计信息，不等待用户交互
  updateStats(view, editorStore.updateDocumentStats);
};

// 创建滚轮事件处理器
const handleWheel = createWheelZoomHandler(
    configStore.increaseFontSize,
    configStore.decreaseFontSize
);

// 重新配置编辑器（仅在必要时）
const reconfigureTabSettings = () => {
  if (!editorStore.editorView) return;
  updateTabConfig(
      editorStore.editorView as EditorView,
      configStore.config.tabSize,
      configStore.config.enableTabIndent,
      configStore.config.tabType
  );
};

// 监听Tab设置变化
watch(() => configStore.config.tabSize, reconfigureTabSettings);
watch(() => configStore.config.enableTabIndent, reconfigureTabSettings);
watch(() => configStore.config.tabType, reconfigureTabSettings);

// 监听字体大小变化
watch(() => configStore.config.fontSize, () => {
  editorStore.applyFontSize();
});

onMounted(() => {
  // 创建编辑器
  createEditor();

  // 添加滚轮事件监听
  if (editorElement.value) {
    editorElement.value.addEventListener('wheel', handleWheel, {passive: false});
  }

  // 确保统计信息已更新
  if (editorStore.editorView) {
    setTimeout(() => {
      updateStats(editorStore.editorView as EditorView, editorStore.updateDocumentStats);
    }, 100);
  }
});

onBeforeUnmount(() => {
  // 移除滚轮事件监听
  if (editorElement.value) {
    editorElement.value.removeEventListener('wheel', handleWheel);
  }

  // 销毁编辑器
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