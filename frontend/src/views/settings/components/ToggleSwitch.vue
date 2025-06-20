<script setup lang="ts">
import { nextTick } from 'vue';

const props = defineProps<{
  modelValue: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>();

const toggle = async () => {
  if (props.disabled) return;
  
  const newValue = !props.modelValue;
  emit('update:modelValue', newValue);
  
  // 确保DOM更新
  await nextTick();
};
</script>

<template>
  <div 
    class="toggle-switch" 
    :class="{ 
      active: modelValue, 
      disabled: disabled 
    }" 
    @click="toggle"
  >
    <div class="toggle-handle"></div>
  </div>
</template>

<style scoped lang="scss">
.toggle-switch {
  width: 36px;
  height: 18px;
  background-color: var(--settings-input-border);
  border-radius: 9px;
  position: relative;
  cursor: pointer;
  transition: background-color 0.2s;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
  
  &.active {
    background-color: #4a9eff;
    
    .toggle-handle {
      transform: translateX(18px);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }
  }
  
  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    
    &:hover {
      background-color: var(--settings-input-border);
    }
    
    &.active:hover {
      background-color: #4a9eff;
    }
  }
  
  .toggle-handle {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    background-color: var(--settings-text);
    border-radius: 50%;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }
}
</style> 