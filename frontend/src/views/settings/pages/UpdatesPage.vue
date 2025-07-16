<script setup lang="ts">
import {useI18n} from 'vue-i18n';
import {computed, onMounted, ref} from 'vue';
import {useConfigStore} from '@/stores/configStore';
import {useUpdateStore} from '@/stores/updateStore';
import SettingSection from '../components/SettingSection.vue';
import SettingItem from '../components/SettingItem.vue';
import ToggleSwitch from '../components/ToggleSwitch.vue';
import { Remarkable } from 'remarkable';

const {t} = useI18n();
const configStore = useConfigStore();
const updateStore = useUpdateStore();

// 初始化Remarkable实例并配置
const md = new Remarkable({
  html: true,       // 允许HTML
  xhtmlOut: false,  // 不使用'/'闭合单标签
  breaks: true,     // 将'\n'转换为<br>
  typographer: true // 启用排版增强
});

// 计算属性
const autoCheckUpdates = computed({
  get: () => configStore.config.updates.autoUpdate,
  set: async (value: boolean) => {
    await configStore.setAutoUpdate(value);
  }
});

// 使用Remarkable解析Markdown
const parseMarkdown = (markdown: string) => {
  if (!markdown) return '';
  return md.render(markdown);
};

// 处理更新按钮点击
const handleUpdateButtonClick = async () => {
  if (updateStore.updateSuccess) {
    // 如果更新成功，点击按钮重启应用
    await updateStore.restartApplication();
  } else if (updateStore.hasUpdate) {
    // 如果有更新，点击按钮应用更新
    await updateStore.applyUpdate();
  } else {
    // 否则检查更新
    await updateStore.checkForUpdates();
  }
};

// 当前版本号
const currentVersion = computed(() => {
  return updateStore.updateResult?.currentVersion || configStore.config.updates.version;
});
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
        :title="`${t('settings.currentVersion')}: ${currentVersion}`"
      >
        <button
            class="check-button"
            :class="{ 
              'update-available-button': updateStore.hasUpdate && !updateStore.updateSuccess,
              'update-success-button': updateStore.updateSuccess
            }"
            @click="handleUpdateButtonClick"
            :disabled="updateStore.isChecking || updateStore.isUpdating"
        >
          <span v-if="updateStore.isChecking || updateStore.isUpdating" class="loading-spinner"></span>
          {{ updateStore.isChecking 
            ? t('settings.checking')
            : (updateStore.isUpdating 
              ? t('settings.updating') 
              : (updateStore.updateSuccess 
                ? t('settings.restartNow') 
                : (updateStore.hasUpdate ? t('settings.updateNow') : t('settings.checkForUpdates'))))
          }}
        </button>
      </SettingItem>

      <!-- 检查结果 -->
      <div class="check-results" v-if="updateStore.updateResult || updateStore.errorMessage">
        <!-- 错误信息 -->
        <div v-if="updateStore.errorMessage" class="result-item error-result">
          <div class="result-text">
            <span class="result-icon">⚠️</span>
            <div class="result-message">{{ updateStore.errorMessage }}</div>
          </div>
        </div>

        <!-- 更新成功 -->
        <div v-else-if="updateStore.updateSuccess" class="result-item update-success">
          <div class="result-text">
            <span class="result-icon">✅</span>
            <span class="result-message">
              {{ t('settings.updateSuccessRestartRequired') }}
            </span>
          </div>
        </div>

        <!-- 有新版本 -->
        <div v-else-if="updateStore.hasUpdate" class="result-item update-result">
          <div class="result-text">
            <span class="result-icon">🎉</span>
            <span class="result-message">
              {{ t('settings.newVersionAvailable') }}: {{ updateStore.updateResult?.latestVersion }}
            </span>
          </div>
          
          <div v-if="updateStore.updateResult?.releaseNotes" class="release-notes">
            <div class="notes-title">{{ t('settings.releaseNotes') }}:</div>
            <div class="markdown-content" v-html="parseMarkdown(updateStore.updateResult.releaseNotes)"></div>
          </div>
        </div>

        <!-- 已是最新版本 -->
        <div v-else-if="updateStore.updateResult && !updateStore.hasUpdate && !updateStore.errorMessage" 
             class="result-item latest-version">
          <div class="result-text">
            <span class="result-icon">✓</span>
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
  width: 100%; // 确保在小屏幕上也能占满可用空间
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
  min-width: 120px;
  justify-content: center;

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

  &.update-available-button {
    background-color: #2196f3;
    border-color: #2196f3;
    color: white;
    
    &:hover {
      background-color: #1976d2;
      border-color: #1976d2;
    }
  }

  &.update-success-button {
    background-color: #4caf50;
    border-color: #4caf50;
    color: white;
    
    &:hover {
      background-color: #43a047;
      border-color: #43a047;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
}

.check-results {
  margin-top: 16px;
  width: 100%;
  
  // 为错误消息添加特殊样式
  .error-result {
    padding: 12px;
    background-color: rgba(255, 82, 82, 0.05);
    border-radius: 4px;
    border-left: 3px solid var(--error-text, #ff5252);
    margin-bottom: 8px;
    
    .result-message {
      color: var(--error-text, #ff5252);
      max-width: 100%;
      overflow: visible;
      padding-right: 8px; // 添加右侧内边距，防止文本贴近容器边缘
    }
  }
}

.result-item {
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 8px;
  
  .result-text {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    line-height: 1.5; // 增加行高，提高可读性
  }

  .result-icon {
    font-size: 16px;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .result-message {
    flex: 1;
    word-break: break-word;
    white-space: normal;
    overflow-wrap: break-word;
  }

  .release-notes {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--settings-border, rgba(0,0,0,0.1));
    background: transparent;

    .notes-title {
      font-size: 12px;
      font-weight: 500;
      color: var(--settings-text);
      margin-bottom: 8px;
    }

    .markdown-content {
      font-size: 12px;
      color: var(--settings-text);
      line-height: 1.4;
      background: transparent;
      
      /* Markdown内容样式 */
      :deep(p) {
        margin: 0 0 6px 0;
        background: transparent;
      }
      
      :deep(ul), :deep(ol) {
        margin: 6px 0;
        padding-left: 16px;
        background: transparent;
      }
      
      :deep(li) {
        margin-bottom: 4px;
        background: transparent;
      }
      
      :deep(h1), :deep(h2), :deep(h3), :deep(h4), :deep(h5), :deep(h6) {
        margin: 10px 0 6px 0;
        font-size: 13px;
        background: transparent;
      }

      :deep(pre), :deep(code) {
        background-color: var(--settings-code-bg, rgba(0,0,0,0.05));
        border-radius: 3px;
        padding: 2px 4px;
        font-family: monospace;
      }

      :deep(pre) {
        padding: 8px;
        overflow-x: auto;
        margin: 6px 0;
      }

      :deep(blockquote) {
        border-left: 3px solid var(--settings-border, rgba(0,0,0,0.1));
        margin: 6px 0;
        padding-left: 10px;
        color: var(--settings-text-secondary, #757575);
        background: transparent;
      }

      :deep(a) {
        color: var(--theme-primary, #2196f3);
        text-decoration: none;
        
        &:hover {
          text-decoration: underline;
        }
      }

      :deep(table) {
        border-collapse: collapse;
        width: 100%;
        margin: 6px 0;
        background: transparent;
      }

      :deep(th), :deep(td) {
        border: 1px solid var(--settings-border, rgba(0,0,0,0.1));
        padding: 4px 8px;
        background: transparent;
      }

      :deep(th) {
        background-color: var(--settings-table-header-bg, rgba(0,0,0,0.02));
      }
    }
  }
}

.error-result {
  background-color: rgba(244, 67, 54, 0.03);
  
  .result-icon {
    color: #f44336;
  }
  
  .result-message {
    color: var(--error-text, #ff5252);
  }
}

.update-result {
  background-color: rgba(33, 150, 243, 0.03);
  
  .result-icon {
    color: #2196f3;
  }
  
  .result-message {
    color: #2196f3;
    font-weight: 500;
  }
}

.update-success {
  background-color: rgba(76, 175, 80, 0.03);
  
  .result-icon {
    color: #4caf50;
  }
  
  .result-message {
    color: var(--settings-text);
  }
}

.latest-version {
  background-color: transparent;
  border-left: 3px solid #9e9e9e;
  padding-left: 10px;
  
  .result-icon {
    color: #9e9e9e;
  }
  
  .result-message {
    color: var(--settings-text-secondary, #757575);
    font-weight: normal;
  }
}

// 响应式布局调整
@media (max-width: 600px) {
  .result-item {
    padding: 10px;
    
    .result-text {
      font-size: 12px; // 小屏幕上稍微减小字体
    }
  }
  
  .check-button {
    min-width: 100px;
    padding: 6px 12px;
  }
}
</style> 