<template>
  <div class="tab-container" style="--wails-draggable:drag">
    <div class="tab-bar" ref="tabBarRef">
      <div class="tab-scroll-wrapper" ref="tabScrollWrapperRef" style="--wails-draggable:drag" @wheel.prevent.stop="onWheelScroll">
        <div class="tab-list" ref="tabListRef">
          <TabItem
            v-for="tab in tabStore.tabs"
            :key="tab.documentId"
            :tab="tab"
            :isActive="tab.documentId === tabStore.currentDocumentId"
            :canClose="tabStore.canCloseTab"
            @click="switchToTab"
            @close="closeTab"
            @dragstart="onDragStart"
            @dragover="onDragOver"
            @drop="onDrop"
            @contextmenu="onContextMenu"
          />
        </div>
      </div>
    </div>
    
    <!-- 右键菜单 -->
    <TabContextMenu
      :visible="showContextMenu"
      :position="contextMenuPosition"
      :targetDocumentId="contextMenuTargetId"
      @close="closeContextMenu"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import TabItem from './TabItem.vue';
import TabContextMenu from './TabContextMenu.vue';
import { useTabStore } from '@/stores/tabStore';

const tabStore = useTabStore();

// DOM 引用
const tabBarRef = ref<HTMLElement>();
const tabListRef = ref<HTMLElement>();
const tabScrollWrapperRef = ref<HTMLDivElement | null>(null);

// 右键菜单状态
const showContextMenu = ref(false);
const contextMenuPosition = ref({ x: 0, y: 0 });
const contextMenuTargetId = ref<number | null>(null);


// 标签页操作
const switchToTab = (documentId: number) => {
  tabStore.switchToTabAndDocument(documentId);
};

const closeTab = (documentId: number) => {
  tabStore.closeTab(documentId);
};

// 拖拽操作
const onDragStart = (event: DragEvent, documentId: number) => {
  tabStore.draggedTabId = documentId;
  event.dataTransfer!.effectAllowed = 'move';
};

const onDragOver = (event: DragEvent) => {
  event.preventDefault();
  event.dataTransfer!.dropEffect = 'move';
};

const onDrop = (event: DragEvent, targetDocumentId: number) => {
  event.preventDefault();
  
  if (tabStore.draggedTabId && tabStore.draggedTabId !== targetDocumentId) {
    const draggedIndex = tabStore.getTabIndex(tabStore.draggedTabId);
    const targetIndex = tabStore.getTabIndex(targetDocumentId);
    
    if (draggedIndex !== -1 && targetIndex !== -1) {
      tabStore.moveTab(draggedIndex, targetIndex);
    }
  }
  
  tabStore.draggedTabId = null;
};

// 右键菜单操作
const onContextMenu = (event: MouseEvent, documentId: number) => {
  event.preventDefault();
  event.stopPropagation();
  
  contextMenuPosition.value = { x: event.clientX, y: event.clientY };
  contextMenuTargetId.value = documentId;
  showContextMenu.value = true;
};

const closeContextMenu = () => {
  showContextMenu.value = false;
  contextMenuTargetId.value = null;
};

// 滚轮滚动处理
const onWheelScroll = (event: WheelEvent) => {
  const el = tabScrollWrapperRef.value;
  if (!el) return;
  const delta = event.deltaY || event.deltaX || 0;
  el.scrollLeft += delta;
};

// 自动滚动到活跃标签页
const scrollToActiveTab = async () => {
  await nextTick();
  
  const scrollWrapper = tabScrollWrapperRef.value;
  const tabList = tabListRef.value;
  
  if (!scrollWrapper || !tabList) return;
  
  // 查找当前活跃的标签页元素
  const activeTabElement = tabList.querySelector('.tab-item.active') as HTMLElement;
  if (!activeTabElement) return;
  
  const scrollWrapperRect = scrollWrapper.getBoundingClientRect();
  const activeTabRect = activeTabElement.getBoundingClientRect();
  
  // 计算活跃标签页相对于滚动容器的位置
  const activeTabLeft = activeTabRect.left - scrollWrapperRect.left + scrollWrapper.scrollLeft;
  const activeTabRight = activeTabLeft + activeTabRect.width;
  
  // 获取滚动容器的可视区域
  const scrollLeft = scrollWrapper.scrollLeft;
  const scrollRight = scrollLeft + scrollWrapper.clientWidth;
  
  // 如果活跃标签页不在可视区域内，则滚动到合适位置
  if (activeTabLeft < scrollLeft) {
    // 标签页在左侧不可见，滚动到左边
    scrollWrapper.scrollLeft = activeTabLeft - 10; // 留一点边距
  } else if (activeTabRight > scrollRight) {
    // 标签页在右侧不可见，滚动到右边
    scrollWrapper.scrollLeft = activeTabRight - scrollWrapper.clientWidth + 10; // 留一点边距
  }
};

onMounted(() => {
  // 组件挂载时的初始化逻辑
});

onUnmounted(() => {
  // 组件卸载时的清理逻辑
});

// 监听当前活跃标签页的变化
watch(() => tabStore.currentDocumentId, () => {
  scrollToActiveTab();
});

// 监听标签页列表变化
watch(() => tabStore.tabs.length, () => {
  scrollToActiveTab();
});
</script>

<style scoped lang="scss">
.tab-container {
  position: relative;
  background: transparent;
  height: 32px;
}

.tab-bar {
  display: flex;
  align-items: center;
  height: 100%;
  background: var(--toolbar-bg);
  min-width: 0; /* 允许子项收缩，确保产生横向溢出 */
}

.tab-scroll-wrapper {
  flex: 1;
  min-width: 0; // 关键：允许作为 flex 子项收缩，从而产生横向溢出
  overflow-x: auto;
  overflow-y: hidden;
  position: relative;
  scrollbar-width: none;
  -ms-overflow-style: none;
  pointer-events: auto;
  
  &::-webkit-scrollbar {
    display: none;
  }
}

.tab-list {
  display: flex;
  width: max-content; /* 令宽度等于所有子项总宽度，必定溢出 */
  white-space: nowrap;
  pointer-events: auto;
}

.tab-actions {
  display: flex;
  align-items: center;
  padding: 0 4px;
  background: var(--toolbar-bg);
  flex-shrink: 0; /* 防止被压缩 */
}

.tab-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin: 0 1px;
  border-radius: 3px;
  cursor: pointer;
  color: var(--toolbar-text);
  transition: background-color 0.2s ease;
  
  &:hover {
    background: var(--toolbar-button-hover);
  }
  
  svg {
    width: 12px;
    height: 12px;
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .tab-action-btn {
    width: 20px;
    height: 20px;
    
    svg {
      width: 10px;
      height: 10px;
    }
  }
}
</style>