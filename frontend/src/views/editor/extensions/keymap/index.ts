import { Extension } from '@codemirror/state'
import { useKeybindingStore } from '@/stores/keybindingStore'
import { KeymapManager } from './keymapManager'

/**
 * 异步创建快捷键扩展
 * 确保快捷键配置已加载
 */
export const createDynamicKeymapExtension = async (): Promise<Extension> => {
  const keybindingStore = useKeybindingStore()
  
  // 确保快捷键配置已加载
  if (keybindingStore.keyBindings.length === 0) {
    await keybindingStore.loadKeyBindings()
  }
  
  return KeymapManager.createKeymapExtension(keybindingStore.enabledKeyBindings)
}

// 导出相关模块
export { KeymapManager } from './keymapManager'
export { commandRegistry, getCommandHandler, getCommandDescription, isCommandRegistered, getRegisteredCommands } from './commandRegistry'
export type { KeyBinding, CommandHandler, CommandDefinition, KeymapResult } from './types'