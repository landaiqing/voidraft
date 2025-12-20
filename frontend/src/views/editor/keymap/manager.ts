import {KeyBinding, keymap} from '@codemirror/view';
import {Compartment, Extension} from '@codemirror/state';
import {KeyBinding as KeyBindingConfig} from '@/../bindings/voidraft/internal/models/ent/models';
import {getCommandHandler, isCommandRegistered} from './commands';

/**
 * 快捷键管理器
 * 负责将后端配置转换为CodeMirror快捷键扩展
 */
export class Manager {
    private static compartment = new Compartment();

    /**
     * 将后端快捷键配置转换为CodeMirror快捷键绑定
     * @param keyBindings 后端快捷键配置列表
     * @returns 转换结果
     */
    static convertToKeyBindings(keyBindings: KeyBindingConfig[]): KeyBinding[] {
        const result: KeyBinding[] = [];

        for (const binding of keyBindings) {
            // 跳过禁用的快捷键
            if (!binding.enabled) {
                continue;
            }

            // 检查命令是否已注册
            if (!binding.name || !isCommandRegistered(binding.name)) {
                continue;
            }

            // 获取命令处理函数
            const handler = getCommandHandler(binding.name);
            if (!handler) {
                continue;
            }

            const keyBinding: KeyBinding = {
                key: binding.key || '',
                mac: binding.macos || undefined,
                win: binding.windows || undefined,
                linux: binding.linux || undefined,
                run: handler,
                preventDefault: binding.preventDefault,
                scope: binding.scope || undefined
            };

            result.push(keyBinding);
        }

        return result;
    }

    /**
     * 创建CodeMirror快捷键扩展
     * @param keyBindings 后端快捷键配置列表
     * @returns CodeMirror扩展
     */
    static createKeymapExtension(keyBindings: KeyBindingConfig[]): Extension {
        const cmKeyBindings = this.convertToKeyBindings(keyBindings);
        return this.compartment.of(keymap.of(cmKeyBindings));
    }

    /**
     * 动态更新快捷键扩展
     * @param view 编辑器视图
     * @param keyBindings 后端快捷键配置列表
     */
    static updateKeymap(view: any, keyBindings: KeyBindingConfig[]): void {
        const cmKeyBindings = this.convertToKeyBindings(keyBindings);
        view.dispatch({
            effects: this.compartment.reconfigure(keymap.of(cmKeyBindings))
        });
    }
} 