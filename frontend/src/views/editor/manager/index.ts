import {Extension} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import {useExtensionStore} from '@/stores/extensionStore';
import {ExtensionManager} from './extensionManager';
import {registerAllExtensions} from './extensions';

/**
 * 全局扩展管理器实例
 */
const extensionManager = new ExtensionManager();

/**
 * 异步创建动态扩展
 * 确保扩展配置已加载
 * @param _documentId 可选的文档ID，用于提前初始化视图
 */
export const createDynamicExtensions = async (_documentId?: number): Promise<Extension[]> => {
    const extensionStore = useExtensionStore();

    // 注册所有扩展工厂
    registerAllExtensions(extensionManager);

    // 确保扩展配置已加载
    if (extensionStore.extensions.length === 0) {
        await extensionStore.loadExtensions();
    }

    // 初始化扩展管理器配置
    extensionManager.initializeExtensionsFromConfig(extensionStore.extensions);

    // 获取初始扩展配置
    return extensionManager.getInitialExtensions();
};

/**
 * 获取扩展管理器实例
 * @returns 扩展管理器
 */
export const getExtensionManager = (): ExtensionManager => {
    return extensionManager;
};

/**
 * 设置编辑器视图到扩展管理器
 * @param view 编辑器视图
 * @param documentId 文档ID
 */
export const setExtensionManagerView = (view: EditorView, documentId: number): void => {
    extensionManager.setView(view, documentId);
};

/**
 * 从扩展管理器移除编辑器视图
 * @param documentId 文档ID
 */
export const removeExtensionManagerView = (documentId: number): void => {
    extensionManager.removeView(documentId);
};

// 导出相关模块
export {ExtensionManager} from './extensionManager';
export {registerAllExtensions, getExtensionDisplayName, getExtensionDescription} from './extensions';