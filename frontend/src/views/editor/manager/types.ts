import {Compartment, Extension} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import {ExtensionID} from '@/../bindings/voidraft/internal/models/models';
/**
 * 扩展工厂接口
 * 每个扩展需要实现此接口来创建和配置扩展
 */
export interface ExtensionFactory {
    /**
     * 创建扩展实例
     * @param config 扩展配置
     * @returns CodeMirror扩展
     */
    create(config: any): Extension

    /**
     * 获取默认配置
     * @returns 默认配置对象
     */
    getDefaultConfig(): any

    /**
     * 验证配置
     * @param config 配置对象
     * @returns 是否有效
     */
    validateConfig?(config: any): boolean
}

/**
 * 扩展状态
 */
export interface ExtensionState {
    id: ExtensionID
    factory: ExtensionFactory
    config: any
    enabled: boolean
    compartment: Compartment
    extension: Extension
}

/**
 * 视图信息
 */
export interface EditorViewInfo {
    view: EditorView
    documentId: number
    registered: boolean
}
