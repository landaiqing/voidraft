<script setup lang="ts">
import { inject, computed, ref } from 'vue';

interface Props {
  /**
   * 唯一标识符
   */
  id: string | number;
  /**
   * 标题
   */
  title?: string;
  /**
   * 是否禁用
   */
  disabled?: boolean;
}

const props = defineProps<Props>();

const accordion = inject<{
  toggleItem: (id: string | number) => void;
  isExpanded: (id: string | number) => boolean;
}>('accordion');

if (!accordion) {
  throw new Error('AccordionItem must be used within AccordionContainer');
}

const isExpanded = computed(() => accordion.isExpanded(props.id));

const toggle = () => {
  if (!props.disabled) {
    accordion.toggleItem(props.id);
  }
};

// 内容容器的引用，用于计算高度
const contentRef = ref<HTMLElement>();
const contentHeight = computed(() => {
  if (!contentRef.value) return '0px';
  return isExpanded.value ? `${contentRef.value.scrollHeight}px` : '0px';
});
</script>

<template>
  <div 
    class="accordion-item"
    :class="{ 
      'is-expanded': isExpanded, 
      'is-disabled': disabled 
    }"
  >
    <!-- 标题栏 -->
    <div 
      class="accordion-header"
      @click="toggle"
      :aria-expanded="isExpanded"
      :aria-disabled="disabled"
      role="button"
      tabindex="0"
      @keydown.enter="toggle"
      @keydown.space.prevent="toggle"
    >
      <div class="accordion-title">
        <slot name="title">
          {{ title }}
        </slot>
      </div>
      <div class="accordion-icon">
        <svg 
          width="12" 
          height="12" 
          viewBox="0 0 12 12" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            d="M3 4.5L6 7.5L9 4.5" 
            stroke="currentColor" 
            stroke-width="1.5" 
            stroke-linecap="round" 
            stroke-linejoin="round"
          />
        </svg>
      </div>
    </div>

    <!-- 内容区域 -->
    <div 
      class="accordion-content-wrapper"
      :style="{ height: contentHeight }"
    >
      <div 
        ref="contentRef"
        class="accordion-content"
      >
        <div class="accordion-content-inner">
          <slot></slot>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.accordion-item {
  border-bottom: 1px solid var(--settings-border);
  transition: background-color 0.2s ease;

  &:last-child {
    border-bottom: none;
  }

  &.is-expanded {
    background-color: var(--settings-hover);
  }

  &.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;

    .accordion-header {
      cursor: not-allowed;
    }
  }
}

.accordion-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s ease;

  &:hover:not([aria-disabled="true"]) {
    background-color: var(--settings-hover);
  }

  &:focus-visible {
    outline: 2px solid #4a9eff;
    outline-offset: -2px;
  }
}

.accordion-title {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--settings-text);
  display: flex;
  align-items: center;
  gap: 8px;
}

.accordion-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: var(--text-muted);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  .is-expanded & {
    transform: rotate(180deg);
  }
}

.accordion-content-wrapper {
  overflow: hidden;
  transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.accordion-content {
  // 用于测量实际内容高度
}

.accordion-content-inner {
  padding: 0 16px 12px 16px;
  color: var(--settings-text);
  font-size: 13px;
}
</style>

