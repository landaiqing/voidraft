import {defineStore} from 'pinia';
import {computed, nextTick, ref, watch} from 'vue';
import {EditorView} from '@codemirror/view';
import {EditorState, Extension} from '@codemirror/state';
import {useConfigStore} from './configStore';
import {useDocumentStore} from './documentStore';
import {useThemeStore} from './themeStore';
import {useEditorCacheStore} from './editorCacheStore';
import {ExtensionID, SystemThemeType} from '@/../bindings/voidraft/internal/models/models';
import {DocumentService, ExtensionService} from '@/../bindings/voidraft/internal/services';
import {createBasicSetup} from '@/views/editor/basic/basicSetup';
import {createThemeExtension, updateEditorTheme} from '@/views/editor/basic/themeExtension';
import {getTabExtensions, updateTabConfig} from '@/views/editor/basic/tabExtension';
import {createFontExtensionFromBackend, updateFontConfig} from '@/views/editor/basic/fontExtension';
import {createStatsUpdateExtension} from '@/views/editor/basic/statsExtension';
import {createContentChangePlugin} from '@/views/editor/basic/contentChangeExtension';
import {createDynamicKeymapExtension, updateKeymapExtension} from '@/views/editor/keymap';
import {
    createDynamicExtensions,
    getExtensionManager,
    removeExtensionManagerView,
    setExtensionManagerView
} from '@/views/editor/manager';
import {useExtensionStore} from './extensionStore';
import createCodeBlockExtension from "@/views/editor/extensions/codeblock";
import {AsyncOperationManager} from '@/common/async';

export interface DocumentStats {
    lines: number;
    characters: number;
    selectedCharacters: number;
}

export const useEditorStore = defineStore('editor', () => {
    // === 依赖store ===
    const configStore = useConfigStore();
    const documentStore = useDocumentStore();
    const themeStore = useThemeStore();
    const extensionStore = useExtensionStore();
    const editorCacheStore = useEditorCacheStore();

    // === 核心状态 ===
    const currentEditor = ref<EditorView | null>(null);
    const documentStats = ref<DocumentStats>({
        lines: 0,
        characters: 0,
        selectedCharacters: 0
    });

    // 编辑器加载状态
    const isLoading = ref(false);

    // 异步操作管理器
    const operationManager = new AsyncOperationManager({
        debug: false,
        autoCleanup: true
    });

    // 自动保存设置
    const getAutoSaveDelay = () => configStore.config.editing.autoSaveDelay;

    // === 私有方法 ===

    // 创建编辑器实例
    const createEditorInstance = async (
        content: string,
        signal: AbortSignal,
        documentId: number
    ): Promise<EditorView> => {
        if (!editorCacheStore.getContainer()) {
            throw new Error('Editor container not set');
        }

        // 检查操作是否被取消
        if (signal.aborted) {
            throw new Error('Operation cancelled');
        }

        // 获取基本扩展
        const basicExtensions = createBasicSetup();

        // 获取主题扩展
        const themeExtension = createThemeExtension(
            configStore.config.appearance.systemTheme || SystemThemeType.SystemThemeAuto
        );

        // Tab相关扩展
        const tabExtensions = getTabExtensions(
            configStore.config.editing.tabSize,
            configStore.config.editing.enableTabIndent,
            configStore.config.editing.tabType
        );

        // 字体扩展
        const fontExtension = createFontExtensionFromBackend({
            fontFamily: configStore.config.editing.fontFamily,
            fontSize: configStore.config.editing.fontSize,
            lineHeight: configStore.config.editing.lineHeight,
            fontWeight: configStore.config.editing.fontWeight
        });

        // 统计扩展
        const statsExtension = createStatsUpdateExtension(updateDocumentStats);

        // 内容变化扩展
        const contentChangeExtension = createContentChangePlugin();

        // 代码块扩展
        const codeBlockExtension = createCodeBlockExtension({
            showBackground: true,
            enableAutoDetection: true
        });

        // 再次检查操作是否被取消
        if (signal.aborted) {
            throw new Error('Operation cancelled');
        }

        // 快捷键扩展
        const keymapExtension = await createDynamicKeymapExtension();

        // 检查操作是否被取消
        if (signal.aborted) {
            throw new Error('Operation cancelled');
        }

        // 动态扩展，传递文档ID以便扩展管理器可以预初始化
        const dynamicExtensions = await createDynamicExtensions(documentId);

        // 最终检查操作是否被取消
        if (signal.aborted) {
            throw new Error('Operation cancelled');
        }

        // 组合所有扩展
        const extensions: Extension[] = [
            keymapExtension,
            ...basicExtensions,
            themeExtension,
            ...tabExtensions,
            fontExtension,
            statsExtension,
            contentChangeExtension,
            codeBlockExtension,
            ...dynamicExtensions
        ];

        // 创建编辑器状态
        const state = EditorState.create({
            doc: content,
            extensions
        });

        // 创建编辑器视图
        const view = new EditorView({
            state
        });

        // 将光标定位到文档末尾并滚动到该位置
        const docLength = view.state.doc.length;
        view.dispatch({
            selection: {anchor: docLength, head: docLength},
            scrollIntoView: true
        });

        return view;
    };

    // 获取或创建编辑器
    const getOrCreateEditor = async (
        documentId: number,
        content: string,
        signal: AbortSignal
    ): Promise<EditorView> => {
        // 检查缓存
        const cached = editorCacheStore.getEditor(documentId);
        if (cached) {
            return cached.view;
        }

        // 检查操作是否被取消
        if (signal.aborted) {
            throw new Error('Operation cancelled');
        }

        // 创建新的编辑器实例
        const view = await createEditorInstance(content, signal, documentId);

        // 最终检查操作是否被取消
        if (signal.aborted) {
            // 如果操作已取消，清理创建的实例
            view.destroy();
            throw new Error('Operation cancelled');
        }

        // 添加到缓存
        editorCacheStore.addEditor(documentId, view, content);

        return view;
    };

    // 显示编辑器
    const showEditor = (documentId: number) => {
        const instance = editorCacheStore.getEditor(documentId);
        if (!instance || !editorCacheStore.getContainer()) return;

        try {
            // 移除当前编辑器DOM
            if (currentEditor.value && currentEditor.value.dom && currentEditor.value.dom.parentElement) {
                currentEditor.value.dom.remove();
            }

            // 确保容器为空
            const container = editorCacheStore.getContainer();
            if (container) {
                container.innerHTML = '';

                // 将目标编辑器DOM添加到容器
                container.appendChild(instance.view.dom);
            }

            currentEditor.value = instance.view;

            // 设置扩展管理器视图
            setExtensionManagerView(instance.view, documentId);

            // 重新测量和聚焦编辑器
            nextTick(() => {
                // 将光标定位到文档末尾并滚动到该位置
                const docLength = instance.view.state.doc.length;
                instance.view.dispatch({
                    selection: {anchor: docLength, head: docLength},
                    scrollIntoView: true
                });

                // 滚动到文档底部
                instance.view.focus();

                // 使用缓存的语法树确保方法
                editorCacheStore.ensureSyntaxTreeCached(instance.view, documentId);
            });
        } catch (error) {
            console.error('Error showing editor:', error);
        }
    };

    // 保存编辑器内容
    const saveEditorContent = async (documentId: number): Promise<boolean> => {
        const instance = editorCacheStore.getEditor(documentId);
        if (!instance || !instance.state.isDirty) return true;

        try {
            const content = instance.view.state.doc.toString();
            const lastModified = instance.state.lastModified;

            await DocumentService.UpdateDocumentContent(documentId, content);

            // 检查在保存期间内容是否又被修改了
            if (instance.state.lastModified === lastModified) {
                editorCacheStore.updateEditorContent(documentId, content);
                // isDirty 已在 updateEditorContent 中设置为 false
            }
            // 如果内容在保存期间被修改了，保持 isDirty 状态

            return true;
        } catch (error) {
            console.error('Failed to save editor content:', error);
            return false;
        }
    };

    // 内容变化处理
    const onContentChange = (documentId: number) => {
        const instance = editorCacheStore.getEditor(documentId);
        if (!instance) return;

        editorCacheStore.markEditorDirty(documentId);

        // 清除之前的定时器并设置新的自动保存定时器
        const timer = setTimeout(() => {
            saveEditorContent(documentId);
        }, getAutoSaveDelay());
        editorCacheStore.setAutoSaveTimer(documentId, timer as unknown as number);
    };

    // === 公共API ===

    // 设置编辑器容器
    const setEditorContainer = (container: HTMLElement | null) => {
        editorCacheStore.setContainer(container);

        // 如果设置容器时已有当前文档，立即加载编辑器
        if (container && documentStore.currentDocument) {
            loadEditor(documentStore.currentDocument.id, documentStore.currentDocument.content);
        }
    };

    // 加载编辑器
    const loadEditor = async (documentId: number, content: string) => {
        // 设置加载状态
        isLoading.value = true;

        try {
            // 验证参数
            if (!documentId) {
                throw new Error('Invalid parameters for loadEditor');
            }

            // 使用异步操作管理器执行加载操作
            const result = await operationManager.executeOperation(
                documentId,
                async (signal) => {
                    // 保存当前编辑器内容
                    if (currentEditor.value) {
                        const currentDocId = documentStore.currentDocumentId;
                        if (currentDocId && currentDocId !== documentId) {
                            await saveEditorContent(currentDocId);

                            // 检查操作是否被取消
                            if (signal.aborted) {
                                throw new Error('Operation cancelled');
                            }
                        }
                    }

                    // 获取或创建编辑器
                    const view = await getOrCreateEditor(documentId, content, signal);

                    // 检查操作是否被取消
                    if (signal.aborted) {
                        throw new Error('Operation cancelled');
                    }

                    // 更新内容
                    const instance = editorCacheStore.getEditor(documentId);
                    if (instance && instance.state.content !== content) {
                        // 确保编辑器视图有效
                        if (view && view.state && view.dispatch) {
                            view.dispatch({
                                changes: {
                                    from: 0,
                                    to: view.state.doc.length,
                                    insert: content
                                }
                            });
                            editorCacheStore.updateEditorContent(documentId, content);
                        }
                    }

                    // 最终检查操作是否被取消
                    if (signal.aborted) {
                        throw new Error('Operation cancelled');
                    }

                    // 显示编辑器
                    showEditor(documentId);

                    return view;
                },
                'loadEditor'
            );

            if (!result.success) {
                if (result.error?.message !== 'Operation cancelled') {
                    console.error('Failed to load editor:', result.error);
                }
            }

        } catch (error) {
            console.error('Failed to load editor:', error);
        } finally {
            // 延迟一段时间后再取消加载状态
            setTimeout(() => {
                isLoading.value = false;
            }, 800);
        }
    };

    // 移除编辑器
    const removeEditor = (documentId: number) => {
        // 取消该文档的所有操作
        operationManager.cancelResourceOperations(documentId);

        // 从扩展管理器中移除视图
        removeExtensionManagerView(documentId);

        // 清除当前编辑器引用
        const instance = editorCacheStore.getEditor(documentId);
        if (instance && currentEditor.value === instance.view) {
            currentEditor.value = null;
        }

        // 从缓存中移除编辑器
        editorCacheStore.removeEditor(documentId);
    };

    // 更新文档统计
    const updateDocumentStats = (stats: DocumentStats) => {
        documentStats.value = stats;
    };

    // 应用字体设置
    const applyFontSettings = () => {
        editorCacheStore.allEditors.forEach(instance => {
            updateFontConfig(instance.view, {
                fontFamily: configStore.config.editing.fontFamily,
                fontSize: configStore.config.editing.fontSize,
                lineHeight: configStore.config.editing.lineHeight,
                fontWeight: configStore.config.editing.fontWeight
            });
        });
    };

    // 应用主题设置
    const applyThemeSettings = () => {
        editorCacheStore.allEditors.forEach(instance => {
            updateEditorTheme(instance.view,
                themeStore.currentTheme || SystemThemeType.SystemThemeAuto
            );
        });
    };

    // 应用Tab设置
    const applyTabSettings = () => {
        editorCacheStore.allEditors.forEach(instance => {
            updateTabConfig(
                instance.view,
                configStore.config.editing.tabSize,
                configStore.config.editing.enableTabIndent,
                configStore.config.editing.tabType
            );
        });
    };

    // 应用快捷键设置
    const applyKeymapSettings = async () => {
        // 确保所有编辑器实例的快捷键都更新
        await Promise.all(
            editorCacheStore.allEditors.map(instance =>
                updateKeymapExtension(instance.view)
            )
        );
    };

    // 清理所有编辑器
    const clearAllEditors = () => {
        // 取消所有挂起的操作
        operationManager.cancelAllOperations();

        // 清理所有编辑器
        editorCacheStore.clearAll();

        // 清除当前编辑器引用
        currentEditor.value = null;
    };

    // 更新扩展
    const updateExtension = async (id: ExtensionID, enabled: boolean, config?: any) => {
        // 如果只是更新启用状态
        if (config === undefined) {
            await ExtensionService.UpdateExtensionEnabled(id, enabled);
        } else {
            // 如果需要更新配置
            await ExtensionService.UpdateExtensionState(id, enabled, config);
        }

        // 更新前端编辑器扩展 - 应用于所有实例
        const manager = getExtensionManager();
        if (manager) {
            // 使用立即更新模式，跳过防抖
            manager.updateExtensionImmediate(id, enabled, config || {});
        }

        // 重新加载扩展配置
        await extensionStore.loadExtensions();

        // 不再需要单独更新当前编辑器的快捷键映射，因为扩展管理器会更新所有实例
        // 但我们仍需要确保快捷键配置在所有编辑器上更新
        await applyKeymapSettings();
    };

    // === 配置监听相关的 computed 属性 ===
    
    // 字体相关配置的 computed 属性
    const fontSettings = computed(() => ({
        fontSize: configStore.config.editing.fontSize,
        fontFamily: configStore.config.editing.fontFamily,
        lineHeight: configStore.config.editing.lineHeight,
        fontWeight: configStore.config.editing.fontWeight
    }));

    // Tab相关配置的 computed 属性
    const tabSettings = computed(() => ({
        tabSize: configStore.config.editing.tabSize,
        enableTabIndent: configStore.config.editing.enableTabIndent,
        tabType: configStore.config.editing.tabType
    }));

    // === 配置监听器 ===
    
    // 监听字体配置变化
    watch(fontSettings, applyFontSettings, { deep: true });
    
    // 监听Tab配置变化
    watch(tabSettings, applyTabSettings, { deep: true });
    
    // 监听主题变化
    watch(() => themeStore.currentTheme, applyThemeSettings);

    // 监听文档切换
    watch(() => documentStore.currentDocument, (newDoc) => {
        if (newDoc && editorCacheStore.getContainer()) {
            // 使用 nextTick 确保DOM更新完成后再加载编辑器
            nextTick(() => {
                loadEditor(newDoc.id, newDoc.content);
            });
        }
    });

    return {
        // 状态
        currentEditor,
        documentStats,
        isLoading,

        // 方法
        setEditorContainer,
        loadEditor,
        removeEditor,
        clearAllEditors,
        onContentChange,

        // 配置更新方法
        applyFontSettings,
        applyThemeSettings,
        applyTabSettings,
        applyKeymapSettings,

        // 扩展管理方法
        updateExtension,

        editorView: currentEditor,
    };
});