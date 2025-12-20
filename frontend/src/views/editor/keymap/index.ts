import { Extension } from '@codemirror/state';
import { useKeybindingStore } from '@/stores/keybindingStore';
import { Manager } from './manager';

/**
 * 异步创建快捷键扩展
 */
export const createDynamicKeymapExtension = async (): Promise<Extension> => {
  const keybindingStore = useKeybindingStore();
  
  // 确保快捷键配置已加载
  if (keybindingStore.keyBindings.length === 0) {
    await keybindingStore.loadKeyBindings();
  }
  
  return Manager.createKeymapExtension(keybindingStore.keyBindings);
};

/**
 * 更新快捷键映射
 * @param view 编辑器视图
 */
export const updateKeymapExtension = (view: any): void => {
  const keybindingStore = useKeybindingStore();
  Manager.updateKeymap(view, keybindingStore.keyBindings);
};

// 导出相关模块
export { Manager } from './manager';
export { commands, getCommandHandler, getCommandDescription, isCommandRegistered, getRegisteredCommands } from './commands';