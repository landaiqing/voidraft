<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
  descriptionType?: 'default' | 'success' | 'error';
}>();
</script>

<template>
  <div class="setting-item">
    <div class="setting-info">
      <div class="setting-title">{{ title }}</div>
      <div 
        v-if="description" 
        class="setting-description"
        :class="{
          'description-success': descriptionType === 'success',
          'description-error': descriptionType === 'error'
        }"
      >
        {{ description }}
      </div>
    </div>
    <div class="setting-control">
      <slot></slot>
    </div>
  </div>
</template>

<style scoped lang="scss">
.setting-item {
  display: flex;
  padding: 12px 0;
  border-bottom: 1px solid var(--settings-border);
  transition: background-color 0.15s ease;
  
  &:hover {
    background-color: var(--settings-hover);
    opacity: 0.8;
  }
  
  &:last-child {
    border-bottom: none;
  }
  
  .setting-info {
    flex: 1;
    padding-right: 16px;
    
    .setting-title {
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 4px;
      color: var(--settings-text);
    }
    
    .setting-description {
      font-size: 11px;
      color: var(--settings-text-secondary);
      line-height: 1.4;
      
      &.description-success {
        color: #4caf50;
      }
      
      &.description-error {
        color: #f44336;
      }
    }
  }
  
  .setting-control {
    width: 180px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }
}
</style> 