<script setup lang="ts">
import {computed, onMounted, ref} from 'vue';
import {useI18n} from 'vue-i18n';
import {useEditorStore} from '@/stores/editorStore';
import {useExtensionStore} from '@/stores/extensionStore';
import {useKeybindingStore} from '@/stores/keybindingStore';
import {ExtensionService} from '@/../bindings/voidraft/internal/services';
import {
  getExtensionDefaultConfig,
  getExtensionDescription,
  getExtensionDisplayName, getExtensionsMap,
  hasExtensionConfig
} from '@/views/editor/manager/extensions';
import {getExtensionManager} from '@/views/editor/manager';
import SettingSection from '../components/SettingSection.vue';
import SettingItem from '../components/SettingItem.vue';
import ToggleSwitch from '../components/ToggleSwitch.vue';

const {t} = useI18n();
const editorStore = useEditorStore();
const extensionStore = useExtensionStore();
const keybindingStore = useKeybindingStore();

// 页面初始化时加载扩展数据
onMounted(async () => {
  await extensionStore.loadExtensions();
});

// 展开状态管理
const expandedExtensions = ref<Set<number>>(new Set());

// 获取所有可用的扩展
const availableExtensions = computed(() => {
  return getExtensionsMap().map(name => {
    const extension = extensionStore.extensions.find(ext => ext.name === name);
    return {
      id: extension?.id ?? 0,
      name: name,
      displayName: getExtensionDisplayName(name),
      description: getExtensionDescription(name),
      enabled: extension?.enabled || false,
      hasConfig: hasExtensionConfig(name),
      config: extension?.config || {},
      defaultConfig: getExtensionDefaultConfig(name)
    };
  });
});

// 切换展开状态
const toggleExpanded = (extensionId: number) => {
  if (expandedExtensions.value.has(extensionId)) {
    expandedExtensions.value.delete(extensionId);
  } else {
    expandedExtensions.value.add(extensionId);
  }
};

// 更新扩展状态
const updateExtension = async (extensionId: number, enabled: boolean) => {
  try {
    // 更新后端
    await ExtensionService.UpdateExtensionEnabled(extensionId, enabled);
    
    // 重新加载各个 Store 的状态
    await extensionStore.loadExtensions();
    await keybindingStore.loadKeyBindings();
    
    // 获取更新后的扩展
    const extension = extensionStore.extensions.find(ext => ext.id === extensionId);
    if (!extension) return;
    
    // 应用到编辑器
    const manager = getExtensionManager();
    if (manager) {
      manager.updateExtension(extension.name, enabled, extension.config);
    }
    
    // 更新快捷键
    await editorStore.applyKeymapSettings();
  } catch (error) {
    console.error('Failed to update extension:', error);
  }
};

// 更新扩展配置
const updateExtensionConfig = async (extensionId: number, configKey: string, value: any) => {
  try {
    // 获取当前扩展状态
    const extension = extensionStore.extensions.find(ext => ext.id === extensionId);
    if (!extension) return;

    // 更新配置
    const updatedConfig = {...(extension.config || {})};
    if (value === undefined) {
      delete updatedConfig[configKey];
    } else {
      updatedConfig[configKey] = value;
    }
    
    // 更新后端配置
    await ExtensionService.UpdateExtensionConfig(extensionId, updatedConfig);
    
    // 重新加载状态
    await extensionStore.loadExtensions();
    
    // 应用到编辑器
    const manager = getExtensionManager();
    if (manager) {
      manager.updateExtension(extension.name, extension.enabled ?? false, updatedConfig);
    }
  } catch (error) {
    console.error('Failed to update extension config:', error);
  }
};

// 重置扩展到默认配置
const resetExtension = async (extensionId: number) => {
  try {
    // 重置到默认配置
    await ExtensionService.ResetExtensionConfig(extensionId);

    // 重新加载扩展状态
    await extensionStore.loadExtensions();

    // 获取重置后的状态，应用到编辑器
    const extension = extensionStore.extensions.find(ext => ext.id === extensionId);
    if (extension) {
      const manager = getExtensionManager();
      if (manager) {
        manager.updateExtension(extension.name, extension.enabled ?? false, extension.config);
      }
    }
  } catch (error) {
    console.error('Failed to reset extension:', error);
  }
};

const getConfigValue = (
    config: Record<string, any> | undefined,
    configKey: string,
    defaultValue: any
) => {
  if (config && Object.prototype.hasOwnProperty.call(config, configKey)) {
    return config[configKey];
  }
  return defaultValue;

};


const formatConfigValue = (value: any): string => {
  if (value === undefined) return '';
  try {
    const serialized = JSON.stringify(value);
    return serialized ?? '';
  } catch (error) {
    console.warn('Failed to stringify config value', error);
    return '';
  }

};


const handleConfigInput = async (
    extensionId: number,
    configKey: string,
    defaultValue: any,
    event: Event
) => {
  const target = event.target as HTMLInputElement | null;
  if (!target) return;
  const rawValue = target.value;
  const trimmedValue = rawValue.trim();
  if (!trimmedValue.length) {
    await updateExtensionConfig(extensionId, configKey, undefined);
    return;
  }

  try {
    const parsedValue = JSON.parse(trimmedValue);
    await updateExtensionConfig(extensionId, configKey, parsedValue);
  } catch (_error) {
    const extension = extensionStore.extensions.find(ext => ext.id === extensionId);
    const fallbackValue = getConfigValue(extension?.config, configKey, defaultValue);
    target.value = formatConfigValue(fallbackValue);

  }

};

</script>

<template>
  <div class="settings-page">
    <SettingSection :title="t('settings.extensions')">
      <div
          v-for="extension in availableExtensions"
          :key="extension.name"
          class="extension-item"
      >
        <!-- 扩展主项 -->
        <SettingItem
            :title="extension.displayName"
            :description="extension.description"
        >
          <div class="extension-controls">
            <button
                v-if="extension.hasConfig"
                class="config-button"
                @click="toggleExpanded(extension.id)"
                :class="{ expanded: expandedExtensions.has(extension.id) }"
                :title="t('settings.extensionsPage.configuration')"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <path
                    d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <div v-else class="config-placeholder"></div>
            <ToggleSwitch
                :model-value="extension.enabled"
                @update:model-value="updateExtension(extension.id, $event)"
            />
          </div>
        </SettingItem>

        <!-- 可展开的配置区域 -->
        <div
            v-if="extension.hasConfig && expandedExtensions.has(extension.id)"
            class="extension-config"
        >
          <!-- 配置项标题和重置按钮 -->
          <div class="config-header">
            <h4 class="config-title">{{ t('settings.extensionsPage.configuration') }}</h4>
            <button
                class="reset-button"
                @click="resetExtension(extension.id)"
                :title="t('settings.extensionsPage.resetToDefault')"
            >
              {{ t('settings.reset') }}
            </button>
          </div>

          <div class="config-table-wrapper">
            <table class="config-table">
              <tbody>
              <tr
                  v-for="[configKey, configValue] in Object.entries(extension.defaultConfig)"
                  :key="configKey"
              >
                <th scope="row" class="config-table-key">
                  {{ configKey }}
                </th>
                <td class="config-table-value">
                  <input
                      class="config-value-input"
                      type="text"
                      :value="formatConfigValue(getConfigValue(extension.config, configKey, configValue))"
                      @change="handleConfigInput(extension.id, configKey, configValue, $event)"
                      @keyup.enter.prevent="handleConfigInput(extension.id, configKey, configValue, $event)"
                  />
                </td>
              </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SettingSection>
  </div>
</template>

<style scoped lang="scss">
.extension-item {
  border-bottom: 1px solid var(--settings-input-border);

  &:last-child {
    border-bottom: none;
  }
}

.extension-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 140px;
  justify-content: flex-end;
}

.config-button {
  padding: 4px;
  border: none;
  background: none;
  color: var(--settings-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 4px;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background-color: var(--settings-hover);
    color: var(--settings-text);
  }

  &.expanded {
    color: var(--settings-accent);
    background-color: var(--settings-hover);
  }

  svg {
    transition: all 0.2s ease;
  }
}

.config-placeholder {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.extension-config {
  background-color: var(--settings-input-bg);
  border-left: 2px solid var(--settings-accent);
  margin: 4px 0 12px 0;
  padding: 8px 10px;
  border-radius: 2px;
  font-size: 12px;
}

.config-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.config-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--settings-text);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.reset-button {
  padding: 3px 8px;
  font-size: 12px;
  border: 1px solid var(--settings-input-border);
  border-radius: 2px;
  background-color: transparent;
  color: var(--settings-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;

  &:hover {
    background-color: var(--settings-hover);
    color: var(--settings-text);
    border-color: var(--settings-accent);
  }
}

.config-table-wrapper {
  border: 1px solid var(--settings-input-border);
  border-radius: 2px;
  overflow: hidden;
  background-color: var(--settings-panel, var(--settings-input-bg));
}

.config-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.config-table tr + tr {
  border-top: 1px solid var(--settings-input-border);
}

.config-table th,
.config-table td {
  padding: 5px 8px;
  vertical-align: middle;
}

.config-table-key {
  width: 30%;
  text-align: left;
  font-weight: 500;
  color: var(--settings-text-secondary);
  border-right: 1px solid var(--settings-input-border);
  background-color: rgba(0, 0, 0, 0.05);
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace;
  font-size: 10px;
}

.config-table-value {
  padding: 3px 4px;
}

.config-value-input {
  width: 100%;
  padding: 4px 6px;
  border: 1px solid transparent;
  border-radius: 2px;
  background: transparent;
  color: var(--settings-text);
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace;
  line-height: 1.3;
  box-sizing: border-box;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.config-value-input:hover {
  border-color: var(--settings-input-border);
  background-color: var(--settings-hover);
}

.config-value-input:focus {
  outline: none;
  border-color: var(--settings-accent);
  background-color: var(--settings-input-bg);
}
</style> 

