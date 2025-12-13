<template>
  <div class="windows-titlebar" style="--wails-draggable:drag">
    <div class="titlebar-content" @dblclick="handleToggleMaximize" @contextmenu.prevent>
      <div class="titlebar-icon">
        <img src="/appicon.png" alt="voidraft"/>
      </div>
      <div v-if="!tabStore.isTabsEnabled && !isInSettings" class="titlebar-title" :title="fullTitleText">
        {{ titleText }}
      </div>
      <!-- 标签页容器区域 -->
      <div class="titlebar-tabs" v-if="tabStore.isTabsEnabled && !isInSettings" style="--wails-draggable:drag">
        <TabContainer/>
      </div>
      <!-- 设置页面标题 -->
      <div v-if="isInSettings" class="titlebar-title" :title="fullTitleText">{{ titleText }}</div>
    </div>

    <div class="titlebar-controls" style="--wails-draggable:no-drag" @contextmenu.prevent>
      <button
          class="titlebar-button minimize-button"
          @click="minimizeWindow"
          :title="t('titlebar.minimize')"
      >
        <span class="titlebar-icon">&#xE921;</span>
      </button>

      <button
          class="titlebar-button maximize-button"
          @click="handleToggleMaximize"
          :title="isMaximized ? t('titlebar.restore') : t('titlebar.maximize')"
      >
        <span class="titlebar-icon" v-html="maximizeIcon"></span>
      </button>

      <button
          class="titlebar-button close-button"
          @click="closeWindow"
          :title="t('titlebar.close')"
      >
        <span class="titlebar-icon">&#xE8BB;</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, onMounted, ref} from 'vue';
import {useI18n} from 'vue-i18n';
import {useRoute} from 'vue-router';
import {useDocumentStore} from '@/stores/documentStore';
import {useTabStore} from '@/stores/tabStore';
import TabContainer from '@/components/tabs/TabContainer.vue';
import {
  minimizeWindow,
  toggleMaximize,
  closeWindow,
  getMaximizedState,
  generateTitleText,
  generateFullTitleText
} from './index';

const {t} = useI18n();
const route = useRoute();
const tabStore = useTabStore();
const documentStore = useDocumentStore();

const isMaximized = ref(false);
const maximizeIcon = computed(() => isMaximized.value ? '&#xE923;' : '&#xE922;');
const isInSettings = computed(() => route.path.startsWith('/settings'));

const titleText = computed(() => {
  if (isInSettings.value) return `voidraft - ${t('settings.title')}`;
  return generateTitleText(documentStore.currentDocument?.title);
});

const fullTitleText = computed(() => {
  if (isInSettings.value) return `voidraft - ${t('settings.title')}`;
  return generateFullTitleText(documentStore.currentDocument?.title);
});

const handleToggleMaximize = async () => {
  await toggleMaximize();
  isMaximized.value = await getMaximizedState();
};

onMounted(async () => {
  isMaximized.value = await getMaximizedState();
});
</script>

<style scoped lang="scss">
.windows-titlebar {
  display: flex;
  height: 32px;
  background: var(--toolbar-bg);
  border-bottom: 1px solid var(--toolbar-border);
  user-select: none;
  -webkit-user-select: none;
  width: 100%;
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;

  -webkit-context-menu: none;
  -moz-context-menu: none;
  context-menu: none;
}

.titlebar-content {
  display: flex;
  align-items: center;
  flex: 1;
  padding-left: 8px;
  gap: 8px;
  color: var(--toolbar-text);
  font-size: 12px;
  font-weight: 400;
  cursor: default;
  min-width: 0;

  -webkit-context-menu: none;
  -moz-context-menu: none;
  context-menu: none;
}

.titlebar-content .titlebar-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}

.titlebar-tabs {
  flex: 1;
  height: 100%;
  align-items: center;
  overflow: hidden;
  margin-left: 8px;
  min-width: 0;
}

.titlebar-controls {
  display: flex;
  height: 100%;

  -webkit-context-menu: none;
  -moz-context-menu: none;
  context-menu: none;
}

.titlebar-button {
  width: 46px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--toolbar-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.1s ease;
  padding: 0;
  margin: 0;

  &:hover {
    background: var(--toolbar-button-hover);
  }

  &:active {
    background: var(--toolbar-button-hover);
    opacity: 0.8;
  }
}

.titlebar-button .titlebar-icon {
  font-family: 'Segoe MDL2 Assets', 'Segoe UI Symbol', 'Segoe UI', system-ui;
  font-size: 9px;
  line-height: 1;
  display: inline-block;
  opacity: 0.9;
  transition: opacity 0.1s ease;

  .titlebar-button:hover & {
    opacity: 1;
  }
}

.minimize-button:hover,
.maximize-button:hover {
  background: var(--toolbar-button-hover);
}

.minimize-button:active,
.maximize-button:active {
  background: var(--toolbar-button-hover);
  opacity: 0.8;
}

.close-button:hover {
  background: #c42b1c;
  color: #ffffff;

  .titlebar-icon {
    opacity: 1;
  }
}

.close-button:active {
  background: #a93226;

  .titlebar-icon {
    opacity: 1;
  }
}
</style>
