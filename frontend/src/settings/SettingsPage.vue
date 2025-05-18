<script setup lang="ts">
import { useConfigStore } from '@/stores/configStore';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const configStore = useConfigStore();
</script>

<template>
  <div class="settings-container">
    <div class="settings-header">
      <h1>{{ t('settings.title') }}</h1>
    </div>
    <div class="settings-content">
      <!-- 设置内容将在此处添加 -->
      <div class="settings-section">
        <h2>{{ t('settings.general') }}</h2>
        <div class="settings-placeholder">
          {{ t('settings.comingSoon') }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.settings-container {
  width: 100%;
  height: 100vh;
  margin: 0;
  padding: 20px;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  overflow: auto;

  .settings-header {
    margin-bottom: 20px;
    
    h1 {
      font-size: 24px;
      font-weight: 600;
    }
  }

  .settings-content {
    flex: 1;
    
    .settings-section {
      margin-bottom: 20px;
      
      h2 {
        font-size: 18px;
        margin-bottom: 12px;
      }
      
      .settings-placeholder {
        padding: 20px;
        background-color: var(--bg-secondary);
        border-radius: 6px;
        text-align: center;
        color: var(--text-muted);
      }
    }
  }
}
</style> 