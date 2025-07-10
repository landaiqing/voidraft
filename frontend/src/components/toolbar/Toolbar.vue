<script setup lang="ts">
import {useI18n} from 'vue-i18n';
import {onMounted, onUnmounted, ref, watch, computed} from 'vue';
import {useConfigStore} from '@/stores/configStore';
import {useEditorStore} from '@/stores/editorStore';
import {useUpdateStore} from '@/stores/updateStore';
import {useWindowStore} from '@/stores/windowStore';
import * as runtime from '@wailsio/runtime';
import {useRouter} from 'vue-router';
import BlockLanguageSelector from './BlockLanguageSelector.vue';
import DocumentSelector from './DocumentSelector.vue';
import {getActiveNoteBlock} from '@/views/editor/extensions/codeblock/state';
import {getLanguage} from '@/views/editor/extensions/codeblock/lang-parser/languages';
import {formatBlockContent} from '@/views/editor/extensions/codeblock/formatCode';

const editorStore = useEditorStore();
const configStore = useConfigStore();
const updateStore = useUpdateStore();
const windowStore = useWindowStore();
const {t} = useI18n();
const router = useRouter();

// 当前块是否支持格式化的响应式状态
const canFormatCurrentBlock = ref(false);

// 窗口置顶状态管理（仅当前窗口，不同步到配置文件）
const isCurrentWindowOnTop = ref(false);

const setWindowAlwaysOnTop = async (isTop: boolean) => {
  await runtime.Window.SetAlwaysOnTop(isTop);
};

const toggleAlwaysOnTop = async () => {
  isCurrentWindowOnTop.value = !isCurrentWindowOnTop.value;
  await runtime.Window.SetAlwaysOnTop(isCurrentWindowOnTop.value);
};

// 跳转到设置页面
const goToSettings = () => {
  router.push('/settings');
};

// 执行格式化
const formatCurrentBlock = () => {
  if (!canFormatCurrentBlock.value || !editorStore.editorView) return;
  formatBlockContent(editorStore.editorView);
};

// 格式化按钮状态更新
const updateFormatButtonState = () => {
  // 安全检查
  const view = editorStore.editorView;
  if (!view) {
    canFormatCurrentBlock.value = false;
    return;
  }

  try {
    // 获取活动块和语言信息
    const state = view.state;
    const activeBlock = getActiveNoteBlock(state as any);
    
    // 检查块和语言格式化支持
    canFormatCurrentBlock.value = !!(
      activeBlock && 
      getLanguage(activeBlock.language.name as any)?.prettier
    );
  } catch (error) {
    console.warn('Error checking format capability:', error);
    canFormatCurrentBlock.value = false;
  }
};

// 创建带300ms防抖的更新函数
const debouncedUpdateFormatButton = (() => {
  let timeout: number | null = null;
  
  return () => {
    if (timeout) clearTimeout(timeout);
    timeout = window.setTimeout(() => {
      updateFormatButtonState();
      timeout = null;
    }, 300);
  };
})();

// 编辑器事件管理
const setupEditorListeners = (view: any) => {
  if (!view?.dom) return [];
  
  const events = [
    { type: 'click', handler: updateFormatButtonState },
    { type: 'keyup', handler: debouncedUpdateFormatButton },
    { type: 'focus', handler: updateFormatButtonState }
  ];
  
  // 注册所有事件
  events.forEach(event => view.dom.addEventListener(event.type, event.handler));
  
  // 返回清理函数数组
  return events.map(event => 
    () => view.dom.removeEventListener(event.type, event.handler)
  );
};

// 监听编辑器视图变化
let cleanupListeners: (() => void)[] = [];

watch(
  () => editorStore.editorView,
  (newView) => {
    // 清理旧监听器
    cleanupListeners.forEach(cleanup => cleanup());
    cleanupListeners = [];
    
    if (newView) {
      // 初始更新状态
      updateFormatButtonState();
      // 设置新监听器
      cleanupListeners = setupEditorListeners(newView);
    } else {
      canFormatCurrentBlock.value = false;
    }
  },
  { immediate: true }
);

// 组件生命周期
const isLoaded = ref(false);

onMounted(() => {
  isLoaded.value = true;
  // 首次更新格式化状态
  updateFormatButtonState();
});

onUnmounted(() => {
  // 清理所有事件监听器
  cleanupListeners.forEach(cleanup => cleanup());
  cleanupListeners = [];
});

// 组件加载后初始化置顶状态
watch(isLoaded, async (loaded) => {
  if (loaded) {
    // 初始化时从配置文件读取置顶状态
    isCurrentWindowOnTop.value = configStore.config.general.alwaysOnTop;
    await setWindowAlwaysOnTop(isCurrentWindowOnTop.value);
  }
});

const handleUpdateButtonClick = async () => {
  if (updateStore.hasUpdate && !updateStore.isUpdating && !updateStore.updateSuccess) {
    // 开始下载更新
    await updateStore.applyUpdate();
  } else if (updateStore.updateSuccess) {
    // 更新成功后，点击重启
    await updateStore.restartApplication();
  }
};

// 更新按钮标题计算属性
const updateButtonTitle = computed(() => {
  if (updateStore.isChecking) return t('settings.checking');
  if (updateStore.isUpdating) return t('settings.updating');
  if (updateStore.updateSuccess) return t('settings.updateSuccessRestartRequired');
  if (updateStore.hasUpdate) return `${t('settings.newVersionAvailable')}: ${updateStore.updateResult?.latestVersion || ''}`;
  return '';
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

      <!-- 文档选择器 -->
      <DocumentSelector v-if="windowStore.isMainWindow"/>

      <!-- 块语言选择器 -->
      <BlockLanguageSelector/>

      <!-- 格式化按钮 - 支持点击操作 -->
      <div
          v-if="canFormatCurrentBlock"
          class="format-button"
          :title="t('toolbar.formatHint')"
          @click="formatCurrentBlock"
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

      <!-- 更新按钮 - 根据状态显示不同图标 -->
      <div
          v-if="updateStore.hasUpdate || updateStore.isChecking || updateStore.isUpdating || updateStore.updateSuccess"
          class="update-button"
          :class="{
            'checking': updateStore.isChecking,
            'updating': updateStore.isUpdating,
            'success': updateStore.updateSuccess,
            'available': updateStore.hasUpdate && !updateStore.isUpdating && !updateStore.updateSuccess
          }"
          :title="updateButtonTitle"
          @click="handleUpdateButtonClick"
      >
        <!-- 检查更新中 -->
        <svg v-if="updateStore.isChecking" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rotating">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        
        <!-- 下载更新中 -->
        <svg v-else-if="updateStore.isUpdating" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rotating">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
          <path d="M12 2a10 10 0 1 0 10 10"></path>
        </svg>
        
        <!-- 更新成功，等待重启 -->
        <svg v-else-if="updateStore.updateSuccess" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pulsing">
          <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
          <line x1="12" y1="2" x2="12" y2="12"></line>
        </svg>
        
        <!-- 有更新可用 -->
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <polyline points="7.5,10.5 12,15 16.5,10.5"/>
          <polyline points="12,15 12,3"/>
        </svg>
      </div>

      <!-- 窗口置顶图标按钮 -->
      <div
          class="pin-button"
          :class="{ 'active': isCurrentWindowOnTop }"
          :title="t('toolbar.alwaysOnTop')"
          @click="toggleAlwaysOnTop"
      >
        <svg class="pin-icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg">
          <path
              d="M557.44 104.96l361.6 361.6-60.16 64-26.88-33.92-181.12 181.12L617.6 832l-60.16 60.16-181.12-184.32-211.2 211.2-60.16-60.16 211.2-211.2-181.12-181.12 60.16-60.16 151.04-30.08 181.12-181.12-30.72-30.08 64-60.16zM587.52 256L387.84 455.04l-120.32 23.68 277.76 277.76 23.68-120.32L768 436.48z"/>
        </svg>
      </div>


      <button v-if="windowStore.isMainWindow" class="settings-btn" :title="t('toolbar.settings')" @click="goToSettings">
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

    /* 更新按钮样式 */
    .update-button {
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      padding: 2px;
      border-radius: 3px;
      transition: all 0.2s ease;

      /* 有更新可用状态 */
      &.available {
        background-color: rgba(76, 175, 80, 0.1);
        animation: pulse 2s infinite;
        
        svg {
          stroke: #4caf50;
        }
        
        &:hover {
          background-color: rgba(76, 175, 80, 0.2);
          transform: scale(1.05);
        }
      }
      
      /* 检查更新中状态 */
      &.checking {
        background-color: rgba(255, 193, 7, 0.1);
        
        svg {
          stroke: #ffc107;
        }
      }
      
      /* 更新下载中状态 */
      &.updating {
        background-color: rgba(33, 150, 243, 0.1);
        
        svg {
          stroke: #2196f3;
        }
      }
      
      /* 更新成功状态 */
      &.success {
        background-color: rgba(156, 39, 176, 0.1);
        
        svg {
          stroke: #9c27b0;
        }
      }

      /* 旋转动画 */
      .rotating {
        animation: rotate 1.5s linear infinite;
      }
      
      /* 脉冲动画 */
      .pulsing {
        animation: pulse-strong 1.2s ease-in-out infinite;
      }

      @keyframes pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.7;
        }
      }
      
      @keyframes pulse-strong {
        0%, 100% {
          transform: scale(1);
          opacity: 1;
        }
        50% {
          transform: scale(1.1);
          opacity: 0.8;
        }
      }
      
      @keyframes rotate {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }
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
