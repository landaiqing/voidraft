import { Extension } from '@codemirror/state';
import { useKeybindingStore } from '@/stores/keybindingStore';
import { useExtensionStore } from '@/stores/extensionStore';
import { Manager } from './manager';

/**
 * 异步创建快捷键扩展
 */
export const createDynamicKeymapExtension = async (): Promise<Extension> => {
  const keybindingStore = useKeybindingStore();
  const extensionStore = useExtensionStore();
  
  // 确保快捷键配置已加载
  if (keybindingStore.keyBindings.length === 0) {
    await keybindingStore.loadKeyBindings();
  }
  
  // 确保扩展配置已加载
  if (extensionStore.extensions.length === 0) {
    await extensionStore.loadExtensions();
  }
  
  // 获取启用的扩展key列表
  const enabledExtensionKeys = extensionStore.enabledExtensions
    .map(ext => ext.key)
    .filter((key): key is string => key !== undefined);
  
  return Manager.createKeymapExtension(keybindingStore.keyBindings, enabledExtensionKeys);
};

/**
 * 更新快捷键映射
 * @param view 编辑器视图
 */
export const updateKeymapExtension = (view: any): void => {
  const keybindingStore = useKeybindingStore();
  const extensionStore = useExtensionStore();
  
  // 获取启用的扩展key列表
  const enabledExtensionKeys = extensionStore.enabledExtensions
    .map(ext => ext.key)
    .filter((key): key is string => key !== undefined);
  
  Manager.updateKeymap(view, keybindingStore.keyBindings, enabledExtensionKeys);
};

// 导出相关模块
export { Manager } from './manager';
export { commands, getCommandHandler, getCommandDescription, isCommandRegistered, getRegisteredCommands } from './commands';
export type { KeyBinding, CommandHandler, CommandDefinition, KeymapResult } from './types';