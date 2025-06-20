<script setup lang="ts">
import {useConfigStore} from '@/stores/configStore';
import {useI18n} from 'vue-i18n';
import {computed, onUnmounted, ref, watch} from 'vue';
import SettingSection from '../components/SettingSection.vue';
import SettingItem from '../components/SettingItem.vue';
import ToggleSwitch from '../components/ToggleSwitch.vue';
import {useErrorHandler} from '@/utils/errorHandler';
import {DialogService, MigrationService, MigrationProgress, MigrationStatus} from '@/../bindings/voidraft/internal/services';
import * as runtime from '@wailsio/runtime';

const {t} = useI18n();
const configStore = useConfigStore();
const {safeCall} = useErrorHandler();

// 迁移进度状态
const migrationProgress = ref<MigrationProgress>(new MigrationProgress({
  status: MigrationStatus.MigrationStatusCompleted,
  progress: 0
}));

// 轮询相关
let pollingTimer: number | null = null;
const isPolling = ref(false);

// 开始轮询迁移进度
const startPolling = () => {
  if (isPolling.value) return;
  
  isPolling.value = true;
  pollingTimer = window.setInterval(async () => {
    try {
      const progress = await MigrationService.GetProgress();
      migrationProgress.value = progress;
      
      // 如果迁移完成或失败，停止轮询
      if (progress.status === MigrationStatus.MigrationStatusCompleted || progress.status === MigrationStatus.MigrationStatusFailed) {
        stopPolling();
      }
    } catch (error) {
      stopPolling();
    }
  }, 500); // 每500ms轮询一次
};

// 停止轮询
const stopPolling = () => {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
  isPolling.value = false;
};

// 迁移消息链
interface MigrationMessage {
  id: number;
  content: string;
  type: 'start' | 'progress' | 'success' | 'error';
  timestamp: number;
}

const migrationMessages = ref<MigrationMessage[]>([]);
const showMessages = ref(false);
let messageIdCounter = 0;
let hideMessagesTimer: any = null;

// 添加迁移消息
const addMigrationMessage = (content: string, type: MigrationMessage['type']) => {
  const message: MigrationMessage = {
    id: ++messageIdCounter,
    content,
    type,
    timestamp: Date.now()
  };
  
  migrationMessages.value.push(message);
  showMessages.value = true;
};

// 清除所有消息
const clearMigrationMessages = () => {
  migrationMessages.value = [];
  showMessages.value = false;
};

// 监听迁移进度变化
watch(() => migrationProgress.value, (progress, oldProgress) => {
  // 清除之前的隐藏定时器
  if (hideMessagesTimer) {
    clearTimeout(hideMessagesTimer);
    hideMessagesTimer = null;
  }
  
  if (progress.status === MigrationStatus.MigrationStatusMigrating) {
    // 如果是第一次收到迁移状态，添加开始消息
    if (migrationMessages.value.length === 0) {
      addMigrationMessage(t('migration.started'), 'start');
    }
    // 如果还没有迁移中消息，添加迁移中消息
    if (!migrationMessages.value.some(msg => msg.type === 'progress' && msg.content === t('migration.migrating'))) {
      addMigrationMessage(t('migration.migrating'), 'progress');
    }
  } else if (progress.status === MigrationStatus.MigrationStatusCompleted && oldProgress?.status === MigrationStatus.MigrationStatusMigrating) {
    addMigrationMessage(t('migration.completed'), 'success');
    
    // 5秒后开始逐个隐藏消息
    hideMessagesTimer = setTimeout(() => {
      hideMessagesSequentially();
    }, 5000);
    
  } else if (progress.status === MigrationStatus.MigrationStatusFailed && oldProgress?.status === MigrationStatus.MigrationStatusMigrating) {
    const errorMsg = progress.error || t('migration.failed');
    addMigrationMessage(errorMsg, 'error');
    
    // 8秒后开始逐个隐藏消息
    hideMessagesTimer = setTimeout(() => {
      hideMessagesSequentially();
    }, 8000);
  }
}, { deep: true });

// 逐个隐藏消息
const hideMessagesSequentially = () => {
  const hideNextMessage = () => {
    if (migrationMessages.value.length > 0) {
      migrationMessages.value.shift(); // 移除第一条消息
      
      if (migrationMessages.value.length > 0) {
        // 如果还有消息，1秒后隐藏下一条
        setTimeout(hideNextMessage, 1000);
      } else {
        // 所有消息都隐藏完了，同时隐藏进度条
        showMessages.value = false;
      }
    }
  };
  
  hideNextMessage();
};

// 迁移状态
const isMigrating = computed(() => migrationProgress.value.status === MigrationStatus.MigrationStatusMigrating);
const migrationComplete = computed(() => migrationProgress.value.status === MigrationStatus.MigrationStatusCompleted);
const migrationFailed = computed(() => migrationProgress.value.status === MigrationStatus.MigrationStatusFailed);

// 进度条样式和宽度
const progressBarClass = computed(() => {
  switch (migrationProgress.value.status) {
    case MigrationStatus.MigrationStatusMigrating:
      return 'migrating';
    case MigrationStatus.MigrationStatusCompleted:
      return 'success';
    case MigrationStatus.MigrationStatusFailed:
      return 'error';
    default:
      return '';
  }
});

const progressBarWidth = computed(() => {
  // 只有在显示消息且正在迁移时才显示进度条
  if (showMessages.value && isMigrating.value) {
    return migrationProgress.value.progress + '%';
  } else if (showMessages.value && (migrationComplete.value || migrationFailed.value)) {
    // 迁移完成或失败时，短暂显示100%，然后随着消息隐藏而隐藏
    return '100%';
  }
  return '0%';
});

// 重置确认状态
const resetConfirmState = ref<'idle' | 'confirming'>('idle');
let resetConfirmTimer: any = null;

// 可选键列表
const keyOptions = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
];

// 计算属性 - 启用全局热键
const enableGlobalHotkey = computed({
  get: () => configStore.config.general.enableGlobalHotkey,
  set: (value: boolean) => configStore.setEnableGlobalHotkey(value)
});

// 计算属性 - 窗口始终置顶
const alwaysOnTop = computed({
  get: () => configStore.config.general.alwaysOnTop,
  set: async (value: boolean) => {
    await safeCall(async () => {
      // 先更新配置
      await configStore.setAlwaysOnTop(value);
      // 然后立即应用窗口置顶状态
      await runtime.Window.SetAlwaysOnTop(value);
    }, 'config.alwaysOnTopFailed', 'config.alwaysOnTopSuccess');
  }
});

// 计算属性 - 启用系统托盘
const enableSystemTray = computed({
  get: () => configStore.config.general.enableSystemTray,
  set: (value: boolean) => configStore.setEnableSystemTray(value)
});

// 修饰键配置 - 只读计算属性
const modifierKeys = computed(() => ({
  ctrl: configStore.config.general.globalHotkey.ctrl,
  shift: configStore.config.general.globalHotkey.shift,
  alt: configStore.config.general.globalHotkey.alt,
  win: configStore.config.general.globalHotkey.win
}));

// 主键配置 - 只读计算属性
const selectedKey = computed(() => configStore.config.general.globalHotkey.key);

// 切换修饰键
const toggleModifier = (key: 'ctrl' | 'shift' | 'alt' | 'win') => {
  const currentHotkey = configStore.config.general.globalHotkey;
  const newHotkey = {...currentHotkey, [key]: !currentHotkey[key]};
  configStore.setGlobalHotkey(newHotkey);
};

// 更新选择的键
const updateSelectedKey = (event: Event) => {
  const select = event.target as HTMLSelectElement;
  const newHotkey = {...configStore.config.general.globalHotkey, key: select.value};
  configStore.setGlobalHotkey(newHotkey);
};

// 重置设置
const resetSettings = () => {
  if (resetConfirmState.value === 'idle') {
    // 第一次点击，进入确认状态
    resetConfirmState.value = 'confirming';
    // 3秒后自动返回idle状态
    resetConfirmTimer = setTimeout(() => {
      resetConfirmState.value = 'idle';
    }, 3000);
  } else if (resetConfirmState.value === 'confirming') {
    // 第二次点击，执行重置
    clearTimeout(resetConfirmTimer);
    resetConfirmState.value = 'idle';
    confirmReset();
  }
};

// 确认重置
const confirmReset = async () => {
  await configStore.resetConfig();
};

// 计算热键预览文本
const hotkeyPreview = computed(() => {
  if (!enableGlobalHotkey.value) return '';
  
  const hotkey = configStore.config.general.globalHotkey;
  const parts: string[] = [];
  if (hotkey.ctrl) parts.push('Ctrl');
  if (hotkey.shift) parts.push('Shift');
  if (hotkey.alt) parts.push('Alt');
  if (hotkey.win) parts.push('Win');
  if (hotkey.key) parts.push(hotkey.key);
  
  return parts.join(' + ');
});

// 数据路径配置
const currentDataPath = computed(() => configStore.config.general.dataPath);

// 选择数据存储目录
const selectDataDirectory = async () => {
  if (isMigrating.value) return;
  
  const selectedPath = await DialogService.SelectDirectory();
  
  if (selectedPath && selectedPath.trim() && selectedPath !== currentDataPath.value) {
    // 清除之前的消息
    clearMigrationMessages();
    
    // 开始轮询迁移进度
    startPolling();
    
    // 开始迁移
    try {
      await safeCall(async () => {
        const oldPath = currentDataPath.value;
        const newPath = selectedPath.trim();
        
        await MigrationService.MigrateDirectory(oldPath, newPath);
        await configStore.setDataPath(newPath);
      }, '');
    } catch (error) {
      // 发生错误时清除消息并停止轮询
      clearMigrationMessages();
      stopPolling();
    }
  }
};

// 清理定时器
onUnmounted(() => {
  stopPolling();
  if (resetConfirmTimer) {
    clearTimeout(resetConfirmTimer);
  }
  if (hideMessagesTimer) {
    clearTimeout(hideMessagesTimer);
  }
});
</script>

<template>
  <div class="settings-page">
    <SettingSection :title="t('settings.globalHotkey')">
      <SettingItem :title="t('settings.enableGlobalHotkey')">
        <ToggleSwitch v-model="enableGlobalHotkey"/>
      </SettingItem>
      
      <div class="hotkey-selector" :class="{ 'disabled': !enableGlobalHotkey }">
        <div class="hotkey-controls">
          <div class="hotkey-modifiers">
            <label class="modifier-label" :class="{ active: modifierKeys.ctrl }" @click="toggleModifier('ctrl')">
              <input type="checkbox" :checked="modifierKeys.ctrl" class="hidden-checkbox" :disabled="!enableGlobalHotkey">
              <span class="modifier-key">Ctrl</span>
            </label>
            <label class="modifier-label" :class="{ active: modifierKeys.shift }" @click="toggleModifier('shift')">
              <input type="checkbox" :checked="modifierKeys.shift" class="hidden-checkbox"
                     :disabled="!enableGlobalHotkey">
              <span class="modifier-key">Shift</span>
            </label>
            <label class="modifier-label" :class="{ active: modifierKeys.alt }" @click="toggleModifier('alt')">
              <input type="checkbox" :checked="modifierKeys.alt" class="hidden-checkbox" :disabled="!enableGlobalHotkey">
              <span class="modifier-key">Alt</span>
            </label>
            <label class="modifier-label" :class="{ active: modifierKeys.win }" @click="toggleModifier('win')">
              <input type="checkbox" :checked="modifierKeys.win" class="hidden-checkbox" :disabled="!enableGlobalHotkey">
              <span class="modifier-key">Win</span>
            </label>
          </div>
          
          <select class="key-select" :value="selectedKey" @change="updateSelectedKey" :disabled="!enableGlobalHotkey">
            <option v-for="key in keyOptions" :key="key" :value="key">{{ key }}</option>
          </select>
        </div>
        
        <div class="hotkey-preview">
          <span class="preview-label">预览：</span>
          <span class="preview-hotkey">{{ hotkeyPreview || '无' }}</span>
        </div>
      </div>
    </SettingSection>
    
    <SettingSection :title="t('settings.window')">
      <SettingItem :title="t('settings.alwaysOnTop')">
        <ToggleSwitch v-model="alwaysOnTop"/>
      </SettingItem>
      <SettingItem :title="t('settings.enableSystemTray')">
        <ToggleSwitch v-model="enableSystemTray"/>
      </SettingItem>
    </SettingSection>
    
    <SettingSection :title="t('settings.dataStorage')">
      <div class="data-path-setting">
        <div class="setting-header">
          <div class="setting-title">{{ t('settings.dataPath') }}</div>
        </div>
        <div class="data-path-controls">
          <div class="path-input-container">
            <input 
              type="text" 
              :value="currentDataPath"
              readonly
              :placeholder="t('settings.clickToSelectPath')"
              class="path-display-input"
              @click="selectDataDirectory"
              :title="t('settings.clickToSelectPath')"
              :disabled="isMigrating"
            />
            <div 
              class="progress-bar" 
              :class="[
                { 'active': showMessages && (isMigrating || migrationComplete || migrationFailed) },
                progressBarClass
              ]"
              :style="{ width: progressBarWidth }"
            ></div>
          </div>
          <div class="migration-status-container">
            <Transition name="fade-slide" mode="out-in">
              <div v-if="showMessages" class="migration-messages">
                <TransitionGroup name="message-list" tag="div">
                  <div v-for="message in migrationMessages" :key="message.id" class="migration-message" :class="message.type">
                    {{ message.content }}
                  </div>
                </TransitionGroup>
              </div>
            </Transition>

          </div>
        </div>
      </div>
    </SettingSection>
    
    <SettingSection :title="t('settings.dangerZone')">
      <SettingItem :title="t('settings.resetAllSettings')">
        <button 
          class="reset-button" 
          :class="{ 'confirming': resetConfirmState === 'confirming' }"
          @click="resetSettings"
        >
          <template v-if="resetConfirmState === 'idle'">
            {{ t('settings.reset') }}
          </template>
          <template v-else-if="resetConfirmState === 'confirming'">
            {{ t('settings.confirmReset') }}
          </template>
        </button>
      </SettingItem>
    </SettingSection>
  </div>


</template>

<style scoped lang="scss">
.settings-page {
  max-width: 800px;
  padding-bottom: 48px;
}

.hotkey-selector {
  padding: 15px 0 5px 20px;
  transition: all 0.3s ease;
  
  &.disabled {
    opacity: 0.5;
    pointer-events: none;
  }
  
  .hotkey-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }
  
  .hotkey-modifiers {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    
    .modifier-label {
      cursor: pointer;
      
      &.disabled {
        cursor: not-allowed;
      }
      
      .hidden-checkbox {
        display: none;
      }
      
      .modifier-key {
        display: inline-block;
        padding: 6px 12px;
        background-color: var(--settings-input-bg);
        border: 1px solid var(--settings-input-border);
        border-radius: 4px;
        color: var(--settings-text-secondary);
        font-size: 12px;
        transition: all 0.2s ease;
        
        &:hover {
          background-color: var(--settings-hover);
        }
      }
      
      &.active .modifier-key {
        background-color: #2c5a9e;
        color: #ffffff;
        border-color: #3a6db1;
      }
    }
  }
  
  .key-select {
    min-width: 80px;
    padding: 8px 12px;
    background-color: var(--settings-input-bg);
    border: 1px solid var(--settings-input-border);
      border-radius: 4px;
  color: var(--settings-text);
  font-size: 12px;
  appearance: none;
    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23999999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
    background-repeat: no-repeat;
    background-position: right 8px center;
    background-size: 16px;
    padding-right: 30px;
    
    &:focus {
      outline: none;
      border-color: #4a9eff;
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      background-color: var(--settings-hover);
    }
    
    option {
      background-color: var(--settings-input-bg);
      color: var(--settings-text);
    }
  }
  
  .hotkey-preview {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background-color: var(--settings-card-bg);
    border: 1px solid var(--settings-border);
    border-radius: 4px;
    margin-top: 8px;
    
      .preview-label {
    font-size: 11px;
    color: var(--settings-text-secondary);
  }
  
  .preview-hotkey {
    font-size: 12px;
    color: var(--settings-text);
    font-weight: 500;
    font-family: 'Consolas', 'Courier New', monospace;
  }
  }
}

.data-path-setting {
  padding: 14px 0;
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.03);
  }
  
  .setting-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    
    .setting-title {
      font-size: 13px;
      font-weight: 500;
      color: var(--settings-text);
    }
  }
}

.data-path-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
  
  .path-input-container {
    position: relative;
    width: 100%;
    max-width: 450px;
    
    .path-display-input {
      width: 100%;
      box-sizing: border-box;
      padding: 10px 12px;
      background-color: var(--settings-input-bg);
      border: 1px solid var(--settings-input-border);
      border-radius: 4px;
      color: var(--settings-text);
      font-size: 12px;
      line-height: 1.2;
      transition: all 0.2s ease;
      cursor: pointer;
      
      &:hover:not(:disabled) {
        border-color: var(--settings-hover);
        background-color: var(--settings-hover);
      }
      
      &:focus {
        outline: none;
        border-color: #4a9eff;
      }
      
      &:disabled {
        cursor: not-allowed;
        opacity: 0.7;
      }
      
      &::placeholder {
        color: var(--text-muted);
      }
    }
    
    .progress-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 2px;
      background-color: transparent;
      border-radius: 0 0 4px 4px;
      transition: all 0.3s ease;
      width: 0;
      opacity: 0;
      
      &.active {
        opacity: 1;
        
        &.migrating {
          background-color: #3b82f6;
          animation: progress-wave 2s infinite;
        }

        &.success {
          background-color: #22c55e;
        }

        &.error {
          background-color: #ef4444;
        }
      }
    }
  }

      .migration-status-container {
    margin-top: 8px;
    min-height: 0;
    overflow: hidden;
    transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
  
    .migration-messages {
    margin-bottom: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  
  .migration-message {
    font-size: 11px;
    padding: 2px 0;
    display: flex;
    align-items: center;
    gap: 6px;
    transform: translateY(0);
    opacity: 1;
    transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
    
    &::before {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }
      
    &.start {
      color: var(--text-muted);
      
      &::before {
        background-color: var(--text-muted);
      }
    }
      
    &.progress {
      color: #3b82f6;
      
      &::before {
        background-color: #3b82f6;
        animation: pulse-dot 1.5s infinite;
      }
    }
      
    &.success {
      color: #22c55e;
      
      &::before {
        background-color: #22c55e;
      }
    }
      
    &.error {
      color: #ef4444;
      
      &::before {
        background-color: #ef4444;
      }
    }
              
    &.v-enter-from, &.v-leave-to {
      opacity: 0;
      transform: translateY(-8px);
    }
  }
  

    
    &:empty {
      min-height: 0;
      margin-top: 0;
    }
  }
}

.reset-button {
  padding: 8px 16px;
  background-color: #dc3545;
  border: 1px solid #dc3545;
  border-radius: 4px;
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 80px;
  
  &:hover {
    background-color: #c82333;
    border-color: #bd2130;
  }
  
  &:active {
    transform: translateY(1px);
  }
  
  &.confirming {
    background-color: #ff4757;
    border-color: #ff4757;
    animation: pulse-button 1.5s infinite;
    
    &:hover {
      background-color: #ff3838;
      border-color: #ff3838;
    }
  }
}

// 进度条波浪动画
@keyframes progress-wave {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

// 按钮脉冲动画
@keyframes pulse-button {
  0% {
    box-shadow: 0 0 0 0 rgba(255, 71, 87, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(255, 71, 87, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(255, 71, 87, 0);
  }
}

// 消息点脉冲动画
@keyframes pulse-dot {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
}

// Vue Transition 动画
.fade-slide-enter-active {
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.fade-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.6, 1);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(-8px);
  max-height: 0;
  margin-top: 0;
  margin-bottom: 0;
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-5px);
  max-height: 0;
  margin-top: 0;
  margin-bottom: 0;
}

.fade-slide-enter-to,
.fade-slide-leave-from {
  opacity: 1;
  transform: translateY(0);
  max-height: 150px;
}

// 消息列表动画
.message-list-enter-active {
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.message-list-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.6, 1);
}

.message-list-enter-from {
  opacity: 0;
  transform: translateX(-16px);
}

.message-list-leave-to {
  opacity: 0;
  transform: translateX(16px);
}

.message-list-move {
  transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}
</style> 