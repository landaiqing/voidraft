import {defineStore} from 'pinia';
import {ref, watch, nextTick} from 'vue';
import {EditorView} from '@codemirror/view';
import {EditorState, Extension} from '@codemirror/state';
import {useConfigStore} from './configStore';
import {useDocumentStore} from './documentStore';
import {useThemeStore} from './themeStore';
import {SystemThemeType, ExtensionID} from '@/../bindings/voidraft/internal/models/models';
import {DocumentService} from '@/../bindings/voidraft/internal/services';
import {ensureSyntaxTree} from "@codemirror/language"
import {createBasicSetup} from '@/views/editor/basic/basicSetup';
import {createThemeExtension, updateEditorTheme} from '@/views/editor/basic/themeExtension';
import {getTabExtensions, updateTabConfig} from '@/views/editor/basic/tabExtension';
import {createFontExtensionFromBackend, updateFontConfig} from '@/views/editor/basic/fontExtension';
import {createStatsUpdateExtension} from '@/views/editor/basic/statsExtension';
import {createContentChangePlugin} from '@/views/editor/basic/contentChangeExtension';
import {createDynamicKeymapExtension, updateKeymapExtension} from '@/views/editor/keymap';
import {createDynamicExtensions, getExtensionManager, setExtensionManagerView} from '@/views/editor/manager';
import {useExtensionStore} from './extensionStore';
import {ExtensionService} from '@/../bindings/voidraft/internal/services';
import createCodeBlockExtension from "@/views/editor/extensions/codeblock";

const NUM_EDITOR_INSTANCES = 5; // 最多缓存5个编辑器实例

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
    autoSaveTimer: number | null;
}

export const useEditorStore = defineStore('editor', () => {
    // === 依赖store ===
    const configStore = useConfigStore();
    const documentStore = useDocumentStore();
    const themeStore = useThemeStore();
    const extensionStore = useExtensionStore();

    // === 核心状态 ===
    const editorCache = ref<{
        lru: number[];
        instances: Record<number, EditorInstance>;
        containerElement: HTMLElement | null;
    }>({
        lru: [],
        instances: {},
        containerElement: null
    });

    const currentEditor = ref<EditorView | null>(null);
    const documentStats = ref<DocumentStats>({
        lines: 0,
        characters: 0,
        selectedCharacters: 0
    });

    // 自动保存设置 - 从配置动态获取
    const getAutoSaveDelay = () => configStore.config.editing.autoSaveDelay;

    // === 私有方法 ===

    // 创建编辑器实例
    const createEditorInstance = async (content: string): Promise<EditorView> => {
        if (!editorCache.value.containerElement) {
            throw new Error('Editor container not set');
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

        // 快捷键扩展
        const keymapExtension = await createDynamicKeymapExtension();

        // 动态扩展
        const dynamicExtensions = await createDynamicExtensions();

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

        // 初始化语法树
        ensureSyntaxTree(view.state, view.state.doc.length, 5000);

        // 将光标定位到文档末尾
        const docLength = view.state.doc.length;
        view.dispatch({
            selection: { anchor: docLength, head: docLength }
        });

        return view;
    };

    // 添加编辑器到缓存
    const addEditorToCache = (documentId: number, view: EditorView, content: string) => {
        // 如果缓存已满，移除最少使用的编辑器
        if (editorCache.value.lru.length >= NUM_EDITOR_INSTANCES) {
            const oldestId = editorCache.value.lru.shift();
            if (oldestId && editorCache.value.instances[oldestId]) {
                const oldInstance = editorCache.value.instances[oldestId];
                // 清除自动保存定时器
                if (oldInstance.autoSaveTimer) {
                    clearTimeout(oldInstance.autoSaveTimer);
                }
                // 移除DOM元素
                if (oldInstance.view.dom.parentElement) {
                    oldInstance.view.dom.remove();
                }
                oldInstance.view.destroy();
                delete editorCache.value.instances[oldestId];
            }
        }

        // 添加新的编辑器实例
        editorCache.value.instances[documentId] = {
            view,
            documentId,
            content,
            isDirty: false,
            lastModified: new Date(),
            autoSaveTimer: null
        };

        // 添加到LRU列表
        editorCache.value.lru.push(documentId);
    };

    // 更新LRU
    const updateLRU = (documentId: number) => {
        const lru = editorCache.value.lru;
        const index = lru.indexOf(documentId);
        if (index > -1) {
            lru.splice(index, 1);
        }
        lru.push(documentId);
    };

    // 获取或创建编辑器
    const getOrCreateEditor = async (documentId: number, content: string): Promise<EditorView> => {
        // 检查缓存
        const cached = editorCache.value.instances[documentId];
        if (cached) {
            updateLRU(documentId);
            return cached.view;
        }

        // 创建新的编辑器实例
        const view = await createEditorInstance(content);
        addEditorToCache(documentId, view, content);

        return view;
    };

    // 显示编辑器
    const showEditor = (documentId: number) => {
        const instance = editorCache.value.instances[documentId];
        if (!instance || !editorCache.value.containerElement) return;

        try {
            // 移除当前编辑器DOM
            if (currentEditor.value && currentEditor.value.dom && currentEditor.value.dom.parentElement) {
                currentEditor.value.dom.remove();
            }

            // 确保容器为空
            editorCache.value.containerElement.innerHTML = '';

            // 将目标编辑器DOM添加到容器
            editorCache.value.containerElement.appendChild(instance.view.dom);
            currentEditor.value = instance.view;

            // 设置扩展管理器视图
            setExtensionManagerView(instance.view);

            // 更新LRU
            updateLRU(documentId);

            // 重新测量和聚焦编辑器
            nextTick(() => {
                instance.view.requestMeasure();
                // 将光标定位到文档末尾
                const docLength = instance.view.state.doc.length;
                instance.view.dispatch({
                    selection: { anchor: docLength, head: docLength }
                });
                instance.view.focus();
            });
        } catch (error) {
            console.error('Error showing editor:', error);
        }
    };

    // 保存编辑器内容
    const saveEditorContent = async (documentId: number): Promise<boolean> => {
        const instance = editorCache.value.instances[documentId];
        if (!instance || !instance.isDirty) return true;

        try {
            const content = instance.view.state.doc.toString();
            await DocumentService.UpdateDocumentContent(documentId, content);

            instance.content = content;
            instance.isDirty = false;
            instance.lastModified = new Date();

            return true;
        } catch (error) {
            console.error('Failed to save editor content:', error);
            return false;
        }
    };

    // 内容变化处理
    const onContentChange = (documentId: number) => {
        const instance = editorCache.value.instances[documentId];
        if (!instance) return;

        instance.isDirty = true;
        instance.lastModified = new Date();

        // 清除之前的定时器
        if (instance.autoSaveTimer) {
            clearTimeout(instance.autoSaveTimer);
        }

        // 设置新的自动保存定时器
        instance.autoSaveTimer = window.setTimeout(() => {
            saveEditorContent(documentId);
        }, getAutoSaveDelay());
    };

    // === 公共API ===

    // 设置编辑器容器
    const setEditorContainer = (container: HTMLElement | null) => {
        editorCache.value.containerElement = container;
        
        // 如果设置容器时已有当前文档，立即加载编辑器
        if (container && documentStore.currentDocument) {
            loadEditor(documentStore.currentDocument.id, documentStore.currentDocument.content);
        }
    };

    // 加载编辑器
    const loadEditor = async (documentId: number, content: string) => {
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
                }
            }

            // 获取或创建编辑器
            const view = await getOrCreateEditor(documentId, content);

            // 更新内容（如果需要）
            const instance = editorCache.value.instances[documentId];
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
                }
            }

            // 显示编辑器
            showEditor(documentId);

        } catch (error) {
            console.error('Failed to load editor:', error);
        }
    };

    // 移除编辑器
    const removeEditor = (documentId: number) => {
        const instance = editorCache.value.instances[documentId];
        if (instance) {
            try {
                // 清除自动保存定时器
                if (instance.autoSaveTimer) {
                    clearTimeout(instance.autoSaveTimer);
                    instance.autoSaveTimer = null;
                }
                
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
                
                delete editorCache.value.instances[documentId];

                const lruIndex = editorCache.value.lru.indexOf(documentId);
                if (lruIndex > -1) {
                    editorCache.value.lru.splice(lruIndex, 1);
                }
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
        Object.values(editorCache.value.instances).forEach(instance => {
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
        Object.values(editorCache.value.instances).forEach(instance => {
            updateEditorTheme(instance.view,
                themeStore.currentTheme || SystemThemeType.SystemThemeAuto
            );
        });
    };

    // 应用Tab设置
    const applyTabSettings = () => {
        Object.values(editorCache.value.instances).forEach(instance => {
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
        await Promise.all(
            Object.values(editorCache.value.instances).map(instance =>
                updateKeymapExtension(instance.view)
            )
        );
    };

    // 清空所有编辑器
    const clearAllEditors = () => {
        Object.values(editorCache.value.instances).forEach(instance => {
            // 清除自动保存定时器
            if (instance.autoSaveTimer) {
                clearTimeout(instance.autoSaveTimer);
            }
            // 移除DOM元素
            if (instance.view.dom.parentElement) {
                instance.view.dom.remove();
            }
            // 销毁编辑器
            instance.view.destroy();
        });

        editorCache.value.instances = {};
        editorCache.value.lru = [];
        currentEditor.value = null;
    };

    // 更新扩展
    const updateExtension = async (id: ExtensionID, enabled: boolean, config?: any) => {
        try {
            // 如果只是更新启用状态
            if (config === undefined) {
                await ExtensionService.UpdateExtensionEnabled(id, enabled);
            } else {
                // 如果需要更新配置
                await ExtensionService.UpdateExtensionState(id, enabled, config);
            }

            // 更新前端编辑器扩展
            const manager = getExtensionManager();
            if (manager) {
                manager.updateExtension(id, enabled, config || {});
            }

            // 重新加载扩展配置
            await extensionStore.loadExtensions();

            // 更新快捷键映射
            if (currentEditor.value) {
                updateKeymapExtension(currentEditor.value);
            }
        } catch (error) {
            throw error;
        }
    };

    // 监听文档切换
    watch(() => documentStore.currentDocument, (newDoc) => {
        if (newDoc && editorCache.value.containerElement) {
            loadEditor(newDoc.id, newDoc.content);
        }
    });

    // 监听配置变化
    watch(() => configStore.config.editing.fontSize, applyFontSettings);
    watch(() => configStore.config.editing.fontFamily, applyFontSettings);
    watch(() => configStore.config.editing.lineHeight, applyFontSettings);
    watch(() => configStore.config.editing.fontWeight, applyFontSettings);
    watch(() => configStore.config.editing.tabSize, applyTabSettings);
    watch(() => configStore.config.editing.enableTabIndent, applyTabSettings);
    watch(() => configStore.config.editing.tabType, applyTabSettings);
    watch(() => themeStore.currentTheme, applyThemeSettings);

    return {
        // 状态
        currentEditor,
        documentStats,

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