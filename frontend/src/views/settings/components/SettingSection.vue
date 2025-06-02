<script setup lang="ts">
defineProps<{
  title: string;
}>();
</script>

<template>
  <div class="setting-section">
    <h2 class="section-title">{{ title }}</h2>
    <div class="section-content">
      <slot></slot>
    </div>
  </div>
</template>

<style scoped lang="scss">
.setting-section {
  margin-bottom: 30px;
  background-color: #333333;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  
  .section-title {
    font-size: 14px;
    font-weight: 600;
    margin: 0;
    padding: 12px 16px;
    background-color: #3d3d3d;
    color: #ffffff;
    border-bottom: 1px solid #444444;
  }
  
  .section-content {
    padding: 8px 16px;
  }
}
</style> 