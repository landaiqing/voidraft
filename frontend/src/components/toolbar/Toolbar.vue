<script setup lang="ts">
import {useI18n} from 'vue-i18n';
import {onMounted, onUnmounted, ref, watch} from 'vue';
import {useConfigStore} from '@/stores/configStore';
import {useEditorStore} from '@/stores/editorStore';
import {useErrorHandler} from '@/utils/errorHandler';
import * as runtime from '@wailsio/runtime';
import {useRouter} from 'vue-router';
import BlockLanguageSelector from './BlockLanguageSelector.vue';
import {getActiveNoteBlock} from '@/views/editor/extensions/codeblock/state';
import {getLanguage} from '@/views/editor/extensions/codeblock/lang-parser/languages';

const editorStore = useEditorStore();
const configStore = useConfigStore();
const {safeCall} = useErrorHandler();
const {t} = useI18n();
const router = useRouter();


// 设置窗口置顶
const setWindowAlwaysOnTop = async (isTop: boolean) => {
  await safeCall(async () => {
    await runtime.Window.SetAlwaysOnTop(isTop);
  }, 'window.setTopFailed');
};

// 切换窗口置顶
const toggleAlwaysOnTop = async () => {
  await safeCall(async () => {
    await configStore.toggleAlwaysOnTop();
    // 使用Window.SetAlwaysOnTop方法设置窗口置顶状态
    await runtime.Window.SetAlwaysOnTop(configStore.config.general.alwaysOnTop);
  }, 'config.alwaysOnTopFailed');
};

// 跳转到设置页面
const goToSettings = () => {
  router.push('/settings');
};


// 当前块是否支持格式化的响应式状态
const canFormatCurrentBlock = ref(false);

// 更新格式化按钮状态
const updateFormatButtonState = () => {
  if (!editorStore.editorView) {
    canFormatCurrentBlock.value = false;
    return;
  }

  try {
    const state = editorStore.editorView.state;
    const activeBlock = getActiveNoteBlock(state as any);
    if (!activeBlock) {
      canFormatCurrentBlock.value = false;
      return;
    }

    const language = getLanguage(activeBlock.language.name as any);
    canFormatCurrentBlock.value = !!(language && language.prettier);
  } catch (error) {
    canFormatCurrentBlock.value = false;
  }
};

// 编辑器事件监听器引用，用于清理
let editorEventListeners: (() => void)[] = [];

// 监听编辑器初始化
watch(
    () => editorStore.editorView,
    (newView, oldView) => {
      // 清理旧的监听器
      editorEventListeners.forEach(cleanup => cleanup());
      editorEventListeners = [];
      
      if (newView) {
        updateFormatButtonState();
        
        // 添加点击监听器（用于检测光标位置变化）
        const clickListener = () => {
          setTimeout(updateFormatButtonState, 0);
        };
        newView.dom.addEventListener('click', clickListener);
        editorEventListeners.push(() => newView.dom.removeEventListener('click', clickListener));
        
        // 添加键盘监听器（用于检测内容和光标变化）
        const keyupListener = () => {
          setTimeout(updateFormatButtonState, 0);
        };
        newView.dom.addEventListener('keyup', keyupListener);
        editorEventListeners.push(() => newView.dom.removeEventListener('keyup', keyupListener));
        
      } else {
        canFormatCurrentBlock.value = false;
      }
    },
    {immediate: true}
);

// 定期更新格式化按钮状态（作为备用机制）
let formatButtonUpdateTimer: number | null = null;

const isLoaded = ref(false);

onMounted(() => {
  isLoaded.value = true;
  // 降低定时器频率，主要作为备用机制
  formatButtonUpdateTimer = setInterval(updateFormatButtonState, 2000) as any;
});

onUnmounted(() => {
  // 清理定时器
  if (formatButtonUpdateTimer) {
    clearInterval(formatButtonUpdateTimer);
    formatButtonUpdateTimer = null;
  }
  
  // 清理编辑器事件监听器
  editorEventListeners.forEach(cleanup => cleanup());
  editorEventListeners = [];
});

// 监听置顶设置变化
watch(
    () => configStore.config.general.alwaysOnTop,
    async (newValue) => {
      if (!isLoaded.value) return;
      await runtime.Window.SetAlwaysOnTop(newValue);
    }
);

// 在组件加载完成后应用置顶设置
watch(isLoaded, async (newLoaded) => {
  if (newLoaded && configStore.config.general.alwaysOnTop) {
    await setWindowAlwaysOnTop(true);
  }
});
</script>

<template>
  <div class="toolbar-container">
    <div class="statistics">
      <span class="stat-item" :title="t('toolbar.editor.lines')">{{ t('toolbar.editor.lines') }}: <span
          class="stat-value">{{
          editorStore.documentStats.lines
        }}</span></span>
      <span class="stat-item" :title="t('toolbar.editor.characters')">{{ t('toolbar.editor.characters') }}: <span
          class="stat-value">{{
          editorStore.documentStats.characters
        }}</span></span>
      <span class="stat-item" :title="t('toolbar.editor.selected')"
            v-if="editorStore.documentStats.selectedCharacters > 0">
        {{ t('toolbar.editor.selected') }}: <span class="stat-value">{{
          editorStore.documentStats.selectedCharacters
        }}</span>
      </span>
    </div>
    <div class="actions">
      <span class="font-size" :title="t('toolbar.fontSizeTooltip')" @click="() => configStore.resetFontSize()">
        {{ configStore.config.editing.fontSize }}px
      </span>

      <!-- 块语言选择器 -->
      <BlockLanguageSelector/>

      <!-- 格式化提示按钮 - 只在支持的语言块中显示，不可点击 -->
      <div
          v-if="canFormatCurrentBlock"
          class="format-button"
          :title="t('toolbar.formatHint')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path
              d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
          <path d="M5 3v4"/>
          <path d="M19 17v4"/>
          <path d="M3 5h4"/>
          <path d="M17 19h4"/>
        </svg>
      </div>

      <!-- 窗口置顶图标按钮 -->
      <div
          class="pin-button"
          :class="{ 'active': configStore.config.general.alwaysOnTop }"
          :title="t('toolbar.alwaysOnTop')"
          @click="toggleAlwaysOnTop"
      >
        <svg class="pin-icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg">
          <path
              d="M557.44 104.96l361.6 361.6-60.16 64-26.88-33.92-181.12 181.12L617.6 832l-60.16 60.16-181.12-184.32-211.2 211.2-60.16-60.16 211.2-211.2-181.12-181.12 60.16-60.16 151.04-30.08 181.12-181.12-30.72-30.08 64-60.16zM587.52 256L387.84 455.04l-120.32 23.68 277.76 277.76 23.68-120.32L768 436.48z"/>
        </svg>
      </div>


      <button class="settings-btn" :title="t('toolbar.settings')" @click="goToSettings">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.toolbar-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--bg-secondary);
  color: var(--text-secondary);
  padding: 0 12px;
  height: 28px;
  font-size: 12px;
  border-top: 1px solid var(--border-color);
  user-select: none;

  .statistics {
    display: flex;
    gap: 12px;

    .stat-item {
      color: var(--text-muted);

      .stat-value {
        color: var(--text-secondary);
        font-weight: 500;
      }
    }
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 12px;

    .font-size {
      color: var(--text-muted);
      font-size: 11px;
      cursor: help;
    }


    /* 窗口置顶图标按钮样式 */
    .pin-button {
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      padding: 2px;
      border-radius: 3px;
      transition: all 0.2s ease;

      &:hover {
        background-color: var(--border-color);
        opacity: 0.8;
      }

      &.active {
        background-color: rgba(181, 206, 168, 0.2);

        .pin-icon {
          fill: #b5cea8;
        }
      }

      .pin-icon {
        width: 14px;
        height: 14px;
        fill: var(--text-muted);
        transition: fill 0.2s ease;
      }
    }


    .format-button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      padding: 2px;
      border-radius: 3px;
      transition: all 0.2s ease;

      //&:not(.disabled) {
      //  cursor: pointer;
      //
      //  &:hover {
      //    background-color: var(--border-color);
      //    opacity: 0.8;
      //  }
      //}
      //
      //&.disabled {
      //  cursor: not-allowed;
      //  opacity: 0.5;
      //  background-color: rgba(128, 128, 128, 0.1);
      //}

      svg {
        width: 14px;
        height: 14px;
        stroke: var(--text-muted);
        transition: stroke 0.2s ease;
      }

      &:hover svg {
        stroke: var(--text-secondary);
      }
    }

    .settings-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2px;

      &:hover {
        color: var(--text-secondary);
      }
    }
  }
}
</style>
