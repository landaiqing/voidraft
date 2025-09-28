<template>
  <div class="tab-container" style="--wails-draggable:no-drag">
    <div class="tab-bar" ref="tabBarRef">
      <div class="tab-scroll-wrapper" ref="tabScrollWrapperRef" style="--wails-draggable:no-drag" @wheel.prevent.stop="onWheelScroll">
        <div class="tab-list" ref="tabListRef">
          <TabItem
            v-for="tab in mockTabs"
            :key="tab.id"
            :tab="tab"
            :is-active="tab.id === activeTabId"
            @click="switchToTab(tab.id)"
            @close="closeTab(tab.id)"
            @dragstart="onDragStart($event, tab.id)"
            @dragover="onDragOver"
            @drop="onDrop($event, tab.id)"
          />
        </div>
      </div>
      

    </div>
    
    <!-- 右键菜单占位 -->
    <div v-if="showContextMenu" class="context-menu-placeholder">
      <!-- 这里将来会放置 TabContextMenu 组件 -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import TabItem from './TabItem.vue';

// 模拟数据接口
interface MockTab {
  id: number;
  title: string;
  isDirty: boolean;
  isActive: boolean;
  documentId: number;
}

// 模拟标签页数据
const mockTabs = ref<MockTab[]>([
  { id: 1, title: 'Document 1', isDirty: false, isActive: true, documentId: 1 },
  { id: 2, title: 'Long Document Name Example', isDirty: true, isActive: false, documentId: 2 },
  { id: 3, title: 'README.md', isDirty: false, isActive: false, documentId: 3 },
  { id: 4, title: 'config.json', isDirty: true, isActive: false, documentId: 4 },
  { id: 5, title: 'Another Very Long Document Title', isDirty: false, isActive: false, documentId: 5 },
  { id: 6, title: 'package.json', isDirty: false, isActive: false, documentId: 6 },
  { id: 7, title: 'index.html', isDirty: true, isActive: false, documentId: 7 },
  { id: 8, title: 'styles.css', isDirty: false, isActive: false, documentId: 8 },
  { id: 9, title: 'main.js', isDirty: false, isActive: false, documentId: 9 },
  { id: 10, title: 'utils.ts', isDirty: true, isActive: false, documentId: 10 },
]);

const activeTabId = ref(1);
const showContextMenu = ref(false);

// DOM 引用
const tabBarRef = ref<HTMLElement>();
const tabListRef = ref<HTMLElement>();
// 新增：滚动容器引用
const tabScrollWrapperRef = ref<HTMLDivElement | null>(null);

// 拖拽状态
let draggedTabId: number | null = null;

// 切换标签页
const switchToTab = (tabId: number) => {
  activeTabId.value = tabId;
  mockTabs.value.forEach(tab => {
    tab.isActive = tab.id === tabId;
  });
  console.log('Switch to tab:', tabId);
};

// 关闭标签页
const closeTab = (tabId: number) => {
  const index = mockTabs.value.findIndex(tab => tab.id === tabId);
  if (index === -1) return;
  
  mockTabs.value.splice(index, 1);
  
  // 如果关闭的是活跃标签页，切换到其他标签页
  if (activeTabId.value === tabId && mockTabs.value.length > 0) {
    const nextTab = mockTabs.value[Math.max(0, index - 1)];
    switchToTab(nextTab.id);
  }
  
  console.log('Close tab:', tabId);
};

// 拖拽开始
const onDragStart = (event: DragEvent, tabId: number) => {
  draggedTabId = tabId;
  event.dataTransfer?.setData('text/plain', tabId.toString());
  console.log('Drag start:', tabId);
};

// 拖拽悬停
const onDragOver = (event: DragEvent) => {
  event.preventDefault();
};

// 拖拽放置
const onDrop = (event: DragEvent, targetTabId: number) => {
  event.preventDefault();
  
  if (draggedTabId && draggedTabId !== targetTabId) {
    const draggedIndex = mockTabs.value.findIndex(tab => tab.id === draggedTabId);
    const targetIndex = mockTabs.value.findIndex(tab => tab.id === targetTabId);
    
    if (draggedIndex !== -1 && targetIndex !== -1) {
      const draggedTab = mockTabs.value.splice(draggedIndex, 1)[0];
      mockTabs.value.splice(targetIndex, 0, draggedTab);
      console.log('Reorder tabs:', draggedTabId, 'to position of', targetTabId);
    }
  }
  
  draggedTabId = null;
};


const onWheelScroll = (event: WheelEvent) => {
  const el = tabScrollWrapperRef.value;
  if (!el) return;
  const delta = event.deltaY || event.deltaX || 0;
  el.scrollLeft += delta;
};


onMounted(() => {
  // 组件挂载时的初始化逻辑
});

onUnmounted(() => {
  // 组件卸载时的清理逻辑
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

.context-menu-placeholder {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 1000;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 4px 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
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