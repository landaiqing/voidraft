<script setup lang="ts">
import { useConfigStore } from '@/stores/configStore';
import { useI18n } from 'vue-i18n';
import { computed, ref, onMounted } from 'vue';
import SettingSection from '../components/SettingSection.vue';
import SettingItem from '../components/SettingItem.vue';
import ToggleSwitch from '../components/ToggleSwitch.vue';
import MigrationProgress from '@/components/migration/MigrationProgress.vue';
import { useErrorHandler } from '@/utils/errorHandler';
import { DialogService, MigrationService } from '@/../bindings/voidraft/internal/services';
import * as runtime from '@wailsio/runtime';

const { t } = useI18n();
const configStore = useConfigStore();
const { safeCall } = useErrorHandler();

// 迁移状态
const showMigrationProgress = ref(false);

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
  const newHotkey = { ...currentHotkey, [key]: !currentHotkey[key] };
  configStore.setGlobalHotkey(newHotkey);
};

// 更新选择的键
const updateSelectedKey = (event: Event) => {
  const select = event.target as HTMLSelectElement;
  const newHotkey = { ...configStore.config.general.globalHotkey, key: select.value };
  configStore.setGlobalHotkey(newHotkey);
};

// 重置设置
const resetSettings = async () => {
  if (confirm(t('settings.confirmReset'))) {
    await configStore.resetConfig();
  }
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
  try {
    const selectedPath = await DialogService.SelectDirectory();
    
    if (selectedPath && selectedPath.trim() && selectedPath !== currentDataPath.value) {
      // 显示迁移进度对话框
      showMigrationProgress.value = true;
      
      // 开始迁移
      await safeCall(async () => {
        const oldPath = currentDataPath.value;
        const newPath = selectedPath.trim();
        
        // 先启动迁移
        await MigrationService.MigrateDirectory(oldPath, newPath);
        
        // 迁移完成后更新配置
        await configStore.setDataPath(newPath);
      }, 'migration.migrationFailed');
    }
  } catch (error) {
    await safeCall(async () => {
      throw error;
    }, 'settings.selectDirectoryFailed');
  }
};
    
// 处理迁移完成
const handleMigrationComplete = () => {
  showMigrationProgress.value = false;
  // 显示成功消息
  safeCall(async () => {
    // 空的成功操作，只为了显示成功消息
  }, '', 'migration.migrationCompleted');
};

// 处理迁移关闭
const handleMigrationClose = () => {
  showMigrationProgress.value = false;
};

// 处理迁移重试
const handleMigrationRetry = () => {
  // 重新触发路径选择
  showMigrationProgress.value = false;
  selectDataDirectory();
};
</script>

<template>
  <div class="settings-page">
    <SettingSection :title="t('settings.globalHotkey')">
      <SettingItem :title="t('settings.enableGlobalHotkey')">
        <ToggleSwitch v-model="enableGlobalHotkey" />
      </SettingItem>
      
      <div class="hotkey-selector" :class="{ 'disabled': !enableGlobalHotkey }">
        <div class="hotkey-modifiers">
          <label class="modifier-label" :class="{ active: modifierKeys.ctrl }" @click="toggleModifier('ctrl')">
            <input type="checkbox" :checked="modifierKeys.ctrl" class="hidden-checkbox" :disabled="!enableGlobalHotkey">
            <span class="modifier-key">Ctrl</span>
          </label>
          <label class="modifier-label" :class="{ active: modifierKeys.shift }" @click="toggleModifier('shift')">
            <input type="checkbox" :checked="modifierKeys.shift" class="hidden-checkbox" :disabled="!enableGlobalHotkey">
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
        
        <div class="hotkey-preview" v-if="hotkeyPreview">
          <span class="preview-label">预览：</span>
          <span class="preview-hotkey">{{ hotkeyPreview }}</span>
        </div>
      </div>
    </SettingSection>
    
    <SettingSection :title="t('settings.window')">
      <SettingItem :title="t('settings.alwaysOnTop')">
        <ToggleSwitch v-model="alwaysOnTop" />
      </SettingItem>
    </SettingSection>
    
    <SettingSection :title="t('settings.dataStorage')">
      <div class="data-path-setting">
        <div class="setting-header">
          <div class="setting-title">{{ t('settings.dataPath') }}</div>
        </div>
        <div class="data-path-controls">
          <input 
            type="text" 
            :value="currentDataPath"
            readonly
            :placeholder="t('settings.clickToSelectPath')"
            class="path-display-input"
            @click="selectDataDirectory"
            :title="t('settings.clickToSelectPath')"
          />
        </div>
      </div>
    </SettingSection>
    
    <SettingSection :title="t('settings.dangerZone')">
      <div class="danger-zone">
        <div class="reset-section">
          <div class="reset-info">
            <h4>{{ t('settings.resetAllSettings') }}</h4>
            <p>{{ t('settings.resetDescription') }}</p>
          </div>
          <button class="reset-button" @click="resetSettings">
            {{ t('settings.reset') }}
          </button>
        </div>
      </div>
    </SettingSection>
    
    <!-- 迁移进度对话框 -->
    <MigrationProgress 
      :visible="showMigrationProgress"
      @complete="handleMigrationComplete"
      @close="handleMigrationClose"
      @retry="handleMigrationRetry"
    />
  </div>
</template>

<style scoped lang="scss">
.settings-page {
  max-width: 800px;
}

.hotkey-selector {
  padding: 15px 0 5px 20px;
  
  &.disabled {
    opacity: 0.5;
    pointer-events: none;
  }
  
  .hotkey-modifiers {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
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
        background-color: #444444;
        border: 1px solid #555555;
        border-radius: 4px;
        color: #b0b0b0;
        font-size: 13px;
        transition: all 0.2s ease;
        
        &:hover {
          background-color: #4a4a4a;
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
    background-color: #3a3a3a;
    border: 1px solid #555555;
    border-radius: 4px;
    color: #e0e0e0;
    font-size: 13px;
    appearance: none;
    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23e0e0e0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
    background-repeat: no-repeat;
    background-position: right 8px center;
    background-size: 16px;
    padding-right: 30px;
    margin-bottom: 12px;
    
    &:focus {
      outline: none;
      border-color: #4a9eff;
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      background-color: #2a2a2a;
    }
    
    option {
      background-color: #2a2a2a;
    }
  }
  
  .hotkey-preview {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background-color: #252525;
    border: 1px solid #444444;
    border-radius: 4px;
    margin-top: 8px;
    
    .preview-label {
      font-size: 12px;
      color: #888888;
    }
    
    .preview-hotkey {
      font-size: 13px;
      color: #4a9eff;
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
      font-size: 14px;
      font-weight: 500;
      color: #e0e0e0;
    }
  }
}

.data-path-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
  
    .path-display-input {
      width: 100%;
    max-width: 450px;
      box-sizing: border-box;
    padding: 10px 12px;
      background-color: #3a3a3a;
      border: 1px solid #555555;
      border-radius: 4px;
      color: #e0e0e0;
      font-size: 13px;
    line-height: 1.2;
      transition: all 0.2s ease;
        cursor: pointer;
        
        &:hover {
          border-color: #4a9eff;
          background-color: #404040;
        }
        
        &:focus {
          outline: none;
          border-color: #4a9eff;
          background-color: #404040;
    }
    
      
      
      &::placeholder {
        color: #888888;
      }
    }
    

}

.danger-zone {
  padding: 20px;
  background-color: rgba(220, 53, 69, 0.05);
  border: 1px solid rgba(220, 53, 69, 0.2);
  border-radius: 6px;
  margin-top: 10px;
  
  .reset-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    
    .reset-info {
      flex: 1;
      
      h4 {
        margin: 0 0 6px 0;
        color: #ff6b6b;
        font-size: 14px;
        font-weight: 600;
      }
      
      p {
        margin: 0;
        color: #cccccc;
        font-size: 13px;
        line-height: 1.4;
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
      transition: all 0.2s ease;
      flex-shrink: 0;
      
      &:hover {
        background-color: #c82333;
        border-color: #bd2130;
      }
      
      &:active {
        transform: translateY(1px);
      }
    }
  }
}
</style> 