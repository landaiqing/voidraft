<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref} from 'vue';
import {useEditorStore} from '@/stores/editorStore';
import {useDocumentStore} from '@/stores/documentStore';
import {useConfigStore} from '@/stores/configStore';
import {createWheelZoomHandler} from './basic/wheelZoomExtension';
import Toolbar from '@/components/toolbar/Toolbar.vue';
import {useWindowStore} from "@/stores/windowStore";
import LoadingScreen from '@/components/loading/LoadingScreen.vue';
import {useTabStore} from "@/stores/tabStore";

const editorStore = useEditorStore();
const documentStore = useDocumentStore();
const configStore = useConfigStore();
const windowStore = useWindowStore();
const tabStore = useTabStore();

const editorElement = ref<HTMLElement | null>(null);

const enableLoadingAnimation = computed(() => configStore.config.general.enableLoadingAnimation);

// 创建滚轮缩放处理器
const wheelHandler = createWheelZoomHandler(
    configStore.increaseFontSize,
    configStore.decreaseFontSize
);

onMounted(async () => {
  if (!editorElement.value) return;

  // 从URL查询参数中获取documentId
  const urlDocumentId = windowStore.currentDocumentId ? parseInt(windowStore.currentDocumentId) : undefined;

  // 初始化文档存储，优先使用URL参数中的文档ID
  await documentStore.initialize(urlDocumentId);

  // 设置编辑器容器
  editorStore.setEditorContainer(editorElement.value);

  await tabStore.initializeTab();

  // 添加滚轮事件监听
  editorElement.value.addEventListener('wheel', wheelHandler, {passive: false});
});

onBeforeUnmount(() => {
  // 移除滚轮事件监听
  if (editorElement.value) {
    editorElement.value.removeEventListener('wheel', wheelHandler);
  }
  editorStore.clearAllEditors();

});
</script>

<template>
  <div class="editor-container">
    <div ref="editorElement" class="editor"></div>
    <Toolbar/>
    <transition name="loading-fade">
      <LoadingScreen v-if="editorStore.isLoading && enableLoadingAnimation" text="VOIDRAFT"/>
    </transition>
  </div>
</template>

<style scoped lang="scss">
.editor-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;

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

// 加载动画过渡效果
.loading-fade-enter-active,
.loading-fade-leave-active {
  transition: opacity 0.3s ease;
}

.loading-fade-enter-from,
.loading-fade-leave-to {
  opacity: 0;
}
</style>