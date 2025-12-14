import {keymap} from '@codemirror/view';
import {Extension, Compartment} from '@codemirror/state';
import {KeyBinding as KeyBindingConfig} from '@/../bindings/voidraft/internal/models/ent/models';
import {KeyBinding, KeymapResult} from './types';
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
    static convertToKeyBindings(keyBindings: KeyBindingConfig[]): KeymapResult {
        const result: KeyBinding[] = [];

        for (const binding of keyBindings) {
            // 跳过禁用的快捷键
            if (!binding.enabled) {
                continue;
            }

            // 检查命令是否已注册（使用 key 字段作为命令标识符）
            if (!binding.key || !isCommandRegistered(binding.key)) {
                continue;
            }

            // 获取命令处理函数
            const handler = getCommandHandler(binding.key);
            if (!handler) {
                continue;
            }

            // 转换为CodeMirror快捷键格式
            // binding.command 是快捷键组合 (如 "Mod-f")，binding.key 是命令标识符
            const keyBinding: KeyBinding = {
                key: binding.command || '',
                run: handler,
                preventDefault: true
            };

            result.push(keyBinding);
        }

        return {keyBindings: result};
    }

    /**
     * 创建CodeMirror快捷键扩展
     * @param keyBindings 后端快捷键配置列表
     * @returns CodeMirror扩展
     */
    static createKeymapExtension(keyBindings: KeyBindingConfig[]): Extension {
        const {keyBindings: cmKeyBindings} = this.convertToKeyBindings(keyBindings);
        return this.compartment.of(keymap.of(cmKeyBindings));
    }

    /**
     * 动态更新快捷键扩展
     * @param view 编辑器视图
     * @param keyBindings 后端快捷键配置列表
     */
    static updateKeymap(view: any, keyBindings: KeyBindingConfig[]): void {
        const {keyBindings: cmKeyBindings} = this.convertToKeyBindings(keyBindings);
        view.dispatch({
            effects: this.compartment.reconfigure(keymap.of(cmKeyBindings))
        });
    }
} 