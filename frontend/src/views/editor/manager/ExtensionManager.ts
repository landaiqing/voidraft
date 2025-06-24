import {Compartment, Extension, StateEffect} from '@codemirror/state'
import {EditorView} from '@codemirror/view'
import {Extension as ExtensionConfig, ExtensionID} from '@/../bindings/voidraft/internal/models/models'

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
 * 扩展区间信息
 */
interface ExtensionCompartment {
    id: ExtensionID
    compartment: Compartment
    factory: ExtensionFactory
    currentConfig?: any
    enabled: boolean
}

/**
 * 扩展管理器
 * 负责管理所有动态扩展的注册、启用、禁用和配置更新
 */
export class ExtensionManager {
    private view: EditorView | null = null
    private compartments = new Map<ExtensionID, ExtensionCompartment>()
    private extensionFactories = new Map<ExtensionID, ExtensionFactory>()

    /**
     * 注册扩展工厂
     * @param id 扩展ID
     * @param factory 扩展工厂
     */
    registerExtension(id: ExtensionID, factory: ExtensionFactory): void {
        this.extensionFactories.set(id, factory)
        this.compartments.set(id, {
            id,
            compartment: new Compartment(),
            factory,
            currentConfig: factory.getDefaultConfig(),
            enabled: false
        })
    }

    /**
     * 获取所有注册的扩展ID列表
     */
    getRegisteredExtensions(): ExtensionID[] {
        return Array.from(this.extensionFactories.keys())
    }

    /**
     * 检查扩展是否已注册
     * @param id 扩展ID
     */
    isExtensionRegistered(id: ExtensionID): boolean {
        return this.extensionFactories.has(id)
    }

    /**
     * 根据后端配置获取初始扩展数组
     * @param extensionConfigs 后端扩展配置列表
     * @returns CodeMirror扩展数组
     */
    getInitialExtensions(extensionConfigs: ExtensionConfig[]): Extension[] {
        const extensions: Extension[] = []

        for (const config of extensionConfigs) {
            const compartmentInfo = this.compartments.get(config.id)
            if (!compartmentInfo) {
                continue
            }

            // 验证配置
            if (compartmentInfo.factory.validateConfig &&
                !compartmentInfo.factory.validateConfig(config.config)) {
                continue
            }

            try {
                const extension = config.enabled
                    ? compartmentInfo.factory.create(config.config)
                    : [] // 空扩展表示禁用

                extensions.push(compartmentInfo.compartment.of(extension))

                // 更新状态
                compartmentInfo.currentConfig = config.config
                compartmentInfo.enabled = config.enabled
            } catch (error) {
                console.error(`Failed to create extension ${config.id}:`, error)
            }
        }

        return extensions
    }

    /**
     * 设置编辑器视图
     * @param view 编辑器视图实例
     */
    setView(view: EditorView): void {
        this.view = view
    }

    /**
     * 动态更新单个扩展
     * @param id 扩展ID
     * @param enabled 是否启用
     * @param config 扩展配置
     */
    updateExtension(id: ExtensionID, enabled: boolean, config: any = {}): void {

        if (!this.view) {
            return
        }

        const compartmentInfo = this.compartments.get(id)
        if (!compartmentInfo) {
            return
        }

        try {
            // 验证配置
            if (compartmentInfo.factory.validateConfig &&
                !compartmentInfo.factory.validateConfig(config)) {
                return
            }

            const extension = enabled
                ? compartmentInfo.factory.create(config)
                : []

            this.view.dispatch({
                effects: compartmentInfo.compartment.reconfigure(extension)
            })

            // 更新状态
            compartmentInfo.currentConfig = config
            compartmentInfo.enabled = enabled

        } catch (error) {
            console.error(`[ExtensionManager] Failed to update extension ${id}:`, error)
        }
    }

    /**
     * 批量更新扩展
     * @param updates 更新配置数组
     */
    updateExtensions(updates: Array<{
        id: ExtensionID
        enabled: boolean
        config: any
    }>): void {
        if (!this.view) {
            console.warn('Editor view not set')
            return
        }

        const effects: StateEffect<any>[] = []

        for (const update of updates) {
            const compartmentInfo = this.compartments.get(update.id)
            if (!compartmentInfo) {
                continue
            }

            try {
                // 验证配置
                if (compartmentInfo.factory.validateConfig &&
                    !compartmentInfo.factory.validateConfig(update.config)) {
                    continue
                }

                const extension = update.enabled
                    ? compartmentInfo.factory.create(update.config)
                    : []

                effects.push(compartmentInfo.compartment.reconfigure(extension))

                // 更新状态
                compartmentInfo.currentConfig = update.config
                compartmentInfo.enabled = update.enabled
            } catch (error) {
                console.error(`Failed to update extension ${update.id}:`, error)
            }
        }

        if (effects.length > 0) {
            this.view.dispatch({effects})
        }
    }

    /**
     * 获取扩展当前状态
     * @param id 扩展ID
     */
    getExtensionState(id: ExtensionID): {
        enabled: boolean
        config: any
    } | null {
        const compartmentInfo = this.compartments.get(id)
        if (!compartmentInfo) {
            return null
        }

        return {
            enabled: compartmentInfo.enabled,
            config: compartmentInfo.currentConfig
        }
    }

    /**
     * 重置扩展到默认配置
     * @param id 扩展ID
     */
    resetExtensionToDefault(id: ExtensionID): void {
        const compartmentInfo = this.compartments.get(id)
        if (!compartmentInfo) {
            return
        }

        const defaultConfig = compartmentInfo.factory.getDefaultConfig()
        this.updateExtension(id, true, defaultConfig)
    }

    /**
     * 销毁管理器
     */
    destroy(): void {
        this.view = null
        this.compartments.clear()
        this.extensionFactories.clear()
    }
} 