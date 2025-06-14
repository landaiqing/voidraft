<script setup lang="ts">
import {onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {EditorState, Extension} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import {useEditorStore} from '@/stores/editorStore';
import {useConfigStore} from '@/stores/configStore';
import {useDocumentStore} from '@/stores/documentStore';
import {useLogStore} from '@/stores/logStore';
import {createBasicSetup} from './extensions/basicSetup';
import {
  createStatsUpdateExtension,
  createWheelZoomHandler,
  getTabExtensions,
  updateStats,
  updateTabConfig,
  createAutoSavePlugin,
  createSaveShortcutPlugin,
  createFontExtensionFromBackend,
  updateFontConfig,
} from './extensions';
import { useEditorTheme } from '@/composables/useEditorTheme';
import { useI18n } from 'vue-i18n';
import type { ThemeType } from '@/types';
import { DocumentService } from '../../../bindings/voidraft/internal/services';
import Toolbar from '@/components/toolbar/Toolbar.vue';

const editorStore = useEditorStore();
const configStore = useConfigStore();
const documentStore = useDocumentStore();
const logStore = useLogStore();
const { t } = useI18n();
const { createThemeExtension, updateTheme } = useEditorTheme();

const props = defineProps({
  initialDoc: {
    type: String,
    default: ''
  }
});

const editorElement = ref<HTMLElement | null>(null);
const editorCreated = ref(false);
let isDestroying = false;

// 创建编辑器
const createEditor = async () => {
  if (!editorElement.value || editorCreated.value) return;
  editorCreated.value = true;

  // 加载文档内容
  await documentStore.initialize();
  const docContent = documentStore.documentContent || props.initialDoc;

  // 获取基本扩展
  const basicExtensions = createBasicSetup();

  // 获取主题扩展
  const themeExtension = await createThemeExtension(
    configStore.config.appearance.theme || 'default-dark' as ThemeType
  );

  // 获取Tab相关扩展
  const tabExtensions = getTabExtensions(
      configStore.config.editing.tabSize,
      configStore.config.editing.enableTabIndent,
      configStore.config.editing.tabType
  );

  // 创建字体扩展
  const fontExtension = createFontExtensionFromBackend({
    fontFamily: configStore.config.editing.fontFamily,
    fontSize: configStore.config.editing.fontSize,
    lineHeight: configStore.config.editing.lineHeight,
    fontWeight: configStore.config.editing.fontWeight
  });

  // 创建统计信息更新扩展
  const statsExtension = createStatsUpdateExtension(
      editorStore.updateDocumentStats
  );

  // 创建保存快捷键插件
  const saveShortcutPlugin = createSaveShortcutPlugin(() => {
    if (editorStore.editorView) {
      handleManualSave();
    }
  });

  // 创建自动保存插件
  const autoSavePlugin = createAutoSavePlugin({
    debounceDelay: 300, // 300毫秒的输入防抖
    onSave: (success) => {
      if (success) {
        documentStore.lastSaved = new Date();
      }
    }
  });

  // 组合所有扩展
  const extensions: Extension[] = [
    themeExtension,
    ...basicExtensions,
    ...tabExtensions,
    fontExtension,
    statsExtension,
    saveShortcutPlugin,
    autoSavePlugin
  ];

  // 创建编辑器状态
  const state = EditorState.create({
    doc: docContent,
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

  // 立即更新统计信息
  updateStats(view, editorStore.updateDocumentStats);

};

// 创建滚轮事件处理器
const handleWheel = createWheelZoomHandler(
    configStore.increaseFontSize,
    configStore.decreaseFontSize
);

// 手动保存文档
const handleManualSave = async () => {
  if (!editorStore.editorView || isDestroying) return;
  
  const view = editorStore.editorView as EditorView;
  const content = view.state.doc.toString();

  // 先更新内容
  await DocumentService.UpdateActiveDocumentContent(content);
  // 然后调用强制保存方法（不再传递content参数）
  const success = await documentStore.forceSaveDocument();
  if (success) {
    logStore.info(t('document.manualSaveSuccess'));
  }
};

// 重新配置编辑器（仅在必要时）
const reconfigureTabSettings = () => {
  if (!editorStore.editorView) return;
  updateTabConfig(
      editorStore.editorView as EditorView,
      configStore.config.editing.tabSize,
      configStore.config.editing.enableTabIndent,
      configStore.config.editing.tabType
  );
};

// 重新配置字体设置
const reconfigureFontSettings = () => {
  if (!editorStore.editorView) return;
  updateFontConfig(editorStore.editorView as EditorView, {
    fontFamily: configStore.config.editing.fontFamily,
    fontSize: configStore.config.editing.fontSize,
    lineHeight: configStore.config.editing.lineHeight,
    fontWeight: configStore.config.editing.fontWeight
  });
};

// 监听Tab设置变化
watch([
  () => configStore.config.editing.tabSize,
  () => configStore.config.editing.enableTabIndent,
  () => configStore.config.editing.tabType,
], () => {
  reconfigureTabSettings();
});

// 监听字体大小变化
watch([
  () => configStore.config.editing.fontFamily,
  () => configStore.config.editing.fontSize,
  () => configStore.config.editing.lineHeight,
  () => configStore.config.editing.fontWeight,
], () => {
  reconfigureFontSettings();
  editorStore.applyFontSize();
});

// 监听主题变化
watch(() => configStore.config.appearance.theme, async (newTheme) => {
  if (newTheme && editorStore.editorView) {
    await updateTheme(editorStore.editorView as EditorView, newTheme);
  }
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
  isDestroying = true;
  
  // 移除滚轮事件监听
  if (editorElement.value) {
    editorElement.value.removeEventListener('wheel', handleWheel);
  }

  // 直接销毁编辑器
  if (editorStore.editorView) {
    editorStore.editorView.destroy();
    editorStore.setEditorView(null);
  }
});
</script>

<template>
  <div class="editor-container">
    <div ref="editorElement" class="editor"></div>
    <Toolbar />
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