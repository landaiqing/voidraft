<script setup lang="ts">
import {onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {useEditorStore} from '@/stores/editorStore';
import {useDocumentStore} from '@/stores/documentStore';
import {useConfigStore} from '@/stores/configStore';
import {createWheelZoomHandler} from './basic/wheelZoomExtension';
import Toolbar from '@/components/toolbar/Toolbar.vue';

// 接收路由传入的文档ID
const props = defineProps<{
  documentId?: number | null
}>();

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

  await documentStore.initialize();
  
  // 如果有指定文档ID，则打开该文档
  if (props.documentId) {
    await documentStore.openDocument(props.documentId);
  }
  
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

// 监听文档ID变化
watch(() => props.documentId, async (newDocId) => {
  if (newDocId && documentStore.currentDocumentId !== newDocId) {
    await documentStore.openDocument(newDocId);
  }
}, { immediate: true });
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