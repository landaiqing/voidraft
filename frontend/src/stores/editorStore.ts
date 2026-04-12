import {defineStore} from 'pinia';
import {computed, readonly, ref} from 'vue';
import {EditorView} from '@codemirror/view';
import {EditorState, Extension} from '@codemirror/state';
import {Document} from '@/../bindings/voidraft/internal/models/ent/models';
import {useConfigStore} from './configStore';
import {useDocumentStore} from './documentStore';
import {createBasicSetup} from '@/views/editor/basic/basicSetup';
import {createThemeExtension, updateEditorTheme} from '@/views/editor/basic/themeExtension';
import {getTabExtensions, updateTabConfig} from '@/views/editor/basic/tabExtension';
import {createFontExtensionFromBackend, updateFontConfig} from '@/views/editor/basic/fontExtension';
import {createCursorBlinkExtension, updateCursorBlinkRate} from '@/views/editor/basic/cursorBlinkExtension';
import {createStatsUpdateExtension} from '@/views/editor/basic/statsExtension';
import {createContentChangePlugin, externalDocumentUpdateAnnotation} from '@/views/editor/basic/contentChangeExtension';
import {createWheelZoomExtension} from '@/views/editor/basic/wheelZoomExtension';
import {createCursorPositionExtension, scrollToCursor} from '@/views/editor/basic/cursorPositionExtension';
import {createFoldStateExtension, restoreFoldState} from '@/views/editor/basic/foldStateExtension';
import {createDynamicKeymapExtension, updateKeymapExtension} from '@/views/editor/keymap';
import {
    createDynamicExtensions,
    removeExtensionManagerView,
    setExtensionManagerView
} from '@/views/editor/manager';
import createCodeBlockExtension from "@/views/editor/extensions/codeblock";
import { applyBlockSeparatorHeightStyle, updateBlockSeparatorHeight } from '@/views/editor/extensions/codeblock';
import {triggerCurrenciesLoaded} from '@/views/editor/extensions/codeblock/commands';
import {LruCache} from '@/common/utils/lruCache';
import {EDITOR_CONFIG} from '@/common/constant/editor';
import {useEditorStateStore, type DocumentStats} from './editorStateStore';
import {DocumentSaveResult} from '@/../bindings/voidraft/internal/services/models';

// 编辑器实例
interface EditorInstance {
    view: EditorView;
    documentId: number;
    baseUpdatedAt: string;
    contentLength: number;     // 内容长度
    isDirty: boolean;
}

interface DocumentContentSnapshot {
    content: string;
    baseUpdatedAt: string;
    hasCachedEditor: boolean;
}

export const useEditorStore = defineStore('editor', () => {
    const configStore = useConfigStore();
    const documentStore = useDocumentStore();
    const editorStateStore = useEditorStateStore();

    const editorCache = new LruCache<number, EditorInstance>(EDITOR_CONFIG.MAX_INSTANCES);
    const containerElement = ref<HTMLElement | null>(null);
    const currentEditorId = ref<number | null>(null);
    const isLoading = ref(false);


    // 验证缓存是否有效
    const isCacheValid = (cached: EditorInstance, doc: Document): boolean => {
        return cached.baseUpdatedAt === doc.updated_at
            && cached.contentLength === (doc.content || '').length;
    };

    // 检查内容是否真的不同
    const hasContentChanged = (cached: EditorInstance, doc: Document): boolean => {
        const currentContent = cached.view.state.doc.toString();
        return currentContent !== (doc.content || '');
    };

    // 创建编辑器实例
    const createEditorInstance = async (
        docId: number,
        doc: Document
    ): Promise<EditorInstance> => {
        if (!containerElement.value) {
            throw new Error('Editor container not set');
        }

        const content = doc.content || '';

        // 基本扩展
        const basicExtensions = createBasicSetup();

        // 主题扩展
        const themeExtension = createThemeExtension();

        // Tab 扩展
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

        // 滚轮缩放扩展
        const wheelZoomExtension = createWheelZoomExtension({
            adjustFontSize: (delta) => {
                const changed = configStore.adjustFontSizeLocal(delta);
                if (!changed) {
                    return;
                }
                applyFontSettings();
            },
            onSave: () => configStore.saveFontSize(),
            saveDelay: 1000
        });

        // 统计扩展
        const statsExtension = createStatsUpdateExtension((stats: DocumentStats) => {
            if (currentEditorId.value) {
                editorStateStore.saveDocumentStats(currentEditorId.value, stats);
            }
        });

        // 内容变化扩展
        const contentChangeExtension = createContentChangePlugin(() => {
            handleContentChange(docId);
        });

        // 代码块扩展
        const codeBlockExtension = createCodeBlockExtension({
            showBackground: true,
            enableAutoDetection: true,
            defaultLanguage: (configStore.config.editing.defaultBlockLanguage || 'text') as any,
            separatorHeight: configStore.config.editing.blockSeparatorHeight,
        });

        // 光标闪烁扩展
        const cursorBlinkExtension = createCursorBlinkExtension(
            configStore.config.appearance.cursorBlinkRate
        );

        // 光标位置持久化扩展
        const cursorPositionExtension = createCursorPositionExtension(docId);

        // 折叠状态持久化扩展
        const foldStateExtension = createFoldStateExtension(docId);

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
            cursorBlinkExtension,
            wheelZoomExtension,
            statsExtension,
            contentChangeExtension,
            codeBlockExtension,
            cursorPositionExtension,
            foldStateExtension,
            ...dynamicExtensions,
        ];

        // 获取保存的光标位置
        const savedCursorPos = editorStateStore.getCursorPosition(docId);
        const docLength = content.length;
        const initialCursorPos = savedCursorPos !== undefined
            ? Math.min(savedCursorPos, docLength)
            : docLength;

        // 创建编辑器状态
        const state = EditorState.create({
            doc: content,
            extensions,
            selection: {anchor: initialCursorPos, head: initialCursorPos}
        });

        const view = new EditorView({state});
        applyBlockSeparatorHeightStyle(view, configStore.config.editing.blockSeparatorHeight);

        return {
            view,
            documentId: docId,
            baseUpdatedAt: doc.updated_at || '',
            contentLength: content.length,
            isDirty: false
        };
    };

    const getFontConfigSnapshot = () => ({
        fontFamily: configStore.config.editing.fontFamily,
        fontSize: configStore.config.editing.fontSize,
        lineHeight: configStore.config.editing.lineHeight,
        fontWeight: configStore.config.editing.fontWeight
    });

    const applyFontSettingsToView = (view: EditorView) => {
        updateFontConfig(view, getFontConfigSnapshot());
    };

    // 更新编辑器内容
    const updateEditorContent = (instance: EditorInstance, doc: Document) => {
        const currentContent = instance.view.state.doc.toString();
        const newContent = doc.content || '';

        // 如果内容相同，只更新元数据
        if (currentContent === newContent) {
            instance.baseUpdatedAt = doc.updated_at || '';
            instance.contentLength = newContent.length;
            return;
        }

        // 保存当前光标位置
        const currentCursorPos = instance.view.state.selection.main.head;

        // 更新内容
        instance.view.dispatch({
            changes: {
                from: 0,
                to: instance.view.state.doc.length,
                insert: newContent
            },
            annotations: externalDocumentUpdateAnnotation.of(true)
        });

        // 智能恢复光标位置
        const newContentLength = newContent.length;
        const safeCursorPos = Math.min(currentCursorPos, newContentLength);

        if (safeCursorPos > 0 && safeCursorPos < newContentLength) {
            instance.view.dispatch({
                selection: {anchor: safeCursorPos, head: safeCursorPos}
            });
        }

        // 同步元数据
        instance.baseUpdatedAt = doc.updated_at || '';
        instance.contentLength = newContent.length;
        instance.isDirty = false;
    };

    // 显示编辑器
    const showEditor = (instance: EditorInstance) => {
        if (!containerElement.value) return;

        try {
            applyFontSettingsToView(instance.view);
            applyBlockSeparatorHeightStyle(instance.view, configStore.config.editing.blockSeparatorHeight);
            // 移除当前编辑器 DOM
            const currentEditor = editorCache.get(currentEditorId.value || 0);
            if (currentEditor && currentEditor.view.dom && currentEditor.view.dom.parentElement) {
                currentEditor.view.dom.remove();
            }

            // 添加目标编辑器 DOM
            containerElement.value.appendChild(instance.view.dom);
            currentEditorId.value = instance.documentId;

            // 设置扩展管理器视图
            setExtensionManagerView(instance.view, instance.documentId);

            // 使用 requestAnimationFrame 确保 DOM 渲染
            requestAnimationFrame(() => {
                scrollToCursor(instance.view);
                instance.view.focus();
                
                // 恢复折叠状态
                const savedFoldState = editorStateStore.getFoldState(instance.documentId);
                if (savedFoldState.length > 0) {
                    restoreFoldState(instance.view, savedFoldState);
                }
            });
        } catch (error) {
            console.error('Error showing editor:', error);
        }
    };

    // 内容变化处理
    const handleContentChange = (docId: number) => {
        const instance = editorCache.get(docId);
        if (!instance) return;

        // 标记为脏数据
        instance.isDirty = true;

        // 调度自动保存
        const autoSaveDelay = configStore.config.editing.autoSaveDelay;
        documentStore.scheduleAutoSave(
            docId,
            async () => {
                await saveEditorInstance(instance);
            },
            autoSaveDelay
        );
    };

    const saveDirtyEditor = async (docId: number): Promise<DocumentSaveResult | null> => {
        const instance = editorCache.get(docId);
        if (!instance) {
            return null;
        }
        return await saveEditorInstance(instance);
    };

    const saveAllDirtyEditors = async (): Promise<void> => {
        const dirtyEditors = editorCache.values().filter(instance => instance.isDirty);
        for (const instance of dirtyEditors) {
            await saveEditorInstance(instance);
        }
    };

    const renderEditor = async (docId: number, doc: Document) => {
        const cached = editorCache.get(docId);

        if (cached) {
            // 场景1：缓存有效
            if (isCacheValid(cached, doc)) {
                showEditor(cached);
                return;
            }

            // 场景2：有未保存修改
            if (cached.isDirty) {
                // 检查内容是否真的不同
                if (!hasContentChanged(cached, doc)) {
                    // 内容实际相同，只是元数据变了，同步元数据
                    cached.baseUpdatedAt = doc.updated_at || '';
                    cached.contentLength = (doc.content || '').length;
                    cached.isDirty = false;
                }
                // 内容不同，保留用户编辑
                showEditor(cached);
                return;
            }

            // 场景3：缓存失效且无脏数据，更新内容
            updateEditorContent(cached, doc);
            showEditor(cached);
            return;
        }

        // 场景4：创建新编辑器
        const editor = await createEditorInstance(docId, doc);

        // 添加到缓存
        editorCache.set(docId, editor, (_evictedKey, evictedInstance) => {
            disposeEditorInstance(evictedInstance);
        });

        showEditor(editor);
    };

    const loadEditor = async (doc: Document) => {
        if (doc.id === undefined) {
            return;
        }
        isLoading.value = true;

        try {
            await renderEditor(doc.id, doc);
        } catch (error) {
            console.error('Failed to load editor:', error);
        } finally {
            setTimeout(() => {
                isLoading.value = false;
            }, EDITOR_CONFIG.LOADING_DELAY);
        }
    };

    // 切换到指定编辑器
    const switchToEditor = async (docId: number) => {
        isLoading.value = true;

        try {
            // 直接从后端获取文档
            const doc = await documentStore.getDocument(docId);
            if (!doc) {
                throw new Error(`Failed to load document ${docId}`);
            }

            await renderEditor(docId, doc);
        } catch (error) {
            console.error('Failed to switch editor:', error);
        } finally {
            setTimeout(() => {
                isLoading.value = false;
            }, EDITOR_CONFIG.LOADING_DELAY);
        }
    };

    const getDocumentSnapshot = async (docId: number): Promise<DocumentContentSnapshot | null> => {
        const instance = editorCache.get(docId);
        if (instance) {
            return {
                content: instance.view.state.doc.toString(),
                baseUpdatedAt: instance.baseUpdatedAt,
                hasCachedEditor: true,
            };
        }

        const doc = await documentStore.getDocument(docId);
        if (!doc) {
            return null;
        }

        return {
            content: doc.content || '',
            baseUpdatedAt: doc.updated_at || '',
            hasCachedEditor: false,
        };
    };

    const applyDocumentContent = (
        docId: number,
        content: string,
        options: { selection?: number } = {}
    ): boolean => {
        const instance = editorCache.get(docId);
        if (!instance) {
            return false;
        }

        const currentContent = instance.view.state.doc.toString();
        const selection = options.selection !== undefined
            ? Math.max(0, Math.min(options.selection, content.length))
            : undefined;

        if (currentContent === content) {
            if (selection !== undefined) {
                instance.view.dispatch({
                    selection: { anchor: selection, head: selection }
                });
            }
            return true;
        }

        instance.view.dispatch({
            changes: {
                from: 0,
                to: instance.view.state.doc.length,
                insert: content
            },
            annotations: [externalDocumentUpdateAnnotation.of(true)],
            ...(selection !== undefined
                ? { selection: { anchor: selection, head: selection } }
                : {})
        });

        instance.contentLength = content.length;
        instance.isDirty = true;

        documentStore.scheduleAutoSave(
            docId,
            async () => {
                await saveEditorInstance(instance);
            },
            configStore.config.editing.autoSaveDelay
        );

        return true;
    };

    // 获取当前内容
    const getCurrentContent = (): string => {
        if (!currentEditorId.value) return '';
        const instance = editorCache.get(currentEditorId.value);
        return instance ? instance.view.state.doc.toString() : '';
    };

    // 获取当前光标位置
    const getCurrentCursorPosition = (): number => {
        if (!currentEditorId.value) return 0;
        const instance = editorCache.get(currentEditorId.value);
        return instance ? instance.view.state.selection.main.head : 0;
    };

    // 检查是否有未保存修改
    const hasUnsavedChanges = (docId: number): boolean => {
        const instance = editorCache.get(docId);
        return instance?.isDirty || false;
    };

    // 销毁编辑器
    const destroyEditor = async (docId: number) => {
        const instance = editorCache.get(docId);
        if (!instance) return;

        try {
            disposeEditorInstance(instance);

            // 从缓存删除
            editorCache.delete(docId);

            // 清空当前编辑器引用
            if (currentEditorId.value === docId) {
                currentEditorId.value = null;
            }
        } catch (error) {
            console.error('Error destroying editor:', error);
        }
    };

    // 清空所有编辑器
    const clearEditorCache = () => {
        editorCache.clear((_documentId, instance) => {
            disposeEditorInstance(instance);
        });

        currentEditorId.value = null;
    };

    // 设置编辑器容器
    const setEditorContainer = (container: HTMLElement | null) => {
        containerElement.value = container;
    };


    // 应用字体设置
    const applyFontSettings = () => {
        editorCache.values().forEach(instance => {
            if (!instance.view.dom.isConnected) {
                return;
            }
            applyFontSettingsToView(instance.view);
        });
    };

    // 应用主题设置
    const applyThemeSettings = () => {
        editorCache.values().forEach(instance => {
            updateEditorTheme(instance.view);
        });
    };

    // 应用 Tab 设置
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
        await Promise.all(
            editorCache.values().map(instance =>
                updateKeymapExtension(instance.view)
            )
        );
    };

    const applyCursorBlinkSettings = () => {
        editorCache.values().forEach(instance => {
            updateCursorBlinkRate(instance.view, configStore.config.appearance.cursorBlinkRate);
        });
    };

    const applyBlockSeparatorSettings = () => {
        editorCache.values().forEach(instance => {
            updateBlockSeparatorHeight(instance.view, configStore.config.editing.blockSeparatorHeight);
        });
    };

    const triggerCurrencyRefresh = () => {
        editorCache.values().forEach(instance => {
            triggerCurrenciesLoaded({
                state: instance.view.state,
                dispatch: (transaction: any) => instance.view.dispatch(transaction),
            });
        });
    };

    const hasContainer = computed(() => containerElement.value !== null);
    const currentEditor = computed(() => {
        if (!currentEditorId.value) return null;
        const instance = editorCache.get(currentEditorId.value);
        return instance ? instance.view : null;
    });

    return {
        // 状态
        currentEditorId: readonly(currentEditorId),
        currentEditor,
        isLoading: readonly(isLoading),
        hasContainer,

        // 编辑器管理
        setEditorContainer,
        loadEditor,
        switchToEditor,
        destroyEditor,
        clearEditorCache,
        getDocumentSnapshot,
        applyDocumentContent,

        // 查询方法
        getCurrentContent,
        getCurrentCursorPosition,
        hasUnsavedChanges,
        saveDirtyEditor,
        saveAllDirtyEditors,

        // 配置应用
        applyFontSettings,
        applyThemeSettings,
        applyTabSettings,
        applyKeymapSettings,
        applyCursorBlinkSettings,
        applyBlockSeparatorSettings,
        triggerCurrencyRefresh,
    };

    async function saveEditorInstance(instance: EditorInstance): Promise<DocumentSaveResult | null> {
        if (editorCache.get(instance.documentId) !== instance || !instance.isDirty) {
            return null;
        }

        const content = instance.view.state.doc.toString();
        const savedDoc = await documentStore.saveDocument(instance.documentId, content, instance.baseUpdatedAt);

        instance.baseUpdatedAt = savedDoc.updated_at || '';
        instance.contentLength = savedDoc.content_length ?? content.length;

        if (instance.view.state.doc.toString() === content) {
            instance.isDirty = false;
            documentStore.cancelAutoSave(instance.documentId);
        }

        return savedDoc;
    }

    function disposeEditorInstance(instance: EditorInstance) {
        const cursorPos = instance.view.state.selection.main.head;
        editorStateStore.saveCursorPosition(instance.documentId, cursorPos);
        documentStore.cancelAutoSave(instance.documentId);
        removeExtensionManagerView(instance.documentId);

        if (instance.view.dom.parentElement) {
            instance.view.dom.remove();
        }

        instance.view.destroy();
    }
});
