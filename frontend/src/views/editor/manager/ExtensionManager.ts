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
 * 扩展状态
 */
interface ExtensionState {
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
interface EditorViewInfo {
    view: EditorView
    documentId: number
    registered: boolean
}

/**
 * 扩展管理器
 * 负责管理所有动态扩展的注册、启用、禁用和配置更新
 * 采用统一配置，多视图同步的设计模式
 */
export class ExtensionManager {
    // 统一的扩展状态存储
    private extensionStates = new Map<ExtensionID, ExtensionState>()
    
    // 编辑器视图管理
    private viewsMap = new Map<number, EditorViewInfo>()
    private activeViewId: number | null = null
    
    // 注册的扩展工厂
    private extensionFactories = new Map<ExtensionID, ExtensionFactory>()
    
    // 防抖处理
    private debounceTimers = new Map<ExtensionID, number>()
    private debounceDelay = 300  // 默认防抖时间为300毫秒
    
    /**
     * 注册扩展工厂
     * @param id 扩展ID
     * @param factory 扩展工厂
     */
    registerExtension(id: ExtensionID, factory: ExtensionFactory): void {
        this.extensionFactories.set(id, factory)
        
        // 创建初始状态
        if (!this.extensionStates.has(id)) {
            const compartment = new Compartment()
            const defaultConfig = factory.getDefaultConfig()
            
            this.extensionStates.set(id, {
                id,
                factory,
                config: defaultConfig,
                enabled: false,
                compartment,
                extension: []  // 默认为空扩展（禁用状态）
            })
        }
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
     * 从后端配置初始化扩展状态
     * @param extensionConfigs 后端扩展配置列表
     */
    initializeExtensionsFromConfig(extensionConfigs: ExtensionConfig[]): void {
        for (const config of extensionConfigs) {
            const factory = this.extensionFactories.get(config.id)
            if (!factory) continue
            
            // 验证配置
            if (factory.validateConfig && !factory.validateConfig(config.config)) {
                continue
            }
            
            try {
                // 创建扩展实例
                const extension = config.enabled ? factory.create(config.config) : []
                
                // 如果状态已存在则更新，否则创建新状态
                if (this.extensionStates.has(config.id)) {
                    const state = this.extensionStates.get(config.id)!
                    state.config = config.config
                    state.enabled = config.enabled
                    state.extension = extension
                } else {
                    const compartment = new Compartment()
                    this.extensionStates.set(config.id, {
                        id: config.id,
                        factory,
                        config: config.config,
                        enabled: config.enabled,
                        compartment,
                        extension
                    })
                }
            } catch (error) {
                console.error(`Failed to initialize extension ${config.id}:`, error)
            }
        }
    }

    /**
     * 获取初始扩展配置数组（用于创建编辑器）
     * @returns CodeMirror扩展数组
     */
    getInitialExtensions(): Extension[] {
        const extensions: Extension[] = []
        
        // 为每个注册的扩展添加compartment
        for (const state of this.extensionStates.values()) {
            extensions.push(state.compartment.of(state.extension))
        }
        
        return extensions
    }

    /**
     * 设置编辑器视图
     * @param view 编辑器视图实例
     * @param documentId 文档ID
     */
    setView(view: EditorView, documentId: number): void {
        // 保存视图信息
        this.viewsMap.set(documentId, {
            view,
            documentId,
            registered: true
        })
        
        // 设置当前活动视图
        this.activeViewId = documentId
    }

    /**
     * 获取当前活动视图
     */
    private getActiveView(): EditorView | null {
        if (this.activeViewId === null) return null
        const viewInfo = this.viewsMap.get(this.activeViewId)
        return viewInfo ? viewInfo.view : null
    }

    /**
     * 更新单个扩展配置并应用到所有视图（带防抖功能）
     * @param id 扩展ID
     * @param enabled 是否启用
     * @param config 扩展配置
     */
    updateExtension(id: ExtensionID, enabled: boolean, config: any = {}): void {
        // 清除之前的定时器
        if (this.debounceTimers.has(id)) {
            window.clearTimeout(this.debounceTimers.get(id))
        }
        
        // 设置新的定时器
        const timerId = window.setTimeout(() => {
            this.updateExtensionImmediate(id, enabled, config)
            this.debounceTimers.delete(id)
        }, this.debounceDelay)
        
        this.debounceTimers.set(id, timerId)
    }

    /**
     * 立即更新扩展（无防抖）
     * @param id 扩展ID
     * @param enabled 是否启用
     * @param config 扩展配置
     */
    updateExtensionImmediate(id: ExtensionID, enabled: boolean, config: any = {}): void {
        // 获取扩展状态
        const state = this.extensionStates.get(id)
        if (!state) return
        
        // 获取工厂
        const factory = state.factory
        
        // 验证配置
        if (factory.validateConfig && !factory.validateConfig(config)) {
            return
        }
        
        try {
            // 创建新的扩展实例
            const extension = enabled ? factory.create(config) : []
            
            // 更新内部状态
            state.config = config
            state.enabled = enabled
            state.extension = extension
            
            // 应用到所有视图
            this.applyExtensionToAllViews(id)
        } catch (error) {
            console.error(`Failed to update extension ${id}:`, error)
        }
    }

    /**
     * 将指定扩展的当前状态应用到所有视图
     * @param id 扩展ID
     */
    private applyExtensionToAllViews(id: ExtensionID): void {
        const state = this.extensionStates.get(id)
        if (!state) return
        
        // 遍历所有视图并应用更改
        for (const viewInfo of this.viewsMap.values()) {
            try {
                if (!viewInfo.registered) continue
                
                viewInfo.view.dispatch({
                    effects: state.compartment.reconfigure(state.extension)
                })
            } catch (error) {
                console.error(`Failed to apply extension ${id} to document ${viewInfo.documentId}:`, error)
            }
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
        // 清除所有相关的防抖定时器
        for (const update of updates) {
            if (this.debounceTimers.has(update.id)) {
                window.clearTimeout(this.debounceTimers.get(update.id))
                this.debounceTimers.delete(update.id)
            }
        }
        
        // 更新所有扩展状态
        for (const update of updates) {
            // 获取扩展状态
            const state = this.extensionStates.get(update.id)
            if (!state) continue
            
            // 获取工厂
            const factory = state.factory
            
            // 验证配置
            if (factory.validateConfig && !factory.validateConfig(update.config)) {
                continue
            }
            
            try {
                // 创建新的扩展实例
                const extension = update.enabled ? factory.create(update.config) : []
                
                // 更新内部状态
                state.config = update.config
                state.enabled = update.enabled
                state.extension = extension
            } catch (error) {
                console.error(`Failed to update extension ${update.id}:`, error)
            }
        }
        
        // 将更改应用到所有视图
        for (const viewInfo of this.viewsMap.values()) {
            if (!viewInfo.registered) continue
            
            const effects: StateEffect<any>[] = []
            
            for (const update of updates) {
                const state = this.extensionStates.get(update.id)
                if (!state) continue
                
                effects.push(state.compartment.reconfigure(state.extension))
            }
            
            if (effects.length > 0) {
                try {
                    viewInfo.view.dispatch({ effects })
                } catch (error) {
                    console.error(`Failed to apply extensions to document ${viewInfo.documentId}:`, error)
                }
            }
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
        const state = this.extensionStates.get(id)
        if (!state) return null
        
        return {
            enabled: state.enabled,
            config: state.config
        }
    }

    /**
     * 重置扩展到默认配置
     * @param id 扩展ID
     */
    resetExtensionToDefault(id: ExtensionID): void {
        const state = this.extensionStates.get(id)
        if (!state) return
        
        const defaultConfig = state.factory.getDefaultConfig()
        this.updateExtension(id, true, defaultConfig)
    }

    /**
     * 从管理器中移除视图
     * @param documentId 文档ID
     */
    removeView(documentId: number): void {
        if (this.activeViewId === documentId) {
            this.activeViewId = null
        }
        
        this.viewsMap.delete(documentId)
    }

    /**
     * 销毁管理器
     */
    destroy(): void {
        // 清除所有防抖定时器
        for (const timerId of this.debounceTimers.values()) {
            window.clearTimeout(timerId)
        }
        this.debounceTimers.clear()
        
        this.viewsMap.clear()
        this.activeViewId = null
        this.extensionFactories.clear()
        this.extensionStates.clear()
    }
} 