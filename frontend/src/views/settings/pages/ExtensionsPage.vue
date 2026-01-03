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
import AccordionContainer from '@/components/accordion/AccordionContainer.vue';
import AccordionItem from '@/components/accordion/AccordionItem.vue';
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
const expandedExtensions = ref<number[]>([]);

// 获取所有可用的扩展
const availableExtensions = computed(() => {
  const extensions = getExtensionsMap().map(name => {
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
  console.log('Available Extensions:', extensions);
  return extensions;
});

// 获取扩展图标路径（直接使用扩展名称作为文件名）
const getExtensionIcon = (name: string): string => {
  return `/images/${name}.svg`;
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
      <!-- 空状态提示 -->
      <div v-if="availableExtensions.length === 0" class="empty-state">
        <p>{{ t('settings.extensionsPage.loading') }}</p>
      </div>
      
      <!-- 扩展列表 -->
      <AccordionContainer v-else v-model="expandedExtensions" :multiple="false">
        <AccordionItem
            v-for="extension in availableExtensions"
            :key="extension.id"
            :id="extension.id"
            :class="{ 'extension-disabled': !extension.enabled }"
        >
          <!-- 标题插槽：显示图标和扩展名称 -->
          <template #title>
            <div class="extension-header">
              <div class="extension-icon-wrapper">
                <div class="extension-icon-placeholder" :class="{ 'disabled': !extension.enabled }">
                  <!-- 直接使用扩展名称作为图标文件名 -->
                  <img 
                    :src="getExtensionIcon(extension.name)" 
                    :alt="extension.displayName"
                    class="extension-icon-img"
                  />
                </div>
              </div>
              <div class="extension-info">
                <div class="extension-name">{{ extension.displayName }}</div>
                <div class="extension-description">{{ extension.description }}</div>
              </div>
            </div>
          </template>

          <!-- 默认插槽：显示开关和配置项 -->
          <div class="extension-content">
            <!-- 启用开关 -->
            <div class="extension-toggle-section">
              <label class="toggle-label">{{ t('settings.extensionsPage.enabled') }}</label>
              <ToggleSwitch
                  :model-value="extension.enabled"
                  @update:model-value="updateExtension(extension.id, $event)"
              />
            </div>

            <!-- 配置项 -->
            <div v-if="extension.hasConfig" class="extension-config-section">
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
        </AccordionItem>
      </AccordionContainer>
    </SettingSection>
  </div>
</template>

<style scoped lang="scss">
.empty-state {
  padding: 40px 20px;
  text-align: center;
  color: var(--settings-text-secondary);
  font-size: 14px;
}

// 禁用状态的扩展项
:deep(.extension-disabled) {
  background-color: rgba(0, 0, 0, 0.02);
  
  .accordion-header {
    opacity: 0.7;
    
    &:hover {
      background-color: rgba(0, 0, 0, 0.03);
      opacity: 0.8;
    }
  }

  &.is-expanded {
    background-color: rgba(0, 0, 0, 0.03);
    
    .accordion-header {
      opacity: 0.8;
    }
  }

  .extension-description {
    opacity: 0.7;
  }
}

.extension-header {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.extension-icon-wrapper {
  flex-shrink: 0;
}

.extension-icon-placeholder {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(var(--settings-accent-rgb, 74, 158, 255), 0.12), rgba(var(--settings-accent-rgb, 74, 158, 255), 0.06));
  border: 1px solid rgba(var(--settings-accent-rgb, 74, 158, 255), 0.15);
  color: white;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  
  &.disabled {
    background: linear-gradient(135deg, rgba(136, 136, 136, 0.08), rgba(136, 136, 136, 0.04));
    border-color: rgba(136, 136, 136, 0.1);
    box-shadow: none;
    
    .extension-icon-img {
      opacity: 0.4;
      filter: grayscale(1);
    }
  }
}

.extension-icon-img {
  width: 28px;
  height: 28px;
  object-fit: contain;
  transition: all 0.2s ease;
}

.extension-info {
  flex: 1;
  min-width: 0;
}

.extension-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--settings-text);
  margin-bottom: 2px;
}

.extension-description {
  font-size: 12px;
  color: var(--settings-text-secondary);
  line-height: 1.5;
  word-wrap: break-word;
  word-break: break-word;
}

.extension-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.extension-toggle-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background-color: var(--settings-input-bg);
  border-radius: 4px;
  border: 1px solid var(--settings-input-border);
}

.toggle-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--settings-text);
  margin: 0;
}

.extension-config-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
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
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid var(--settings-input-border);
  border-radius: 3px;
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
  border-radius: 4px;
  overflow: hidden;
  background-color: var(--settings-panel, var(--settings-input-bg));
}

.config-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.config-table tr + tr {
  border-top: 1px solid var(--settings-input-border);
}

.config-table th,
.config-table td {
  padding: 6px 10px;
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
  font-size: 12px;
}

.config-table-value {
  padding: 4px 6px;
}

.config-value-input {
  width: 100%;
  padding: 5px 8px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  color: var(--settings-text);
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace;
  line-height: 1.4;
  box-sizing: border-box;
  transition: border-color 0.15s ease, background-color 0.15s ease;

  &:hover {
    border-color: var(--settings-input-border);
    background-color: var(--settings-hover);
  }

  &:focus {
    outline: none;
    border-color: var(--settings-accent);
    background-color: var(--settings-input-bg);
  }
}
</style> 

