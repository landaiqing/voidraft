<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useEditorStore } from '@/stores/editorStore';
import { useDocumentStore } from '@/stores/documentStore';
import { useConfigStore } from '@/stores/configStore';
import Toolbar from '@/components/toolbar/Toolbar.vue';
import { useWindowStore } from '@/stores/windowStore';
import LoadingScreen from '@/components/loading/LoadingScreen.vue';
import { useTabStore } from '@/stores/tabStore';
import ContextMenu from './contextMenu/ContextMenu.vue';
import { contextMenuManager } from './contextMenu/manager';

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
});
</script>

<template>
  <div class="editor-container">
    <transition name="loading-fade">
      <LoadingScreen v-if="editorStore.isLoading && enableLoadingAnimation" text="VOIDRAFT" />
    </transition>
    <div ref="editorElement" class="editor"></div>
    <Toolbar />
    <ContextMenu :portal-target="editorElement" />
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
