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
  margin-bottom: 24px;
  background-color: var(--settings-card-bg);
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border: 1px solid var(--settings-border);
  
  .section-title {
    font-size: 13px;
    font-weight: 600;
    margin: 0;
    padding: 10px 14px;
    background-color: var(--settings-hover);
    color: var(--settings-text);
    border-bottom: 1px solid var(--settings-border);
  }
  
  .section-content {
    padding: 6px 14px;
  }
}
</style> 