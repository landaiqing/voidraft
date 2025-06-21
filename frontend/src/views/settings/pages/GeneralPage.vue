<script setup lang="ts">
import {useConfigStore} from '@/stores/configStore';
import {useI18n} from 'vue-i18n';
import {computed, onUnmounted, ref} from 'vue';
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

// 进度条显示控制
const showProgress = ref(false);
const progressError = ref('');
let hideProgressTimer: any = null;

// 开始轮询迁移进度
const startPolling = () => {
  if (isPolling.value) return;
  
  isPolling.value = true;
  showProgress.value = true;
  progressError.value = '';
  
  // 立即重置迁移进度状态，避免从之前的失败状态渐变
  migrationProgress.value = new MigrationProgress({
    status: MigrationStatus.MigrationStatusMigrating,
    progress: 0
  });
  
  pollingTimer = window.setInterval(async () => {
    try {
      const progress = await MigrationService.GetProgress();
      migrationProgress.value = progress;

      const { status, error } = progress;
      const isCompleted = [MigrationStatus.MigrationStatusCompleted, MigrationStatus.MigrationStatusFailed].includes(status);
      
      if (isCompleted) {
        stopPolling();
        
        // 设置错误信息（如果是失败状态）
        progressError.value = (status === MigrationStatus.MigrationStatusFailed) ? (error || 'Migration failed') : '';

        const delay = status === MigrationStatus.MigrationStatusCompleted ? 3000 : 5000;
        hideProgressTimer = setTimeout(hideProgress, delay);
      }
    } catch (error) {
      stopPolling();
      
      // 使用常量简化错误处理
      const errorMsg = 'Failed to get migration progress';
      Object.assign(migrationProgress.value, {
        status: MigrationStatus.MigrationStatusFailed,
        progress: 0,
        error: errorMsg
      });
      progressError.value = errorMsg;
      
      hideProgressTimer = setTimeout(hideProgress, 5000);
    }
  }, 200);
};

// 停止轮询
const stopPolling = () => {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
  isPolling.value = false;
};

// 隐藏进度条
const hideProgress = () => {
  showProgress.value = false;
  progressError.value = '';
  
  // 重置迁移状态，避免下次显示时状态不正确
  migrationProgress.value = new MigrationProgress({
    status: MigrationStatus.MigrationStatusCompleted,
    progress: 0
  });
  
  if (hideProgressTimer) {
    clearTimeout(hideProgressTimer);
    hideProgressTimer = null;
  }
};

// 简化的迁移状态管理
const isMigrating = computed(() => migrationProgress.value.status === MigrationStatus.MigrationStatusMigrating);

// 进度条样式 - 使用 Map 简化条件判断
const statusClassMap = new Map([
  [MigrationStatus.MigrationStatusMigrating, 'migrating'],
  [MigrationStatus.MigrationStatusCompleted, 'success'],
  [MigrationStatus.MigrationStatusFailed, 'error']
]);

const progressBarClass = computed(() => 
  showProgress.value ? statusClassMap.get(migrationProgress.value.status) ?? '' : ''
);

const progressBarWidth = computed(() => {
  if (!showProgress.value) return '0%';
  return isMigrating.value ? `${migrationProgress.value.progress}%` : '100%';
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

// 计算属性 - 开机启动
const startAtLogin = computed({
  get: () => configStore.config.general.startAtLogin,
  set: (value: boolean) => configStore.setStartAtLogin(value)
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

// 计算热键预览文本 - 使用现代语法简化
const hotkeyPreview = computed(() => {
  if (!enableGlobalHotkey.value) return '';
  
  const { ctrl, shift, alt, win, key } = configStore.config.general.globalHotkey;
  const modifiers = [
    ctrl && 'Ctrl',
    shift && 'Shift', 
    alt && 'Alt',
    win && 'Win',
    key
  ].filter(Boolean);
  
  return modifiers.join(' + ');
});

// 数据路径配置
const currentDataPath = computed(() => configStore.config.general.dataPath);

// 选择数据存储目录
const selectDataDirectory = async () => {
  if (isMigrating.value) return;
  
  try {
    const selectedPath = await DialogService.SelectDirectory();
    
    // 检查用户是否取消了选择或路径为空
    if (!selectedPath || !selectedPath.trim() || selectedPath === currentDataPath.value) {
      return;
    }
    const oldPath = currentDataPath.value;
    const newPath = selectedPath.trim();

    // 清除之前的进度状态
    hideProgress();
    
    // 开始轮询迁移进度
    startPolling();
    
    // 开始迁移
    try {
      await MigrationService.MigrateDirectory(oldPath, newPath);
      await configStore.setDataPath(newPath);
    } catch (error) {
      stopPolling();
      
      // 使用解构和默认值简化错误处理
      const errorMsg = error?.toString() || 'Migration failed';
      showProgress.value = true;
      
      Object.assign(migrationProgress.value, {
        status: MigrationStatus.MigrationStatusFailed,
        progress: 0,
        error: errorMsg
      });
      progressError.value = errorMsg;
      
      hideProgressTimer = setTimeout(hideProgress, 5000);
    }
  } catch (dialogError) {
    console.error(dialogError);
  }
};

// 清理定时器
onUnmounted(() => {
  stopPolling();
  hideProgress();
  if (resetConfirmTimer) {
    clearTimeout(resetConfirmTimer);
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
    
    <SettingSection :title="t('settings.startup')">
      <SettingItem :title="t('settings.startAtLogin')">
        <ToggleSwitch v-model="startAtLogin"/>
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
            <!-- 简洁的进度条 -->
            <div 
              class="progress-bar" 
              :class="[
                { 'active': showProgress },
                progressBarClass
              ]"
              :style="{ width: progressBarWidth }"
            ></div>
          </div>
          
          <!-- 错误提示 -->
          <Transition name="error-fade">
            <div v-if="progressError" class="progress-error">
              {{ progressError }}
            </div>
          </Transition>
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
      height: 3px;
      background-color: transparent;
      border-radius: 0 0 4px 4px;
      transition: width 0.4s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.3s ease;
      width: 0;
      opacity: 0;
      z-index: 1;
      
      &.active {
        opacity: 1;
        
        &.migrating {
          background: linear-gradient(90deg, #22c55e, #16a34a);
          animation: progress-pulse 2s ease-in-out infinite;
          transition: width 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
        }

        &.success {
          background-color: #22c55e;
          animation: none;
          transition: width 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
        }

        &.error {
          background-color: #ef4444;
          animation: none;
          transition: width 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
        }
      }
    }
  }

  .progress-error {
    margin-top: 6px;
    font-size: 12px;
    color: #ef4444;
    padding: 0 2px;
    line-height: 1.4;
    opacity: 1;
    transition: all 0.3s ease;
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

// 进度条脉冲动画
@keyframes progress-pulse {
  0%, 100% {
    opacity: 0.8;
    transform: scaleY(1);
  }
  50% {
    opacity: 1;
    transform: scaleY(1.1);
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

// 错误提示动画
.error-fade-enter-active {
  transition: all 0.3s ease;
}

.error-fade-leave-active {
  transition: all 0.3s ease;
}

.error-fade-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}

.error-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style> 