import {defineStore} from 'pinia';
import {computed, nextTick, ref, watch} from 'vue';
import {EditorView} from '@codemirror/view';
import {EditorState, Extension} from '@codemirror/state';
import {useConfigStore} from './configStore';
import {useDocumentStore} from './documentStore';
import {ExtensionID} from '@/../bindings/voidraft/internal/models/models';
import {DocumentService, ExtensionService} from '@/../bindings/voidraft/internal/services';
import {ensureSyntaxTree} from "@codemirror/language";
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
import createCodeBlockExtension, {blockState} from "@/views/editor/extensions/codeblock";
import {LruCache} from '@/common/utils/lruCache';
import {AsyncManager} from '@/common/utils/asyncManager';
import {generateContentHash} from "@/common/utils/hashUtils";
import {createTimerManager, type TimerManager} from '@/common/utils/timerUtils';
import {EDITOR_CONFIG} from '@/common/constant/editor';
import {createHttpClientExtension} from "@/views/editor/extensions/httpclient";

export interface DocumentStats {
    lines: number;
    characters: number;
    selectedCharacters: number;
}

interface EditorInstance {
    view: EditorView;
    documentId: number;
    content: string;
    isDirty: boolean;
    lastModified: Date;
    autoSaveTimer: TimerManager;
    syntaxTreeCache: {
        lastDocLength: number;
        lastContentHash: string;
        lastParsed: Date;
    } | null;
    editorState?: {
        cursorPos: number;
        scrollTop: number;
    };
}

export const useEditorStore = defineStore('editor', () => {
    // === 依赖store ===
    const configStore = useConfigStore();
    const documentStore = useDocumentStore();
    const extensionStore = useExtensionStore();

    // === 核心状态 ===
    const editorCache = new LruCache<number, EditorInstance>(EDITOR_CONFIG.MAX_INSTANCES);
    const containerElement = ref<HTMLElement | null>(null);

    const currentEditor = ref<EditorView | null>(null);
    const documentStats = ref<DocumentStats>({
        lines: 0,
        characters: 0,
        selectedCharacters: 0
    });
    
    // 编辑器加载状态
    const isLoading = ref(false);

    // 异步操作管理器
    const operationManager = new AsyncManager<number>();

    // 自动保存设置 - 从配置动态获取
    const getAutoSaveDelay = () => configStore.config.editing.autoSaveDelay;

    // === 私有方法 ===

    /**
     * 检查位置是否在代码块分隔符区域内
     */
    const isPositionInDelimiter = (view: EditorView, pos: number): boolean => {
        try {
            const blocks = view.state.field(blockState, false);
            if (!blocks) return false;
            
            for (const block of blocks) {
                if (pos >= block.delimiter.from && pos < block.delimiter.to) {
                    return true;
                }
            }
            return false;
        } catch {
            return false;
        }
    };

    /**
     * 调整光标位置到有效的内容区域
     * 如果位置在分隔符内，移动到该块的内容开始位置
     */
    const adjustCursorPosition = (view: EditorView, pos: number): number => {
        try {
            const blocks = view.state.field(blockState, false);
            if (!blocks || blocks.length === 0) return pos;

            // 如果位置在分隔符内，移动到该块的内容开始位置
            for (const block of blocks) {
                if (pos >= block.delimiter.from && pos < block.delimiter.to) {
                    return block.content.from;
                }
            }
            
            return pos;
        } catch {
            return pos;
        }
    };

    /**
     * 恢复编辑器的光标和滚动位置
     */
    const restoreEditorState = (instance: EditorInstance, documentId: number): void => {
        const savedState = instance.editorState || documentStore.documentStates[documentId];
        
        if (savedState) {
            // 有保存的状态，恢复光标位置和滚动位置
            let pos = Math.min(savedState.cursorPos, instance.view.state.doc.length);
            
            // 确保位置不在分隔符上
            if (isPositionInDelimiter(instance.view, pos)) {
                pos = adjustCursorPosition(instance.view, pos);
            }
            
            instance.view.dispatch({
                selection: {anchor: pos, head: pos}
            });
            
            // 恢复滚动位置
            instance.view.scrollDOM.scrollTop = savedState.scrollTop;
            
            // 更新实例状态
            instance.editorState = savedState;
        } else {
            // 首次打开或没有记录，光标在文档末尾
            const docLength = instance.view.state.doc.length;
            instance.view.dispatch({
                selection: {anchor: docLength, head: docLength},
                scrollIntoView: true
            });
        }
    };

    // 缓存化的语法树确保方法
    const ensureSyntaxTreeCached = (view: EditorView, documentId: number): void => {
        const instance = editorCache.get(documentId);
        if (!instance) return;

        const docLength = view.state.doc.length;
        const content = view.state.doc.toString();
        const contentHash = generateContentHash(content);
        const now = new Date();

        // 检查是否需要重新构建语法树
        const cache = instance.syntaxTreeCache;
        const shouldRebuild = !cache || 
            cache.lastDocLength !== docLength || 
            cache.lastContentHash !== contentHash ||
            (now.getTime() - cache.lastParsed.getTime()) > EDITOR_CONFIG.SYNTAX_TREE_CACHE_TIMEOUT;

        if (shouldRebuild) {
            try {
                ensureSyntaxTree(view.state, docLength, 5000);
                
                // 更新缓存
                instance.syntaxTreeCache = {
                    lastDocLength: docLength,
                    lastContentHash: contentHash,
                    lastParsed: now
                };
            } catch (error) {
                console.warn('Failed to ensure syntax tree:', error);
            }
        }
    };

    // 创建编辑器实例
    const createEditorInstance = async (
        content: string, 
        operationId: number, 
        documentId: number
    ): Promise<EditorView> => {
        if (!containerElement.value) {
            throw new Error('Editor container not set');
        }

        // 检查操作是否仍然有效
        if (!operationManager.isOperationValid(operationId, documentId)) {
            throw new Error('Operation cancelled');
        }

        // 获取基本扩展
        const basicExtensions = createBasicSetup();

        // 获取主题扩展
        const themeExtension = createThemeExtension();

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

        const httpExtension = createHttpClientExtension();

        // 再次检查操作有效性
        if (!operationManager.isOperationValid(operationId, documentId)) {
            throw new Error('Operation cancelled');
        }

        // 快捷键扩展
        const keymapExtension = await createDynamicKeymapExtension();

        // 检查操作有效性
        if (!operationManager.isOperationValid(operationId, documentId)) {
            throw new Error('Operation cancelled');
        }

        // 动态扩展，传递文档ID以便扩展管理器可以预初始化
        const dynamicExtensions = await createDynamicExtensions(documentId);

        // 最终检查操作有效性
        if (!operationManager.isOperationValid(operationId, documentId)) {
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
            ...dynamicExtensions,
            ...httpExtension
        ];

        // 创建编辑器状态
        const state = EditorState.create({
            doc: content,
            extensions
        });

        return new EditorView({
            state
        });
    };

    // 添加编辑器到缓存
    const addEditorToCache = (documentId: number, view: EditorView, content: string) => {
        const instance: EditorInstance = {
            view,
            documentId,
            content,
            isDirty: false,
            lastModified: new Date(),
            autoSaveTimer: createTimerManager(),
            syntaxTreeCache: null
        };

        // 使用LRU缓存的onEvict回调处理被驱逐的实例
        editorCache.set(documentId, instance, (_evictedKey, evictedInstance) => {
            // 清除自动保存定时器
            evictedInstance.autoSaveTimer.clear();
            // 移除DOM元素
            if (evictedInstance.view.dom.parentElement) {
                evictedInstance.view.dom.remove();
            }
            evictedInstance.view.destroy();
        });

        // 初始化语法树缓存
        ensureSyntaxTreeCached(view, documentId);
    };

    // 获取或创建编辑器
    const getOrCreateEditor = async (
        documentId: number, 
        content: string, 
        operationId: number
    ): Promise<EditorView> => {
        // 检查缓存
        const cached = editorCache.get(documentId);
        if (cached) {
            return cached.view;
        }

        // 检查操作是否仍然有效
        if (!operationManager.isOperationValid(operationId, documentId)) {
            throw new Error('Operation cancelled');
        }

        // 创建新的编辑器实例
        const view = await createEditorInstance(content, operationId, documentId);
        
        // 最终检查操作有效性
        if (!operationManager.isOperationValid(operationId, documentId)) {
            // 如果操作已取消，清理创建的实例
            view.destroy();
            throw new Error('Operation cancelled');
        }

        addEditorToCache(documentId, view, content);

        return view;
    };

    // 显示编辑器
    const showEditor = (documentId: number) => {
        const instance = editorCache.get(documentId);
        if (!instance || !containerElement.value) return;

        try {
            // 保存当前编辑器的状态
            if (currentEditor.value) {
                const currentDocId = documentStore.currentDocumentId;
                const currentInstance = currentDocId ? editorCache.get(currentDocId) : null;
                if (currentInstance) {
                    // 保存到实例缓存
                    currentInstance.editorState = {
                        cursorPos: currentEditor.value.state.selection.main.head,
                        scrollTop: currentEditor.value.scrollDOM.scrollTop
                    };
                    // 同时保存到 documentStore 用于持久化
                    if (currentDocId) {
                        documentStore.documentStates[currentDocId] = {
                            cursorPos: currentEditor.value.state.selection.main.head,
                            scrollTop: currentEditor.value.scrollDOM.scrollTop
                        };
                    }
                }
            }

            // 移除当前编辑器DOM
            if (currentEditor.value && currentEditor.value.dom && currentEditor.value.dom.parentElement) {
                currentEditor.value.dom.remove();
            }

            // 确保容器为空
            containerElement.value.innerHTML = '';

            // 将目标编辑器DOM添加到容器
            containerElement.value.appendChild(instance.view.dom);
            currentEditor.value = instance.view;

            // 设置扩展管理器视图
            setExtensionManagerView(instance.view, documentId);

            // 重新测量和聚焦编辑器
            nextTick(() => {
                // 恢复编辑器状态（光标位置和滚动位置）
                restoreEditorState(instance, documentId);
                
                // 聚焦编辑器
                instance.view.focus();
                
                // 使用缓存的语法树确保方法
                ensureSyntaxTreeCached(instance.view, documentId);
            });
        } catch (error) {
            console.error('Error showing editor:', error);
        }
    };

    // 保存编辑器内容
    const saveEditorContent = async (documentId: number): Promise<boolean> => {
        const instance = editorCache.get(documentId);
        if (!instance || !instance.isDirty) return true;

        try {
            const content = instance.view.state.doc.toString();
            const lastModified = instance.lastModified;
            
            await DocumentService.UpdateDocumentContent(documentId, content);

            // 检查在保存期间内容是否又被修改了
            if (instance.lastModified === lastModified) {
                instance.content = content;
                instance.isDirty = false;
                instance.lastModified = new Date();
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
        const instance = editorCache.get(documentId);
        if (!instance) return;

        instance.isDirty = true;
        instance.lastModified = new Date();
        
        // 清理语法树缓存，下次访问时重新构建
        instance.syntaxTreeCache = null;

        // 保存当前编辑器状态（光标位置和滚动位置）
        if (instance.view) {
            instance.editorState = {
                cursorPos: instance.view.state.selection.main.head,
                scrollTop: instance.view.scrollDOM.scrollTop
            };
            // 同时保存到 documentStore 用于持久化
            documentStore.documentStates[documentId] = {
                cursorPos: instance.view.state.selection.main.head,
                scrollTop: instance.view.scrollDOM.scrollTop
            };
        }

        // 设置自动保存定时器
        instance.autoSaveTimer.set(() => {
            saveEditorContent(documentId);
        }, getAutoSaveDelay());
    };

    // === 公共API ===

    // 设置编辑器容器
    const setEditorContainer = (container: HTMLElement | null) => {
        containerElement.value = container;

        // 如果设置容器时已有当前文档，立即加载编辑器
        if (container && documentStore.currentDocument) {
            loadEditor(documentStore.currentDocument.id, documentStore.currentDocument.content);
        }
    };

    // 加载编辑器
    const loadEditor = async (documentId: number, content: string) => {
        // 设置加载状态
        isLoading.value = true;
        
        // 开始新的操作
        const { operationId } = operationManager.startOperation(documentId);

        try {
            // 验证参数
            if (!documentId) {
                throw new Error('Invalid parameters for loadEditor');
            }

            // 保存当前编辑器内容
            if (currentEditor.value) {
                const currentDocId = documentStore.currentDocumentId;
                if (currentDocId && currentDocId !== documentId) {
                    await saveEditorContent(currentDocId);
                    
                    // 检查操作是否仍然有效
                    if (!operationManager.isOperationValid(operationId, documentId)) {
                        return;
                    }
                }
            }

            // 获取或创建编辑器
            const view = await getOrCreateEditor(documentId, content, operationId);

            // 检查操作是否仍然有效
            if (!operationManager.isOperationValid(operationId, documentId)) {
                return;
            }

            // 更新内容（如果需要）
            const instance = editorCache.get(documentId);
            if (instance && instance.content !== content) {
                // 确保编辑器视图有效
                if (view && view.state && view.dispatch) {
                    view.dispatch({
                        changes: {
                            from: 0,
                            to: view.state.doc.length,
                            insert: content
                        }
                    });
                    instance.content = content;
                    instance.isDirty = false;
                    // 清理语法树缓存，因为内容已更新
                    instance.syntaxTreeCache = null;
                }
            }

            // 最终检查操作有效性
            if (!operationManager.isOperationValid(operationId, documentId)) {
                return;
            }

            // 显示编辑器
            showEditor(documentId);

        } catch (error) {
            if (error instanceof Error && error.message === 'Operation cancelled') {
                console.log(`Editor loading cancelled for document ${documentId}`);
            } else {
                console.error('Failed to load editor:', error);
            }
        } finally {
            // 完成操作
            operationManager.completeOperation(operationId);
            
            // 延迟一段时间后再取消加载状态
            setTimeout(() => {
                isLoading.value = false;
            }, EDITOR_CONFIG.LOADING_DELAY);
        }
    };

    // 移除编辑器
    const removeEditor = (documentId: number) => {
        const instance = editorCache.get(documentId);
        if (instance) {
            try {
                // 如果正在加载这个文档，取消操作
                if (operationManager.getCurrentContext() === documentId) {
                    operationManager.cancelAllOperations();
                }

                // 清除自动保存定时器
                instance.autoSaveTimer.clear();

                // 从扩展管理器中移除视图
                removeExtensionManagerView(documentId);

                // 移除DOM元素
                if (instance.view && instance.view.dom && instance.view.dom.parentElement) {
                    instance.view.dom.remove();
                }

                // 销毁编辑器
                if (instance.view && instance.view.destroy) {
                    instance.view.destroy();
                }

                // 清理引用
                if (currentEditor.value === instance.view) {
                    currentEditor.value = null;
                }

                // 从缓存中删除
                editorCache.delete(documentId);
            } catch (error) {
                console.error('Error removing editor:', error);
            }
        }
    };

    // 更新文档统计
    const updateDocumentStats = (stats: DocumentStats) => {
        documentStats.value = stats;
    };

    // 应用字体设置
    const applyFontSettings = () => {
        editorCache.values().forEach(instance => {
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
        editorCache.values().forEach(instance => {
            updateEditorTheme(instance.view);
        });
    };

    // 应用Tab设置
    const applyTabSettings = () => {
        editorCache.values().forEach(instance => {
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
            editorCache.values().map(instance =>
                updateKeymapExtension(instance.view)
            )
        );
    };

    // 清空所有编辑器
    const clearAllEditors = () => {
        // 取消所有挂起的操作
        operationManager.cancelAllOperations();
        
        editorCache.clear((_documentId, instance) => {
            // 在销毁前保存编辑器状态
            if (instance.view) {
                instance.editorState = {
                    cursorPos: instance.view.state.selection.main.head,
                    scrollTop: instance.view.scrollDOM.scrollTop
                };
                // 保存到 documentStore 用于持久化
                documentStore.documentStates[instance.documentId] = {
                    cursorPos: instance.view.state.selection.main.head,
                    scrollTop: instance.view.scrollDOM.scrollTop
                };
            }
            
            // 清除自动保存定时器
            instance.autoSaveTimer.clear();
            
            // 从扩展管理器移除
            removeExtensionManagerView(instance.documentId);
            
            // 移除DOM元素
            if (instance.view.dom.parentElement) {
                instance.view.dom.remove();
            }
            // 销毁编辑器
            instance.view.destroy();
        });

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

        await applyKeymapSettings();
    };

    // 监听文档切换
    watch(() => documentStore.currentDocument, async (newDoc) => {
        if (newDoc && containerElement.value) {
            // 使用 nextTick 确保DOM更新完成后再加载编辑器
            await nextTick(() => {
                loadEditor(newDoc.id, newDoc.content);
            });
        }
    });

    // 创建字体配置的计算属性
    const fontConfig = computed(() => ({
        fontSize: configStore.config.editing.fontSize,
        fontFamily: configStore.config.editing.fontFamily,
        lineHeight: configStore.config.editing.lineHeight,
        fontWeight: configStore.config.editing.fontWeight
    }));
    // 创建Tab配置的计算属性
    const tabConfig = computed(() => ({
        tabSize: configStore.config.editing.tabSize,
        enableTabIndent: configStore.config.editing.enableTabIndent,
        tabType: configStore.config.editing.tabType
    }));
    // 监听字体配置变化
    watch(fontConfig, applyFontSettings, { deep: true });
    // 监听Tab配置变化
    watch(tabConfig, applyTabSettings, { deep: true });

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