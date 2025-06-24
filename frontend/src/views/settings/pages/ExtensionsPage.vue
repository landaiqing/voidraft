<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import {useEditorStore} from '@/stores/editorStore'
import {useExtensionStore} from '@/stores/extensionStore'
import {ExtensionService} from '@/../bindings/voidraft/internal/services'
import {ExtensionID} from '@/../bindings/voidraft/internal/models/models'
import {getAllExtensionIds, getExtensionDescription, getExtensionDisplayName} from '@/views/editor/manager/factories'
import SettingSection from '../components/SettingSection.vue'
import SettingItem from '../components/SettingItem.vue'
import ToggleSwitch from '../components/ToggleSwitch.vue'

const {t} = useI18n()
const editorStore = useEditorStore()
const extensionStore = useExtensionStore()

// 获取所有可用的扩展
const availableExtensions = computed(() => {
  return getAllExtensionIds().map(id => {
    const extension = extensionStore.extensions.find(ext => ext.id === id)
    return {
      id,
      displayName: getExtensionDisplayName(id),
      description: getExtensionDescription(id),
      enabled: extension?.enabled || false,
      isDefault: extension?.isDefault || false
    }
  })
})

// 更新扩展状态
const updateExtension = async (extensionId: ExtensionID, enabled: boolean) => {
  await editorStore.updateExtension(extensionId, enabled)
}

// 重置扩展到默认配置
const resetExtension = async (extensionId: ExtensionID) => {

  await ExtensionService.ResetExtensionToDefault(extensionId)

  // 重新加载扩展状态
  await extensionStore.loadExtensions()

  // 获取重置后的状态，通知编辑器更新
  const extension = extensionStore.extensions.find(ext => ext.id === extensionId)
  if (extension) {
    await editorStore.updateExtension(extensionId, extension.enabled, extension.config)
  }

}
</script>

<template>
  <div class="settings-page">
    <SettingSection :title="t('settings.extensions')">
      <SettingItem
          v-for="extension in availableExtensions"
          :key="extension.id"
          :title="extension.displayName"
          :description="extension.description"
      >
        <div class="extension-controls">
          <ToggleSwitch
              :model-value="extension.enabled"
              @update:model-value="updateExtension(extension.id, $event)"
          />
          <button
              v-if="!extension.isDefault"
              class="reset-button"
              @click="resetExtension(extension.id)"
              :title="t('settings.extensionsPage.resetToDefault')"
          >
            {{ t('settings.reset') }}
          </button>
        </div>
      </SettingItem>
    </SettingSection>
  </div>
</template>

<style scoped lang="scss">
.settings-page {
  max-width: 1000px;
}

.extension-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.reset-button {
  padding: 4px 8px;
  font-size: 11px;
  border: 1px solid var(--settings-input-border);
  border-radius: 3px;
  background-color: var(--settings-input-bg);
  color: var(--settings-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: var(--settings-hover);
    color: var(--settings-text);
  }
}
</style> 