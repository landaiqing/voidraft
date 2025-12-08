<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref} from 'vue';
import {useEditorStore} from '@/stores/editorStore';
import {useDocumentStore} from '@/stores/documentStore';
import {useConfigStore} from '@/stores/configStore';
import Toolbar from '@/components/toolbar/Toolbar.vue';
import {useWindowStore} from '@/stores/windowStore';
import LoadingScreen from '@/components/loading/LoadingScreen.vue';
import {useTabStore} from '@/stores/tabStore';
import ContextMenu from '@/views/editor/extensions/contextMenu/ContextMenu.vue';
import {contextMenuManager} from '@/views/editor/extensions/contextMenu/manager';
import TranslatorDialog from './extensions/translator/TranslatorDialog.vue';
import {translatorManager} from './extensions/translator/manager';


const editorStore = useEditorStore();
const documentStore = useDocumentStore();
const configStore = useConfigStore();
const windowStore = useWindowStore();
const tabStore = useTabStore();

const editorElement = ref<HTMLElement | null>(null);

const enableLoadingAnimation = computed(() => configStore.config.general.enableLoadingAnimation);

onMounted(async () => {
  if (!editorElement.value) return;

  const urlDocumentId = windowStore.currentDocumentId ? parseInt(windowStore.currentDocumentId) : undefined;

  await documentStore.initialize(urlDocumentId);

  editorStore.setEditorContainer(editorElement.value);

  await tabStore.initializeTab();
});

onBeforeUnmount(() => {
  contextMenuManager.destroy();
  translatorManager.destroy();
});
</script>

<template>
  <div class="editor-container">
    <!-- 加载动画   -->
    <transition name="loading-fade">
      <LoadingScreen v-if="editorStore.isLoading && enableLoadingAnimation" text="VOIDRAFT"/>
    </transition>
    <!-- 编辑器区域 -->
    <div ref="editorElement" class="editor"></div>

    <!-- 工具栏 -->
    <Toolbar/>
    <!-- 右键菜单 -->
    <ContextMenu :portal-target="editorElement"/>
    <!-- 翻译器弹窗 -->
    <TranslatorDialog :portal-target="editorElement"/>
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
    height: 100%;
    overflow: hidden;
    position: relative;
  }
}

:deep(.cm-editor) {
  height: 100%;
  width: 100%;
}

:deep(.cm-scroller) {
  overflow: auto;
}

.loading-fade-enter-active,
.loading-fade-leave-active {
  transition: opacity 0.3s ease;
}

.loading-fade-enter-from,
.loading-fade-leave-to {
  opacity: 0;
}
</style>
