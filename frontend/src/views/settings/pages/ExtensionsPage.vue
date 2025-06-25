<script setup lang="ts">
import {computed, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {useEditorStore} from '@/stores/editorStore'
import {useExtensionStore} from '@/stores/extensionStore'
import {ExtensionService} from '@/../bindings/voidraft/internal/services'
import {ExtensionID} from '@/../bindings/voidraft/internal/models/models'
import {getExtensionManager} from '@/views/editor/manager'
import {
  getAllExtensionIds, 
  getExtensionDescription, 
  getExtensionDisplayName,
  hasExtensionConfig,
  getExtensionDefaultConfig
} from '@/views/editor/manager/factories'
import SettingSection from '../components/SettingSection.vue'
import SettingItem from '../components/SettingItem.vue'
import ToggleSwitch from '../components/ToggleSwitch.vue'

const {t} = useI18n()
const editorStore = useEditorStore()
const extensionStore = useExtensionStore()

// 展开状态管理
const expandedExtensions = ref<Set<ExtensionID>>(new Set())

// 获取所有可用的扩展
const availableExtensions = computed(() => {
  return getAllExtensionIds().map(id => {
    const extension = extensionStore.extensions.find(ext => ext.id === id)
    return {
      id,
      displayName: getExtensionDisplayName(id),
      description: getExtensionDescription(id),
      enabled: extension?.enabled || false,
      isDefault: extension?.isDefault || false,
      hasConfig: hasExtensionConfig(id),
      config: extension?.config || {},
      defaultConfig: getExtensionDefaultConfig(id)
    }
  })
})

// 切换展开状态
const toggleExpanded = (extensionId: ExtensionID) => {
  if (expandedExtensions.value.has(extensionId)) {
    expandedExtensions.value.delete(extensionId)
  } else {
    expandedExtensions.value.add(extensionId)
  }
}

// 更新扩展状态
const updateExtension = async (extensionId: ExtensionID, enabled: boolean) => {
  try {
    await editorStore.updateExtension(extensionId, enabled)
  } catch (error) {
    console.error('Failed to update extension:', error)
  }
}

// 更新扩展配置
const updateExtensionConfig = async (extensionId: ExtensionID, configKey: string, value: any) => {
  try {
    // 获取当前扩展状态
    const extension = extensionStore.extensions.find(ext => ext.id === extensionId)
    if (!extension) return

    // 更新配置
    const updatedConfig = { ...extension.config, [configKey]: value }

    await editorStore.updateExtension(extensionId, extension.enabled, updatedConfig)
    
  } catch (error) {
    console.error('Failed to update extension config:', error)
  }
}

// 重置扩展到默认配置
const resetExtension = async (extensionId: ExtensionID) => {
  try {
    await ExtensionService.ResetExtensionToDefault(extensionId)
    
    // 重新加载扩展状态以获取最新配置
    await extensionStore.loadExtensions()

    // 获取重置后的状态，立即通知编辑器更新
    const extension = extensionStore.extensions.find(ext => ext.id === extensionId)
    if (extension) {
      const manager = getExtensionManager()
      manager.updateExtension(extensionId, extension.enabled, extension.config)
    }
  } catch (error) {
    console.error('Failed to reset extension:', error)
  }
}

// 配置项类型定义
type ConfigItemType = 'toggle' | 'number' | 'text' | 'select'

interface SelectOption {
  value: any
  label: string
}

interface ConfigItemMeta {
  type: ConfigItemType
  options?: SelectOption[]
}

// 扩展配置项元数据
const extensionConfigMeta: Partial<Record<ExtensionID, Record<string, ConfigItemMeta>>> = {
  [ExtensionID.ExtensionMinimap]: {
    displayText: {
      type: 'select',
      options: [
        { value: 'characters', label: 'Characters' },
        { value: 'blocks', label: 'Blocks' }
      ]
    },
    showOverlay: {
      type: 'select',
      options: [
        { value: 'always', label: 'Always' },
        { value: 'mouse-over', label: 'Mouse Over' }
      ]
    },
    autohide: { type: 'toggle' }
  },
  [ExtensionID.ExtensionCodeBlock]: {
    showBackground: { type: 'toggle' },
    enableAutoDetection: { type: 'toggle' }
  },
  [ExtensionID.ExtensionTextHighlight]: {
    highlightClass: { type: 'text' }
  }
}

// 获取配置项类型
const getConfigItemType = (extensionId: ExtensionID, configKey: string, defaultValue: any): string => {
  const meta = extensionConfigMeta[extensionId]?.[configKey]
  if (meta?.type) {
    return meta.type
  }
  
  // 根据默认值类型自动推断
  if (typeof defaultValue === 'boolean') return 'toggle'
  if (typeof defaultValue === 'number') return 'number'
  return 'text'
}

// 获取选择项选项
const getSelectOptions = (extensionId: ExtensionID, configKey: string) => {
  const meta = extensionConfigMeta[extensionId]?.[configKey]
  if (meta?.type === 'select' && meta.options) {
    return meta.options
  }
  return []
}
</script>

<template>
  <div class="settings-page">
    <SettingSection :title="t('settings.extensions')">
      <div
          v-for="extension in availableExtensions"
          :key="extension.id"
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
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
          
          <div 
              v-for="[configKey, configValue] in Object.entries(extension.defaultConfig)"
              :key="configKey"
              class="config-item"
          >
            <SettingItem
                :title="configKey"
            >
              <!-- 布尔值切换开关 -->
              <ToggleSwitch
                  v-if="getConfigItemType(extension.id, configKey, configValue) === 'toggle'"
                  :model-value="extension.config[configKey] ?? configValue"
                  @update:model-value="updateExtensionConfig(extension.id, configKey, $event)"
              />
              
              <!-- 数字输入框 -->
              <input
                  v-else-if="getConfigItemType(extension.id, configKey, configValue) === 'number'"
                  type="number"
                  class="config-input"
                  :value="extension.config[configKey] ?? configValue"
                  @input="updateExtensionConfig(extension.id, configKey, parseInt(($event.target as HTMLInputElement).value))"
              />
              
              <!-- 选择框 -->
              <select
                  v-else-if="getConfigItemType(extension.id, configKey, configValue) === 'select'"
                  class="config-select"
                  :value="extension.config[configKey] ?? configValue"
                  @change="updateExtensionConfig(extension.id, configKey, ($event.target as HTMLSelectElement).value)"
              >
                <option
                    v-for="option in getSelectOptions(extension.id, configKey)"
                    :key="option.value"
                    :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
              
              <!-- 文本输入框 -->
              <input
                  v-else
                  type="text"
                  class="config-input"
                  :value="extension.config[configKey] ?? configValue"
                  @input="updateExtensionConfig(extension.id, configKey, ($event.target as HTMLInputElement).value)"
              />
            </SettingItem>
          </div>
        </div>
      </div>
    </SettingSection>
  </div>
</template>

<style scoped lang="scss">
.settings-page {
  max-width: 1000px;
}

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
  border-left: 3px solid var(--settings-accent);
  margin: 8px 0 16px 0;
  padding: 12px;
  border-radius: 6px;
  font-size: 13px; /* 调整字体大小 */
}

.config-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.config-title {
  font-size: 13px; /* 调整字体大小 */
  font-weight: 600;
  color: var(--settings-text);
  margin: 0;
}

.reset-button {
  padding: 6px 12px;
  font-size: 11px; /* 调整字体大小 */
  border: 1px solid var(--settings-input-border);
  border-radius: 4px;
  background-color: var(--settings-input-bg);
  color: var(--settings-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;

  &:hover {
    background-color: var(--settings-hover);
    color: var(--settings-text);
    border-color: var(--settings-accent);
  }
}

.config-item {
  &:not(:last-child) {
    margin-bottom: 12px;
  }
  
  /* 配置项标题和描述字体大小 */
  :deep(.setting-item-title) {
    font-size: 12px;
  }
  
  :deep(.setting-item-description) {
    font-size: 11px;
  }
}

.config-input, .config-select {
  min-width: 120px;
  padding: 4px 8px;
  border: 1px solid var(--settings-input-border);
  border-radius: 3px;
  background-color: var(--settings-input-bg);
  color: var(--settings-text);
  font-size: 11px; /* 调整字体大小 */
  
  &:focus {
    outline: none;
    border-color: var(--settings-accent);
  }
}

.config-select {
  cursor: pointer;
}
</style> 