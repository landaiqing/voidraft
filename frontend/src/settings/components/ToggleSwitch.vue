<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>();

const toggle = () => {
  emit('update:modelValue', !props.modelValue);
};
</script>

<template>
  <div class="toggle-switch" :class="{ active: modelValue }" @click="toggle">
    <div class="toggle-handle"></div>
  </div>
</template>

<style scoped lang="scss">
.toggle-switch {
  width: 40px;
  height: 20px;
  background-color: #555555;
  border-radius: 10px;
  position: relative;
  cursor: pointer;
  transition: background-color 0.2s;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
  
  &.active {
    background-color: #4a9eff;
    
    .toggle-handle {
      transform: translateX(20px);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }
  }
  
  .toggle-handle {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background-color: #f0f0f0;
    border-radius: 50%;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }
}
</style> 