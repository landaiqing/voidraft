<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { ref } from 'vue';
import SettingSection from '../components/SettingSection.vue';
import SettingItem from '../components/SettingItem.vue';
import ToggleSwitch from '../components/ToggleSwitch.vue';

const { t } = useI18n();

// 模拟版本数据
const currentVersion = ref('1.0.0');
const isCheckingForUpdates = ref(false);
const updateAvailable = ref(false);
const latestVersion = ref('1.1.0');
const updateNotes = ref([
  '优化编辑器性能',
  '新增自动保存功能',
  '修复多个界面显示问题',
  '添加更多编辑器主题'
]);

// 自动检查更新选项
const autoCheckUpdates = ref(true);

// 模拟检查更新
const checkForUpdates = () => {
  isCheckingForUpdates.value = true;
  
  // 模拟网络请求延迟
  setTimeout(() => {
    isCheckingForUpdates.value = false;
    updateAvailable.value = true;
  }, 1500);
};

// 模拟下载更新
const downloadUpdate = () => {
  // 在实际应用中这里会调用后端API下载更新
  alert('开始下载更新...');
};
</script>

<template>
  <div class="settings-page">
    <SettingSection :title="t('settings.updates')">
      <div class="update-info">
        <div class="version-info">
          <div class="current-version">
            <span class="label">当前版本:</span>
            <span class="version">{{ currentVersion }}</span>
          </div>
          
          <button 
            class="check-button" 
            @click="checkForUpdates"
            :disabled="isCheckingForUpdates"
          >
            <span v-if="isCheckingForUpdates" class="loading-spinner"></span>
            {{ isCheckingForUpdates ? '检查中...' : '检查更新' }}
          </button>
        </div>
        
        <div v-if="updateAvailable" class="update-available">
          <div class="update-header">
            <div class="update-title">发现新版本: {{ latestVersion }}</div>
            <button class="download-button" @click="downloadUpdate">
              下载更新
            </button>
          </div>
          
          <div class="update-notes">
            <div class="notes-title">更新内容:</div>
            <ul class="notes-list">
              <li v-for="(note, index) in updateNotes" :key="index">
                {{ note }}
              </li>
            </ul>
          </div>
        </div>
      </div>
      
      <SettingItem title="自动检查更新" description="启动应用时自动检查更新">
        <ToggleSwitch v-model="autoCheckUpdates" />
      </SettingItem>
    </SettingSection>
  </div>
</template>

<style scoped lang="scss">
.settings-page {
  max-width: 800px;
}

.update-info {
  padding: 15px 16px;
  margin-bottom: 20px;
  
  .version-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
    
    .current-version {
      font-size: 14px;
      
      .label {
        color: #a0a0a0;
        margin-right: 5px;
      }
      
      .version {
        color: #e0e0e0;
        font-weight: 500;
      }
    }
    
    .check-button {
      padding: 8px 16px;
      background-color: #3a3a3a;
      border: 1px solid #555555;
      border-radius: 4px;
      color: #e0e0e0;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 8px;
      
      &:hover:not(:disabled) {
        background-color: #444444;
        border-color: #666666;
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
        border-top-color: #e0e0e0;
        animation: spin 1s linear infinite;
      }
      
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    }
  }
  
  .update-available {
    background-color: #2c3847;
    border: 1px solid #3a4a5c;
    border-radius: 6px;
    padding: 16px;
    
    .update-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      
      .update-title {
        font-size: 14px;
        font-weight: 500;
        color: #4a9eff;
      }
      
      .download-button {
        padding: 8px 16px;
        background-color: #2c5a9e;
        border: none;
        border-radius: 4px;
        color: #ffffff;
        cursor: pointer;
        font-size: 13px;
        transition: all 0.2s ease;
        
        &:hover {
          background-color: #3867a9;
        }
        
        &:active {
          transform: translateY(1px);
        }
      }
    }
    
    .update-notes {
      .notes-title {
        font-size: 13px;
        color: #b0b0b0;
        margin-bottom: 8px;
      }
      
      .notes-list {
        margin: 0;
        padding-left: 20px;
        
        li {
          font-size: 13px;
          color: #d0d0d0;
          margin-bottom: 6px;
          
          &:last-child {
            margin-bottom: 0;
          }
        }
      }
    }
  }
}
</style> 