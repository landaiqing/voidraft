import {Compartment, Extension} from '@codemirror/state';

/**
 * 扩展定义
 * 标准化 create 方法和默认配置
 */
export interface ExtensionDefinition {
    create(config: any): Extension
    defaultConfig: Record<string, any>
}

/**
 * 扩展运行时状态
 */
export interface ExtensionState {
    id: string  // 扩展 key
    definition: ExtensionDefinition
    config: any
    enabled: boolean
    compartment: Compartment
    extension: Extension
}

