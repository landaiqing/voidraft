<template>
  <div 
    class="tab-item"
    :class="{ 
      active: isActive,
      dragging: isDragging 
    }"
    style="--wails-draggable:no-drag"
    draggable="true"
    @click="handleClick"
    @dragstart="handleDragStart"
    @dragover="handleDragOver"
    @drop="handleDrop"
    @dragend="handleDragEnd"
    @contextmenu="handleContextMenu"
  >
    <!-- 文档图标 -->
    <div class="tab-icon">
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="12" 
        height="12" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        stroke-width="2" 
        stroke-linecap="round" 
        stroke-linejoin="round"
      >
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
        <polyline points="14,2 14,8 20,8"/>
      </svg>
    </div>

    <!-- 标签页标题 -->
    <div class="tab-title" :title="tab.title">
      {{ displayTitle }}
    </div>
    
    <!-- 关闭按钮 -->
    <div 
      class="tab-close"
      @click.stop="handleClose"
      :title="'关闭标签页'"
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="12" 
        height="12" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        stroke-width="2" 
        stroke-linecap="round" 
        stroke-linejoin="round"
      >
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </div>
    
    <!-- 拖拽指示器 -->
    <div v-if="isDragging" class="drag-indicator"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

// 组件属性
interface TabProps {
  tab: {
    id: number;
    title: string;
    isDirty: boolean;
    isActive: boolean;
    documentId: number;
  };
  isActive: boolean;
}

const props = defineProps<TabProps>();

// 组件事件
const emit = defineEmits<{
  click: [tabId: number];
  close: [tabId: number];
  dragstart: [event: DragEvent, tabId: number];
  dragover: [event: DragEvent];
  drop: [event: DragEvent, tabId: number];
  contextmenu: [event: MouseEvent, tabId: number];
}>();

// 组件状态
const isDragging = ref(false);

// 计算属性
const displayTitle = computed(() => {
  const title = props.tab.title;
  // 限制标题长度，超过15个字符显示省略号
  return title.length > 15 ? title.substring(0, 15) + '...' : title;
});

// 事件处理
const handleClick = () => {
  emit('click', props.tab.id);
};

const handleClose = () => {
  emit('close', props.tab.id);
};

const handleDragStart = (event: DragEvent) => {
  isDragging.value = true;
  emit('dragstart', event, props.tab.id);
};

const handleDragOver = (event: DragEvent) => {
  emit('dragover', event);
};

const handleDrop = (event: DragEvent) => {
  isDragging.value = false;
  emit('drop', event, props.tab.id);
};

const handleDragEnd = () => {
  isDragging.value = false;
};

const handleContextMenu = (event: MouseEvent) => {
  event.preventDefault();
  emit('contextmenu', event, props.tab.id);
};
</script>

<style scoped lang="scss">
.tab-item {
  display: flex;
  align-items: center;
  min-width: 120px;
  max-width: 200px;
  height: 32px; // 适配标题栏高度
  padding: 0 8px;
  background-color: transparent;
  border-right: 1px solid var(--toolbar-border);
  cursor: pointer;
  user-select: none;
  position: relative;
  transition: all 0.2s ease;
  box-sizing: border-box; // 防止激活态的边框影响整体高度
  
  &:hover {
    background-color: var(--toolbar-button-hover);
    
    .tab-close {
      opacity: 1;
    }
  }
  
  &.active {
    background-color: var(--toolbar-button-hover);
    border-bottom: 2px solid var(--accent-color);
    color: var(--toolbar-text);
    
    .tab-title {
      color: var(--toolbar-text);
      /* 不用加粗，避免抖动 */
    }
  }
  
  &.dragging {
    opacity: 0.5;
    transform: rotate(2deg);
    z-index: 1000;
  }
}

/* 文档图标 */
.tab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 6px;
  color: var(--toolbar-text);
  transition: color 0.2s ease;
  
  svg {
    width: 12px;
    height: 12px;
  }
}

.tab-title {
  flex: 1;
  font-size: 12px;
  color: var(--toolbar-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.2s ease;
}

.tab-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-left: 4px;
  border-radius: 2px;
  opacity: 0;
  color: var(--toolbar-text);
  transition: all 0.2s ease;
  
  &:hover {
    background-color: var(--error-color);
    color: white;
    opacity: 1 !important;
  }
  
  svg {
    width: 10px;
    height: 10px;
  }
}

.drag-indicator {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(45deg, 
    transparent 25%, 
    rgba(var(--accent-color-rgb), 0.1) 25%, 
    rgba(var(--accent-color-rgb), 0.1) 50%, 
    transparent 50%, 
    transparent 75%, 
    rgba(var(--accent-color-rgb), 0.1) 75%
  );
  background-size: 8px 8px;
  pointer-events: none;
}

/* 活跃标签页在拖拽时的特殊样式 */
.tab-item.active.dragging {
  border-bottom-color: transparent;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .tab-item {
    min-width: 100px;
    max-width: 150px;
    padding: 0 6px;
  }
  
  .tab-title {
    font-size: 11px;
  }
  
  .tab-close {
    width: 18px;
    height: 18px;
    
    svg {
      width: 12px;
      height: 12px;
    }
  }
}
</style>