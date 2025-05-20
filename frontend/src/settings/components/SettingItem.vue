<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
}>();
</script>

<template>
  <div class="setting-item">
    <div class="setting-info">
      <div class="setting-title">{{ title }}</div>
      <div v-if="description" class="setting-description">{{ description }}</div>
    </div>
    <div class="setting-control">
      <slot></slot>
    </div>
  </div>
</template>

<style scoped lang="scss">
.setting-item {
  display: flex;
  padding: 14px 0;
  border-bottom: 1px solid #444444;
  transition: background-color 0.15s ease;
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.03);
  }
  
  &:last-child {
    border-bottom: none;
  }
  
  .setting-info {
    flex: 1;
    padding-right: 20px;
    
    .setting-title {
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 6px;
      color: #e0e0e0;
    }
    
    .setting-description {
      font-size: 12px;
      color: #a0a0a0;
      line-height: 1.5;
    }
  }
  
  .setting-control {
    width: 200px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }
}
</style> 