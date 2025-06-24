import {Extension} from '@codemirror/state'
import {useExtensionStore} from '@/stores/extensionStore'
import {ExtensionManager} from './ExtensionManager'
import {registerAllExtensions} from './factories'

/**
 * 全局扩展管理器实例
 */
const extensionManager = new ExtensionManager()

/**
 * 异步创建动态扩展
 * 确保扩展配置已加载
 */
export const createDynamicExtensions = async (): Promise<Extension[]> => {
    const extensionStore = useExtensionStore()

    // 注册所有扩展工厂
    registerAllExtensions(extensionManager)

    // 确保扩展配置已加载
    if (extensionStore.extensions.length === 0) {
        await extensionStore.loadExtensions()
    }

    // 获取启用的扩展配置
    const enabledExtensions = extensionStore.enabledExtensions

    return extensionManager.getInitialExtensions(enabledExtensions)
}

/**
 * 获取扩展管理器实例
 * @returns 扩展管理器
 */
export const getExtensionManager = (): ExtensionManager => {
    return extensionManager
}

/**
 * 设置编辑器视图到扩展管理器
 * @param view 编辑器视图
 */
export const setExtensionManagerView = (view: any): void => {
    extensionManager.setView(view)
}

// 导出相关模块
export {ExtensionManager} from './ExtensionManager'
export {registerAllExtensions, getExtensionDisplayName, getExtensionDescription} from './factories'
export type {ExtensionFactory} from './ExtensionManager'