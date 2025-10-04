<template>
  <div class="macos-titlebar" style="--wails-draggable:drag" @contextmenu.prevent>
    <div class="titlebar-controls" style="--wails-draggable:no-drag" @contextmenu.prevent>
      <button 
        class="titlebar-button close-button" 
        @click="closeWindow"
        :title="t('titlebar.close')"
      >
        <div class="button-icon">
          <svg width="6" height="6" viewBox="0 0 6 6" v-show="showControlIcons">
            <path d="M1 1l4 4m0-4L1 5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
          </svg>
        </div>
      </button>
      
      <button 
        class="titlebar-button minimize-button" 
        @click="minimizeWindow"
        :title="t('titlebar.minimize')"
      >
        <div class="button-icon">
          <svg width="8" height="1" viewBox="0 0 8 1" v-show="showControlIcons">
            <path d="M0 0h8" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
          </svg>
        </div>
      </button>
      
      <button 
        class="titlebar-button maximize-button" 
        @click="toggleMaximize"
        :title="isMaximized ? t('titlebar.restore') : t('titlebar.maximize')"
      >
        <div class="button-icon">
          <svg width="6" height="6" viewBox="0 0 6 6" v-show="showControlIcons && !isMaximized">
            <path d="M1 1l4 0 0 4-4 0z" fill="none" stroke="currentColor" stroke-width="1"/>
            <path d="M2 2l2 0 0 2" fill="none" stroke="currentColor" stroke-width="1"/>
          </svg>
          <svg width="6" height="6" viewBox="0 0 6 6" v-show="showControlIcons && isMaximized">
            <path d="M1 2l4 0 0 3-4 0z" fill="none" stroke="currentColor" stroke-width="1"/>
            <path d="M2 1l3 0 0 3" fill="none" stroke="currentColor" stroke-width="1"/>
          </svg>
        </div>
      </button>
    </div>
    
    <!-- 标签页容器区域 -->
    <div class="titlebar-tabs" v-if="tabStore.isTabsEnabled && !isInSettings" style="--wails-draggable:drag">
      <TabContainer />
    </div>
    
    <div class="titlebar-content" @dblclick="toggleMaximize" @contextmenu.prevent v-if="!tabStore.isTabsEnabled || isInSettings">
      <div class="titlebar-title" :title="fullTitleText">{{ titleText }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import * as runtime from '@wailsio/runtime';
import { useDocumentStore } from '@/stores/documentStore';
import TabContainer from '@/components/tabs/TabContainer.vue';
import { useTabStore } from "@/stores/tabStore";

const tabStore = useTabStore();
const { t } = useI18n();
const route = useRoute();
const isMaximized = ref(false);
const showControlIcons = ref(false);
const documentStore = useDocumentStore();

// 判断是否在设置页面
const isInSettings = computed(() => route.path.startsWith('/settings'));

const minimizeWindow = async () => {
  try {
    await runtime.Window.Minimise();
  } catch (error) {
    console.error(error);
  }
};

const toggleMaximize = async () => {
  try {
    await runtime.Window.ToggleMaximise();
    await checkMaximizedState();
  } catch (error) {
    console.error(error);
  }
};

const closeWindow = async () => {
  try {
    await runtime.Window.Close();
  } catch (error) {
    console.error(error);
  }
};

const checkMaximizedState = async () => {
  try {
    isMaximized.value = await runtime.Window.IsMaximised();
  } catch (error) {
    console.error(error);
  }
};

// 计算标题文本
const titleText = computed(() => {
  if (isInSettings.value) {
    return `voidraft - ` + t('settings.title');
  }
  const currentDoc = documentStore.currentDocument;
  if (currentDoc) {
    // 限制文档标题长度，避免标题栏换行
    const maxTitleLength = 30;
    const truncatedTitle = currentDoc.title.length > maxTitleLength 
      ? currentDoc.title.substring(0, maxTitleLength) + '...' 
      : currentDoc.title;
    return `voidraft - ${truncatedTitle}`;
  }
  return 'voidraft';
});

// 计算完整标题文本（用于tooltip）
const fullTitleText = computed(() => {
  if (isInSettings.value) {
    return `voidraft - ` + t('settings.title');
  }
  const currentDoc = documentStore.currentDocument;
  return currentDoc ? `voidraft - ${currentDoc.title}` : 'voidraft';
});

onMounted(async () => {
  await checkMaximizedState();
});
</script>

<style scoped lang="scss">
.macos-titlebar {
  display: flex;
  height: 28px;
  background: var(--toolbar-bg, #ececec);
  border-bottom: 1px solid var(--toolbar-border, rgba(0, 0, 0, 0.1));
  user-select: none;
  -webkit-user-select: none;
  width: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif;
  
  -webkit-context-menu: none;
  -moz-context-menu: none;
  context-menu: none;
  
  &:hover {
    .titlebar-button {
      .button-icon {
        opacity: 1;
      }
    }
  }
}

.titlebar-controls {
  display: flex;
  height: 100%;
  align-items: center;
  padding-left: 8px;
  gap: 8px;
  flex-shrink: 0;
  
  -webkit-context-menu: none;
  -moz-context-menu: none;
  context-menu: none;
}

.titlebar-button {
  width: 12px;
  height: 12px;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  padding: 0;
  margin: 0;
  position: relative;
  
  .button-icon {
    opacity: 0;
    transition: opacity 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: rgba(0, 0, 0, 0.7);
  }
  
  &:hover .button-icon {
    opacity: 1;
  }
}

.close-button {
  background: #ff5f57;
  
  &:hover {
    background: #ff453a;
  }
  
  &:active {
    background: #d7463f;
  }
}

.minimize-button {
  background: #ffbd2e;
  
  &:hover {
    background: #ffb524;
  }
  
  &:active {
    background: #e6a220;
  }
}

.maximize-button {
  background: #28ca42;
  
  &:hover {
    background: #1ebe36;
  }
  
  &:active {
    background: #1ba932;
  }
}

.titlebar-content {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  cursor: default;
  min-width: 0;
  
  -webkit-context-menu: none;
  -moz-context-menu: none;
  context-menu: none;
}

.titlebar-tabs {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: center;
  margin-left: 8px;
  margin-right: 8px;
  min-width: 0;
  overflow: visible; /* 允许TabContainer内部处理滚动 */
  
  /* 确保TabContainer能够正确处理滚动 */
  :deep(.tab-container) {
    width: 100%;
    height: 100%;
  }
  
  :deep(.tab-bar) {
    width: 100%;
    height: 100%;
  }
  
  :deep(.tab-scroll-wrapper) {
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    -ms-overflow-style: none;
    
    &::-webkit-scrollbar {
      display: none;
    }
  }
  
  /* 确保底部线条能够正确显示 */
  :deep(.tab-item) {
    position: relative;
    
    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      width: 0;
      height: 2px;
      background: var(--tab-active-line, var(--accent-color, #007acc));
      transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 10;
    }

    &.active::after {
      width: 100%;
    }
  }
}

.titlebar-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--toolbar-text, #333);
  text-align: center;
}

@media (prefers-color-scheme: dark) {
  .macos-titlebar {
    background: var(--toolbar-bg, #2d2d2d);
    border-bottom-color: var(--toolbar-border, rgba(255, 255, 255, 0.1));
  }
  
  .titlebar-title {
    color: var(--toolbar-text, #fff);
  }
  
  .titlebar-button .button-icon {
    color: rgba(255, 255, 255, 0.8);
  }
}
</style>