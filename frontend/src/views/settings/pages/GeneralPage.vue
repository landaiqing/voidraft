<script setup lang="ts">
import {useConfigStore} from '@/stores/configStore';
import {useTabStore} from '@/stores/tabStore';
import {useI18n} from 'vue-i18n';
import {computed, ref, onMounted} from 'vue';
import SettingSection from '../components/SettingSection.vue';
import SettingItem from '../components/SettingItem.vue';
import ToggleSwitch from '../components/ToggleSwitch.vue';
import {DialogService, HotkeyService, MigrationService} from '@/../bindings/voidraft/internal/services';
import {useSystemStore} from "@/stores/systemStore";
import {useConfirm, usePolling} from '@/composables';
import toast from '@/components/toast';

const {t} = useI18n();
const {
  config: {general},
  resetConfig,
  setAlwaysOnTop,
  setDataPath,
  setEnableGlobalHotkey,
  setEnableLoadingAnimation,
  setEnableMemoryMonitor,
  setEnableSystemTray,
  setEnableTabs,
  setEnableWindowSnap,
  setGlobalHotkey,
  setStartAtLogin
} = useConfigStore();
const systemStore = useSystemStore();
const tabStore = useTabStore();

// 进度条显示控制
const showBar = ref(false);
let hideTimer = 0;

// 轮询迁移进度
const {data: progress, error: pollError, isActive: migrating, start, stop, reset} = usePolling(
    () => MigrationService.GetProgress(),
    {
      interval: 300,
      shouldStop: ({progress, error}) => !!error || progress >= 100,
      onStop: () => {
        const error = pollError.value || progress.value?.error;
        if (error) {
          toast.error(error);
        } else if ((progress.value?.progress ?? 0) >= 100) {
          toast.success('Migration successful');
        }
        hideTimer = window.setTimeout(hideAll, 3000);
      }
    }
);

// 派生状态
const currentProgress = computed(() => progress.value?.progress ?? 0);
const migrationError = computed(() => pollError.value || progress.value?.error || '');

const barClass = computed(() => {
  if (!showBar.value) return '';
  return migrationError.value ? 'error' : currentProgress.value >= 100 ? 'success' : 'migrating';
});

const barWidth = computed(() => {
  if (!showBar.value) return '0%';
  return (migrationError.value || currentProgress.value >= 100) ? '100%' : `${currentProgress.value}%`;
});

// 隐藏进度条并清除所有状态
const hideAll = () => {
  clearTimeout(hideTimer);
  hideTimer = 0;
  showBar.value = false;
  reset();
};

// 重置设置确认
const {isConfirming: isResetConfirming, requestConfirm: requestResetConfirm} = useConfirm({
  timeout: 3000,
  onConfirm: async () => {
    await resetConfig();
  }
});

// 可选键列表 - 从后端获取系统支持的快捷键
const keyOptions = ref<string[]>([]);

// 初始化时从后端获取支持的键列表
onMounted(async () => {
  keyOptions.value = await HotkeyService.GetSupportedKeys();
});

// 计算属性 - 启用全局热键
const enableGlobalHotkey = computed({
  get: () => general.enableGlobalHotkey,
  set: (value: boolean) => setEnableGlobalHotkey(value)
});

// 计算属性 - 窗口始终置顶
const alwaysOnTop = computed({
  get: () => general.alwaysOnTop,
  set: async (value: boolean) => {
    // 先更新配置
    await setAlwaysOnTop(value);
    await systemStore.setWindowOnTop(value);
  }
});

// 计算属性 - 启用系统托盘
const enableSystemTray = computed({
  get: () => general.enableSystemTray,
  set: (value: boolean) => setEnableSystemTray(value)
});

// 计算属性 - 启用窗口吸附
const enableWindowSnap = computed({
  get: () => general.enableWindowSnap,
  set: (value: boolean) => setEnableWindowSnap(value)
});

// 计算属性 - 启用加载动画
const enableLoadingAnimation = computed({
  get: () => general.enableLoadingAnimation,
  set: (value: boolean) => setEnableLoadingAnimation(value)
});

// 计算属性 - 启用标签页
const enableTabs = computed({
  get: () => general.enableTabs,
  set: async (value: boolean) => {
    await setEnableTabs(value);
    if (value) {
      // 开启tabs功能时，初始化当前文档到标签页
      tabStore.initTab();
    } else {
      // 关闭tabs功能时，清空所有标签页
      tabStore.clearAllTabs();
    }
  }
});

// 计算属性 - 启用内存监视器
const enableMemoryMonitor = computed({
  get: () => general.enableMemoryMonitor,
  set: (value: boolean) => setEnableMemoryMonitor(value)
});

// 计算属性 - 开机启动
const startAtLogin = computed({
  get: () => general.startAtLogin,
  set: (value: boolean) => setStartAtLogin(value)
});

// 修饰键配置 - 只读计算属性
const modifierKeys = computed(() => ({
  ctrl: general.globalHotkey.ctrl,
  shift: general.globalHotkey.shift,
  alt: general.globalHotkey.alt,
  win: general.globalHotkey.win
}));

// 主键配置
const selectedKey = computed(() => general.globalHotkey.key);

// 切换修饰键
const toggleModifier = (key: 'ctrl' | 'shift' | 'alt' | 'win') => {
  const currentHotkey = general.globalHotkey;
  const newHotkey = {...currentHotkey, [key]: !currentHotkey[key]};
  setGlobalHotkey(newHotkey);
};

// 更新选择的键
const updateSelectedKey = (event: Event) => {
  const select = event.target as HTMLSelectElement;
  const newHotkey = {...general.globalHotkey, key: select.value};
  setGlobalHotkey(newHotkey);
};


// 计算热键预览文本
const hotkeyPreview = computed(() => {
  if (!enableGlobalHotkey.value) return '';

  const {ctrl, shift, alt, win, key} = general.globalHotkey;
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
const currentDataPath = computed(() => general.dataPath);

// 选择数据存储目录
const selectDataDirectory = async () => {
  if (migrating.value) return;

  const selectedPath = await DialogService.SelectDirectory();
  if (!selectedPath?.trim() || selectedPath === currentDataPath.value) return;

  const [oldPath, newPath] = [currentDataPath.value, selectedPath.trim()];

  hideAll();
  showBar.value = true;
  start();

  try {
    await MigrationService.MigrateDirectory(oldPath, newPath);
    await setDataPath(newPath);
  } catch (e) {
    stop();
    toast.error(String(e).replace(/^Error:\s*/i, '') || 'Migration failed');
    showBar.value = true;
    hideTimer = window.setTimeout(hideAll, 3000);
  }
};
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
              <input type="checkbox" :checked="modifierKeys.ctrl" class="hidden-checkbox"
                     :disabled="!enableGlobalHotkey">
              <span class="modifier-key">Ctrl</span>
            </label>
            <label class="modifier-label" :class="{ active: modifierKeys.shift }" @click="toggleModifier('shift')">
              <input type="checkbox" :checked="modifierKeys.shift" class="hidden-checkbox"
                     :disabled="!enableGlobalHotkey">
              <span class="modifier-key">Shift</span>
            </label>
            <label class="modifier-label" :class="{ active: modifierKeys.alt }" @click="toggleModifier('alt')">
              <input type="checkbox" :checked="modifierKeys.alt" class="hidden-checkbox"
                     :disabled="!enableGlobalHotkey">
              <span class="modifier-key">Alt</span>
            </label>
            <label class="modifier-label" :class="{ active: modifierKeys.win }" @click="toggleModifier('win')">
              <input type="checkbox" :checked="modifierKeys.win" class="hidden-checkbox"
                     :disabled="!enableGlobalHotkey">
              <span class="modifier-key">Win</span>
            </label>
          </div>

          <select class="key-select" :value="selectedKey" @change="updateSelectedKey" :disabled="!enableGlobalHotkey">
            <option v-for="key in keyOptions" :key="key" :value="key">{{ key }}</option>
          </select>
        </div>

        <div class="hotkey-preview">
          <span class="preview-label">{{ t('settings.hotkeyPreview') }}</span>
          <span class="preview-hotkey">{{ hotkeyPreview || t('settings.none') }}</span>
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
      <SettingItem :title="t('settings.enableWindowSnap')">
        <ToggleSwitch v-model="enableWindowSnap"/>
      </SettingItem>
      <SettingItem :title="t('settings.enableLoadingAnimation')">
        <ToggleSwitch v-model="enableLoadingAnimation"/>
      </SettingItem>
      <SettingItem :title="t('settings.enableTabs')">
        <ToggleSwitch v-model="enableTabs"/>
      </SettingItem>
      <SettingItem :title="t('settings.enableMemoryMonitor')">
        <ToggleSwitch v-model="enableMemoryMonitor"/>
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
                :disabled="migrating"
            />
            <!-- 进度条 -->
            <div class="progress-bar" :class="[{'active': showBar}, barClass]" :style="{width: barWidth}"/>
          </div>
        </div>
      </div>
    </SettingSection>

    <SettingSection :title="t('settings.dangerZone')">
      <SettingItem :title="t('settings.resetAllSettings')">
        <button
            class="reset-button"
            :class="{ 'confirming': isResetConfirming('reset') }"
            @click="requestResetConfirm('reset')"
        >
          {{ isResetConfirming('reset') ? t('settings.confirmReset') : t('settings.reset') }}
        </button>
      </SettingItem>
    </SettingSection>
  </div>


</template>

<style scoped lang="scss">
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
</style>