import { Extension } from '@codemirror/state'
import { useKeybindingStore } from '@/stores/keybindingStore'
import { useExtensionStore } from '@/stores/extensionStore'
import { KeymapManager } from './keymapManager'
import { ExtensionID } from '@/../bindings/voidraft/internal/models/models'

/**
 * 异步创建快捷键扩展
 * 确保快捷键配置和扩展配置已加载
 */
export const createDynamicKeymapExtension = async (): Promise<Extension> => {
  const keybindingStore = useKeybindingStore()
  const extensionStore = useExtensionStore()
  
  // 确保快捷键配置已加载
  if (keybindingStore.keyBindings.length === 0) {
    await keybindingStore.loadKeyBindings()
  }
  
  // 确保扩展配置已加载
  if (extensionStore.extensions.length === 0) {
    await extensionStore.loadExtensions()
  }
  
  // 获取启用的扩展ID列表
  const enabledExtensionIds = extensionStore.enabledExtensions.map(ext => ext.id)
  
  return KeymapManager.createKeymapExtension(keybindingStore.keyBindings, enabledExtensionIds)
}

/**
 * 更新快捷键映射
 * @param view 编辑器视图
 */
export const updateKeymapExtension = (view: any): void => {
  const keybindingStore = useKeybindingStore()
  const extensionStore = useExtensionStore()
  
  // 获取启用的扩展ID列表
  const enabledExtensionIds = extensionStore.enabledExtensions.map(ext => ext.id)
  
  KeymapManager.updateKeymap(view, keybindingStore.keyBindings, enabledExtensionIds)
}

/**
 * 获取指定扩展的快捷键
 * @param extensionId 扩展ID
 * @returns 该扩展的快捷键列表
 */
export const getExtensionKeyBindings = (extensionId: ExtensionID) => {
  const keybindingStore = useKeybindingStore()
  return keybindingStore.getKeyBindingsByExtension(extensionId)
}

// 导出相关模块
export { KeymapManager } from './keymapManager'
export { commandRegistry, getCommandHandler, getCommandDescription, isCommandRegistered, getRegisteredCommands } from './commandRegistry'
export type { KeyBinding, CommandHandler, CommandDefinition, KeymapResult } from './types'