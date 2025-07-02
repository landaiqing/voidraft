<script setup lang="ts">
import {onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {useEditorStore} from '@/stores/editorStore';
import {useDocumentStore} from '@/stores/documentStore';
import {useConfigStore} from '@/stores/configStore';
import {createWheelZoomHandler} from './basic/wheelZoomExtension';
import Toolbar from '@/components/toolbar/Toolbar.vue';

const editorStore = useEditorStore();
const documentStore = useDocumentStore();
const configStore = useConfigStore();

const editorElement = ref<HTMLElement | null>(null);

// 创建滚轮缩放处理器
const wheelHandler = createWheelZoomHandler(
    configStore.increaseFontSize,
    configStore.decreaseFontSize
);

onMounted(async () => {
  if (!editorElement.value) return;

  // 初始化文档存储，会自动使用持久化的文档ID
  await documentStore.initialize();
  
  // 设置编辑器容器
  editorStore.setEditorContainer(editorElement.value);

  // 添加滚轮事件监听
  editorElement.value.addEventListener('wheel', wheelHandler, {passive: false});
});

onBeforeUnmount(() => {
  // 移除滚轮事件监听
  if (editorElement.value) {
    editorElement.value.removeEventListener('wheel', wheelHandler);
  }
});
</script>

<template>
  <div class="editor-container">
    <div ref="editorElement" class="editor"></div>
    <Toolbar/>
  </div>
</template>

<style scoped lang="scss">
.editor-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  .editor {
    width: 100%;
    flex: 1;
    overflow: hidden;
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