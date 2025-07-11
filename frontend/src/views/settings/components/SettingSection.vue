<script setup lang="ts">
defineProps<{
  title: string;
}>();
</script>

<template>
  <div class="setting-section">
    <div class="section-header">
      <h2 class="section-title">{{ title }}</h2>
      <div class="section-title-right">
        <slot name="title-right"></slot>
      </div>
    </div>
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
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background-color: var(--settings-hover);
    border-bottom: 1px solid var(--settings-border);
  }
  
  .section-title {
    font-size: 13px;
    font-weight: 600;
    margin: 0;
    color: var(--settings-text);
  }
  
  .section-title-right {
    display: flex;
    align-items: center;
  }
  
  .section-content {
    padding: 6px 14px;
  }
}
</style>