<script setup lang="ts">
import { provide, ref } from 'vue';

interface Props {
  /**
   * 是否允许多个面板同时展开
   * @default false - 单选模式（手风琴效果）
   */
  multiple?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  multiple: false,
});

// 当前展开的项（单选模式）或展开项列表（多选模式）
const expandedItems = ref<Set<string | number>>(new Set());

/**
 * 切换展开状态
 */
const toggleItem = (id: string | number) => {
  if (props.multiple) {
    // 多选模式：切换单个项
    if (expandedItems.value.has(id)) {
      expandedItems.value.delete(id);
    } else {
      expandedItems.value.add(id);
    }
  } else {
    // 单选模式：只能展开一个
    if (expandedItems.value.has(id)) {
      expandedItems.value.clear();
    } else {
      expandedItems.value.clear();
      expandedItems.value.add(id);
    }
  }
  // 触发响应式更新
  expandedItems.value = new Set(expandedItems.value);
};

/**
 * 检查项是否展开
 */
const isExpanded = (id: string | number): boolean => {
  return expandedItems.value.has(id);
};

/**
 * 展开指定项
 */
const expand = (id: string | number) => {
  if (!props.multiple) {
    expandedItems.value.clear();
  }
  expandedItems.value.add(id);
  expandedItems.value = new Set(expandedItems.value);
};

/**
 * 收起指定项
 */
const collapse = (id: string | number) => {
  expandedItems.value.delete(id);
  expandedItems.value = new Set(expandedItems.value);
};

/**
 * 收起所有项
 */
const collapseAll = () => {
  expandedItems.value.clear();
  expandedItems.value = new Set(expandedItems.value);
};

// 通过 provide 向子组件提供状态和方法
provide('accordion', {
  toggleItem,
  isExpanded,
  expand,
  collapse,
});

// 暴露方法供父组件使用
defineExpose({
  expand,
  collapse,
  collapseAll,
});
</script>

<template>
  <div class="accordion-container">
    <slot></slot>
  </div>
</template>

<style scoped lang="scss">
.accordion-container {
  display: flex;
  flex-direction: column;
}
</style>

