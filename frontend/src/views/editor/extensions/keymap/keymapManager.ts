import {keymap} from '@codemirror/view'
import {Extension} from '@codemirror/state'
import {KeyBinding as KeyBindingConfig} from '@/../bindings/voidraft/internal/models/models'
import {KeyBinding, KeymapResult} from './types'
import {getCommandHandler, isCommandRegistered} from './commandRegistry'

/**
 * 快捷键管理器
 * 负责将后端配置转换为CodeMirror快捷键扩展
 */
export class KeymapManager {
    /**
     * 将后端快捷键配置转换为CodeMirror快捷键绑定
     * @param keyBindings 后端快捷键配置列表
     * @returns 转换结果
     */
    static convertToKeyBindings(keyBindings: KeyBindingConfig[]): KeymapResult {
        const result: KeyBinding[] = []

        for (const binding of keyBindings) {
            // 跳过禁用的快捷键
            if (!binding.enabled) {
                continue
            }

            // 检查命令是否已注册
            if (!isCommandRegistered(binding.command)) {
                continue
            }

            // 获取命令处理函数
            const handler = getCommandHandler(binding.command)
            if (!handler) {
                continue
            }

            // 转换为CodeMirror快捷键格式
            const keyBinding: KeyBinding = {
                key: binding.key,
                run: handler,
                preventDefault: true
            }

            result.push(keyBinding)
        }

        return {keyBindings: result}
    }

    /**
     * 创建CodeMirror快捷键扩展
     * @param keyBindings 后端快捷键配置列表
     * @returns CodeMirror扩展
     */
    static createKeymapExtension(keyBindings: KeyBindingConfig[]): Extension {
        const {keyBindings: cmKeyBindings} =
            this.convertToKeyBindings(keyBindings)

        return keymap.of(cmKeyBindings)
    }

    /**
     * 验证快捷键配置
     * @param keyBindings 快捷键配置列表
     * @returns 验证结果
     */
    static validateKeyBindings(keyBindings: KeyBindingConfig[]): {
        valid: KeyBindingConfig[]
        invalid: KeyBindingConfig[]
    } {
        const valid: KeyBindingConfig[] = []
        const invalid: KeyBindingConfig[] = []

        for (const binding of keyBindings) {
            if (binding.enabled && binding.key && isCommandRegistered(binding.command)) {
                valid.push(binding)
            } else {
                invalid.push(binding)
            }
        }

        return {valid, invalid}
    }
} 