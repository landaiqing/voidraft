import {Command} from '@codemirror/view'

/**
 * CodeMirror快捷键绑定格式
 */
export interface KeyBinding {
    key: string
    run: Command
    preventDefault?: boolean
}

/**
 * 命令处理函数类型
 */
export type CommandHandler = Command

/**
 * 命令定义接口
 */
export interface CommandDefinition {
    handler: CommandHandler
    descriptionKey: string // 翻译键
}

/**
 * 快捷键转换结果
 */
export interface KeymapResult {
    keyBindings: KeyBinding[]
} 