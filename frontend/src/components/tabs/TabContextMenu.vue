<template>
  <div
    v-if="visible && canClose"
    class="tab-context-menu"
    :style="{
      left: position.x + 'px',
      top: position.y + 'px'
    }"
    @click.stop
  >
    <div v-if="canClose" class="menu-item" @click="handleMenuClick('close')">
      <svg class="menu-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
      <span class="menu-text">{{ t('tabs.contextMenu.closeTab') }}</span>
    </div>
    <div v-if="hasOtherTabs" class="menu-item" @click="handleMenuClick('closeOthers')">
      <svg class="menu-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <path d="M9 9l6 6M15 9l-6 6"/>
      </svg>
      <span class="menu-text">{{ t('tabs.contextMenu.closeOthers') }}</span>
    </div>
    <div v-if="hasTabsToLeft" class="menu-item" @click="handleMenuClick('closeLeft')">
      <svg class="menu-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 18l-6-6 6-6"/>
        <path d="M9 18l-6-6 6-6"/>
      </svg>
      <span class="menu-text">{{ t('tabs.contextMenu.closeLeft') }}</span>
    </div>
    <div v-if="hasTabsToRight" class="menu-item" @click="handleMenuClick('closeRight')">
      <svg class="menu-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 18l6-6-6-6"/>
        <path d="M15 18l6-6-6-6"/>
      </svg>
      <span class="menu-text">{{ t('tabs.contextMenu.closeRight') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useTabStore } from '@/stores/tabStore';

interface Props {
  visible: boolean;
  position: { x: number; y: number };
  targetDocumentId: number | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();
const tabStore = useTabStore();

// 计算属性
const canClose = computed(() => tabStore.canCloseTab);

const hasOtherTabs = computed(() => {
  return tabStore.tabs.length > 1;
});

const currentTabIndex = computed(() => {
  if (!props.targetDocumentId) return -1;
  return tabStore.getTabIndex(props.targetDocumentId);
});

const hasTabsToRight = computed(() => {
  const index = currentTabIndex.value;
  return index !== -1 && index < tabStore.tabs.length - 1;
});

const hasTabsToLeft = computed(() => {
  const index = currentTabIndex.value;
  return index > 0;
});

// 处理菜单项点击
const handleMenuClick = (action: string) => {
  if (!props.targetDocumentId) return;

  switch (action) {
    case 'close':
      tabStore.closeTab(props.targetDocumentId);
      break;
    case 'closeOthers':
      tabStore.closeOtherTabs(props.targetDocumentId);
      break;
    case 'closeLeft':
      tabStore.closeTabsToLeft(props.targetDocumentId);
      break;
    case 'closeRight':
      tabStore.closeTabsToRight(props.targetDocumentId);
      break;
  }
  
  emit('close');
};

// 处理外部点击
const handleClickOutside = (_event: MouseEvent) => {
  if (props.visible) {
    emit('close');
  }
};

// 处理ESC键
const handleEscapeKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.visible) {
    emit('close');
  }
};

// 生命周期
onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  document.addEventListener('keydown', handleEscapeKey);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('keydown', handleEscapeKey);
});
</script>

<style scoped lang="scss">
.tab-context-menu {
  position: fixed;
  z-index: 1000;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  min-width: 100px;
  user-select: none;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-primary);
  transition: all 0.15s ease;
  gap: 8px;
  
  &:hover {
    background-color: var(--toolbar-button-hover);
    color: var(--text-primary);
  }
  
  &:active {
    background-color: var(--border-color);
  }
}

.menu-icon {
  flex-shrink: 0;
  width: 12px;
  height: 12px;
  color: var(--text-primary);
  transition: color 0.15s ease;
  
  .menu-item:hover & {
    color: var(--text-primary);
  }
}

.menu-text {
  white-space: nowrap;
  font-weight: 400;
  flex: 1;
}
</style>