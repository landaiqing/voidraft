import {defineStore} from 'pinia';
import {computed, nextTick, ref} from 'vue';
import {EditorView} from '@codemirror/view';
import {EditorState, Extension} from '@codemirror/state';
import {useConfigStore} from './configStore';
import {useDocumentStore} from './documentStore';
import {DocumentService, ExtensionService} from '@/../bindings/voidraft/internal/services';
import {ensureSyntaxTree} from "@codemirror/language";
import {createBasicSetup} from '@/views/editor/basic/basicSetup';
import {createThemeExtension, updateEditorTheme} from '@/views/editor/basic/themeExtension';
import {getTabExtensions, updateTabConfig} from '@/views/editor/basic/tabExtension';
import {createFontExtensionFromBackend, updateFontConfig} from '@/views/editor/basic/fontExtension';
import {createStatsUpdateExtension} from '@/views/editor/basic/statsExtension';
import {createContentChangePlugin} from '@/views/editor/basic/contentChangeExtension';
import {createWheelZoomExtension} from '@/views/editor/basic/wheelZoomExtension';
import {createCursorPositionExtension, scrollToCursor} from '@/views/editor/basic/cursorPositionExtension';
import {createDynamicKeymapExtension, updateKeymapExtension} from '@/views/editor/keymap';
import {
    createDynamicExtensions,
    getExtensionManager,
    removeExtensionManagerView,
    setExtensionManagerView
} from '@/views/editor/manager';
import {useExtensionStore} from './extensionStore';
import createCodeBlockExtension from "@/views/editor/extensions/codeblock";
import {LruCache} from '@/common/utils/lruCache';
import {generateContentHash} from "@/common/utils/hashUtils";
import {createTimerManager, type TimerManager} from '@/common/utils/timerUtils';
import {EDITOR_CONFIG} from '@/common/constant/editor';
import {createDebounce} from '@/common/utils/debounce';
import {useKeybindingStore} from "@/stores/keybindingStore";

export interface DocumentStats {
    lines: number;
    characters: number;
    selectedCharacters: number;
}

export interface EditorViewState {
    cursorPos: number;
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
    editorState?: EditorViewState;
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

    // 自动保存设置 - 从配置动态获取
    const getAutoSaveDelay = () => configStore.config.editing.autoSaveDelay;

    // 创建防抖的语法树缓存清理函数
    const debouncedClearSyntaxCache = createDebounce((instance) => {
        if (instance) {
            instance.syntaxTreeCache = null;
        }
    }, {delay: 500}); // 500ms 内的多次输入只清理一次


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
            ensureSyntaxTree(view.state, docLength, 5000);

            // 更新缓存
            instance.syntaxTreeCache = {
                lastDocLength: docLength,
                lastContentHash: contentHash,
                lastParsed: now
            };

        }
    };

    // 创建编辑器实例
    const createEditorInstance = async (
        content: string,
        documentId: number
    ): Promise<EditorView> => {
        if (!containerElement.value) {
            throw new Error('Editor container not set');
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

        const wheelZoomExtension = createWheelZoomExtension({
            increaseFontSize: () => configStore.increaseFontSizeLocal(),
            decreaseFontSize: () => configStore.decreaseFontSizeLocal(),
            onSave: () => configStore.saveFontSize(),
            saveDelay: 1000
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

        // 光标位置持久化扩展
        const cursorPositionExtension = createCursorPositionExtension(documentId);

        // 快捷键扩展
        const keymapExtension = await createDynamicKeymapExtension();

        // 动态扩展，传递文档ID以便扩展管理器可以预初始化
        const dynamicExtensions = await createDynamicExtensions();

        // 组合所有扩展
        const extensions: Extension[] = [
            keymapExtension,
            ...basicExtensions,
            themeExtension,
            ...tabExtensions,
            fontExtension,
            wheelZoomExtension,
            statsExtension,
            contentChangeExtension,
            codeBlockExtension,
            cursorPositionExtension,
            ...dynamicExtensions,
        ];

        // 获取保存的光标位置
        const savedState = documentStore.documentStates[documentId];
        const docLength = content.length;
        const initialCursorPos = savedState?.cursorPos !== undefined
            ? Math.min(savedState.cursorPos, docLength)
            : docLength;


        // 创建编辑器状态，设置初始光标位置
        const state = EditorState.create({
            doc: content,
            extensions,
            selection: {anchor: initialCursorPos, head: initialCursorPos}
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
            syntaxTreeCache: null,
            editorState: documentStore.documentStates[documentId]
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
        content: string
    ): Promise<EditorView> => {
        // 检查缓存
        const cached = editorCache.get(documentId);
        if (cached) {
            return cached.view;
        }

        // 创建新的编辑器实例
        const view = await createEditorInstance(content, documentId);

        addEditorToCache(documentId, view, content);

        return view;
    };

    // 显示编辑器
    const showEditor = (documentId: number) => {
        const instance = editorCache.get(documentId);
        if (!instance || !containerElement.value) return;

        try {
            // 移除当前编辑器DOM
            if (currentEditor.value && currentEditor.value.dom && currentEditor.value.dom.parentElement) {
                currentEditor.value.dom.remove();
            }

            // 将目标编辑器DOM添加到容器
            containerElement.value.appendChild(instance.view.dom);
            currentEditor.value = instance.view;

            // 设置扩展管理器视图
            setExtensionManagerView(instance.view, documentId);

            //使用 nextTick + requestAnimationFrame 确保 DOM 完全渲染
            nextTick(() => {
                requestAnimationFrame(() => {
                    // 滚动到当前光标位置
                    scrollToCursor(instance.view);

                    // 聚焦编辑器
                    instance.view.focus();

                    // 使用缓存的语法树确保方法
                    ensureSyntaxTreeCached(instance.view, documentId);
                });
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

            return true;
        } catch (error) {
            console.error('Failed to save editor content:', error);
            return false;
        }
    };

    // 内容变化处理
    const onContentChange = () => {
        const documentId = documentStore.currentDocumentId;
        if (!documentId) return;
        const instance = editorCache.get(documentId);
        if (!instance) return;

        // 立即设置脏标记和修改时间（切换文档时需要判断）
        instance.isDirty = true;
        instance.lastModified = new Date();

        // 优使用防抖清理语法树缓存
        debouncedClearSyntaxCache.debouncedFn(instance);

        // 设置自动保存定时器（已经是防抖效果：每次重置定时器）
        instance.autoSaveTimer.set(() => {
            saveEditorContent(documentId);
        }, getAutoSaveDelay());
    };


    // 检查容器是否已设置
    const hasContainer = computed(() => containerElement.value !== null);

    // 设置编辑器容器
    const setEditorContainer = (container: HTMLElement | null) => {
        containerElement.value = container;
        // watch 会自动监听并加载编辑器，无需手动调用
    };

    // 加载编辑器
    const loadEditor = async (documentId: number, content: string) => {
        isLoading.value = true;

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

            // 更新内容
            const instance = editorCache.get(documentId);
            if (instance && instance.content !== content) {
                // 确保编辑器视图有效
                if (view && view.state && view.dispatch) {
                    const contentLength = content.length;
                    view.dispatch({
                        changes: {
                            from: 0,
                            to: view.state.doc.length,
                            insert: content
                        },
                        selection: {anchor: contentLength, head: contentLength}
                    });
                    instance.content = content;
                    instance.isDirty = false;
                    // 清理语法树缓存，因为内容已更新
                    instance.syntaxTreeCache = null;
                    // 修复：内容变了，清空光标位置，避免越界
                    instance.editorState = undefined;
                    delete documentStore.documentStates[documentId];
                }
            }

            // 显示编辑器
            showEditor(documentId);

        } catch (error) {
            console.error('Failed to load editor:', error);
        } finally {
            setTimeout(() => {
                isLoading.value = false;
            }, EDITOR_CONFIG.LOADING_DELAY);
        }
    };

    // 移除编辑器
    const removeEditor = async (documentId: number) => {
        const instance = editorCache.get(documentId);
        if (instance) {
            try {
                if (instance.isDirty) {
                    await saveEditorContent(documentId);
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
        editorCache.clear((_documentId, instance) => {
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
    const updateExtension = async (id: number, enabled: boolean, config?: any) => {
        // 更新启用状态
        await ExtensionService.UpdateExtensionEnabled(id, enabled);

        // 如果需要更新配置
        if (config !== undefined) {
            await ExtensionService.UpdateExtensionConfig(id, config);
        }

        // 重新加载扩展配置
        await extensionStore.loadExtensions();

        // 获取更新后的扩展名称
        const extension = extensionStore.extensions.find(ext => ext.id === id);
        if (!extension) return;

        // 更新前端编辑器扩展 - 应用于所有实例
        const manager = getExtensionManager();
        if (manager) {
            // 直接更新前端扩展至所有视图
            manager.updateExtension(extension.name, enabled, config);
        }

        await useKeybindingStore().loadKeyBindings();
        await applyKeymapSettings();
    };

    return {
        // 状态
        currentEditor,
        documentStats,
        isLoading,
        hasContainer,

        // 方法
        setEditorContainer,
        loadEditor,
        removeEditor,
        clearAllEditors,
        onContentChange,

        applyFontSettings,
        applyThemeSettings,
        applyTabSettings,
        applyKeymapSettings,

        // 扩展管理方法
        updateExtension,

        editorView: currentEditor,
    };
});
