<script setup lang="ts">
import {useI18n} from 'vue-i18n';
import {computed, onMounted} from 'vue';
import {useConfigStore} from '@/stores/configStore';
import {useUpdateStore} from '@/stores/updateStore';
import SettingSection from '../components/SettingSection.vue';
import SettingItem from '../components/SettingItem.vue';
import ToggleSwitch from '../components/ToggleSwitch.vue';

const {t} = useI18n();
const configStore = useConfigStore();
const updateStore = useUpdateStore();

// 计算属性
const autoCheckUpdates = computed({
  get: () => configStore.config.updates.autoUpdate,
  set: async (value: boolean) => {
    await configStore.setAutoUpdate(value);
  }
});

// 格式化发布说明
const formatReleaseNotes = (notes: string) => {
  if (!notes) return [];

  // 简单的Markdown列表解析
  return notes
      .split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
      .map(line => line.replace(/^[\s\-\*]+/, '').trim())
      .filter(line => line.length > 0);
};

// 处理查看更新
const viewUpdate = () => {
  updateStore.openReleaseURL();
};

// 获取错误信息的国际化文本
const getErrorMessage = (error: string) => {
  if (error.includes('Network') || error.includes('network')) {
    return t('settings.networkError');
  }
  return error;
};
</script>

<template>
  <div class="settings-page">
    <!-- 自动更新设置 -->
    <SettingSection :title="t('settings.updateSettings')">
      <SettingItem 
        :title="t('settings.autoCheckUpdates')" 
        :description="t('settings.autoCheckUpdatesDescription')"
      >
        <ToggleSwitch v-model="autoCheckUpdates"/>
      </SettingItem>
    </SettingSection>

    <!-- 手动检查更新 -->
    <SettingSection :title="t('settings.manualCheck')">
      <SettingItem 
        :title="`${t('settings.currentVersion')}: ${updateStore.updateResult?.currentVer || configStore.config.updates.version}`"
      >
        <button
            class="check-button"
            @click="updateStore.checkForUpdates"
            :disabled="updateStore.isChecking"
        >
          <span v-if="updateStore.isChecking" class="loading-spinner"></span>
          {{ updateStore.isChecking ? t('settings.checking') : t('settings.checkForUpdates') }}
        </button>
      </SettingItem>

      <!-- 检查结果 -->
      <div class="check-results" v-if="updateStore.updateResult || updateStore.errorMessage">
        <!-- 错误信息 -->
        <div v-if="updateStore.errorMessage" class="result-item error-result">
          <div class="result-text">
            <span class="result-icon">⚠️</span>
            <span class="result-message">{{ getErrorMessage(updateStore.errorMessage) }}</span>
          </div>
        </div>

        <!-- 有新版本 -->
        <div v-else-if="updateStore.hasUpdate" class="result-item update-result">
          <div class="result-header">
            <div class="result-text">
              <span class="result-icon">🎉</span>
              <span class="result-message">
                {{ t('settings.newVersionAvailable') }}: {{ updateStore.updateResult?.latestVer }}
              </span>
            </div>
            <button class="view-button" @click="viewUpdate">
              {{ t('settings.viewUpdate') }}
            </button>
          </div>
          
          <div v-if="updateStore.updateResult?.releaseNotes" class="release-notes">
            <div class="notes-title">{{ t('settings.releaseNotes') }}:</div>
            <ul class="notes-list" v-if="formatReleaseNotes(updateStore.updateResult.releaseNotes).length > 0">
              <li v-for="(note, index) in formatReleaseNotes(updateStore.updateResult.releaseNotes)" :key="index">
                {{ note }}
              </li>
            </ul>
            <div v-else class="notes-text">
              {{ updateStore.updateResult.releaseNotes }}
            </div>
          </div>
        </div>

        <!-- 已是最新版本 -->
        <div v-else-if="updateStore.updateResult && !updateStore.hasUpdate && !updateStore.errorMessage" 
             class="result-item success-result">
          <div class="result-text">
            <span class="result-icon">✅</span>
            <span class="result-message">{{ t('settings.upToDate') }}</span>
          </div>
        </div>
      </div>
    </SettingSection>
  </div>
</template>

<style scoped lang="scss">
.settings-page {
  max-width: 800px;
}

.check-button {
  padding: 8px 16px;
  background-color: var(--settings-input-bg);
  border: 1px solid var(--settings-input-border);
  border-radius: 4px;
  color: var(--settings-text);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;

  &:hover:not(:disabled) {
    background-color: var(--settings-hover);
    border-color: var(--settings-border);
  }

  &:active:not(:disabled) {
    transform: translateY(1px);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .loading-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: var(--settings-text);
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
}

.check-results {
  padding: 0 16px;
  margin-top: 16px;
}

.result-item {
  padding: 12px 0;
  
  .result-text {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    line-height: 1.4;
  }

  .result-icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  .result-message {
    flex: 1;
  }

  .result-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;

    .view-button {
      padding: 4px 12px;
      background-color: var(--settings-input-bg);
      border: 1px solid var(--settings-input-border);
      border-radius: 4px;
      color: var(--settings-text);
      cursor: pointer;
      font-size: 11px;
      transition: all 0.2s ease;
      flex-shrink: 0;

      &:hover {
        background-color: var(--settings-hover);
        border-color: var(--settings-border);
      }

      &:active {
        transform: translateY(1px);
      }
    }
  }

  .release-notes {
    margin-top: 8px;
    padding-left: 24px;

    .notes-title {
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 6px;
    }

    .notes-list {
      margin: 0;
      padding-left: 16px;
      
      li {
        font-size: 12px;
        color: var(--settings-text-secondary);
        line-height: 1.4;
        margin-bottom: 3px;

        &:last-child {
          margin-bottom: 0;
        }
      }
    }

    .notes-text {
      font-size: 12px;
      color: var(--settings-text-secondary);
      line-height: 1.4;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
  }
}

.error-result {
  .result-message {
    color: #f44336;
  }
  
  .result-icon {
    color: #f44336;
  }
}

.update-result {
  .result-message {
    color: #2196f3;
    font-weight: 500;
  }
  
  .result-icon {
    color: #2196f3;
  }
}

.success-result {
  .result-message {
    color: #4caf50;
  }
  
  .result-icon {
    color: #4caf50;
  }
}
</style> 