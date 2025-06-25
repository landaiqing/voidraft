import {keymap} from '@codemirror/view'
import {Extension, Compartment} from '@codemirror/state'
import {KeyBinding as KeyBindingConfig, ExtensionID} from '@/../bindings/voidraft/internal/models/models'
import {KeyBinding, KeymapResult} from './types'
import {getCommandHandler, isCommandRegistered} from './commandRegistry'

/**
 * 快捷键管理器
 * 负责将后端配置转换为CodeMirror快捷键扩展
 */
export class KeymapManager {
    private static compartment = new Compartment()
    
    /**
     * 将后端快捷键配置转换为CodeMirror快捷键绑定
     * @param keyBindings 后端快捷键配置列表
     * @param enabledExtensions 启用的扩展ID列表，如果不提供则使用所有启用的快捷键
     * @returns 转换结果
     */
    static convertToKeyBindings(keyBindings: KeyBindingConfig[], enabledExtensions?: ExtensionID[]): KeymapResult {
        const result: KeyBinding[] = []

        for (const binding of keyBindings) {
            // 跳过禁用的快捷键
            if (!binding.enabled) {
                continue
            }

            // 如果提供了扩展列表，则只处理启用扩展的快捷键
            if (enabledExtensions && !enabledExtensions.includes(binding.extension)) {
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
     * @param enabledExtensions 启用的扩展ID列表
     * @returns CodeMirror扩展
     */
    static createKeymapExtension(keyBindings: KeyBindingConfig[], enabledExtensions?: ExtensionID[]): Extension {
        const {keyBindings: cmKeyBindings} =
            this.convertToKeyBindings(keyBindings, enabledExtensions)

        return this.compartment.of(keymap.of(cmKeyBindings))
    }

    /**
     * 动态更新快捷键扩展
     * @param view 编辑器视图
     * @param keyBindings 后端快捷键配置列表
     * @param enabledExtensions 启用的扩展ID列表
     */
    static updateKeymap(view: any, keyBindings: KeyBindingConfig[], enabledExtensions: ExtensionID[]): void {
        const {keyBindings: cmKeyBindings} =
            this.convertToKeyBindings(keyBindings, enabledExtensions)

        view.dispatch({
            effects: this.compartment.reconfigure(keymap.of(cmKeyBindings))
        })
    }

    /**
     * 按扩展分组快捷键
     * @param keyBindings 快捷键配置列表
     * @returns 按扩展分组的快捷键映射
     */
    static groupByExtension(keyBindings: KeyBindingConfig[]): Map<ExtensionID, KeyBindingConfig[]> {
        const groups = new Map<ExtensionID, KeyBindingConfig[]>()
        
        for (const binding of keyBindings) {
            if (!groups.has(binding.extension)) {
                groups.set(binding.extension, [])
            }
            groups.get(binding.extension)!.push(binding)
        }
        
        return groups
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