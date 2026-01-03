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
import {createStatsUpdateExtension} from '@/views/editor/basic/statsExtension';
import {createContentChangePlugin} from '@/views/editor/basic/contentChangeExtension';
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
import {LruCache} from '@/common/utils/lruCache';
import {EDITOR_CONFIG} from '@/common/constant/editor';
import {useEditorStateStore, type DocumentStats} from './editorStateStore';

// 编辑器实例
interface EditorInstance {
    view: EditorView;
    documentId: number;
    contentTimestamp: string;  // 文档时间戳
    contentLength: number;     // 内容长度
    isDirty: boolean;
    lastModified: number;
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
        return cached.contentTimestamp === doc.updated_at 
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
            increaseFontSize: () => configStore.increaseFontSizeLocal(),
            decreaseFontSize: () => configStore.decreaseFontSizeLocal(),
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
            enableAutoDetection: true
        });

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

        return {
            view,
            documentId: docId,
            contentTimestamp: doc.updated_at || '',
            contentLength: content.length,
            isDirty: false,
            lastModified: Date.now()
        };
    };

    // 更新编辑器内容
    const updateEditorContent = (instance: EditorInstance, doc: Document) => {
        const currentContent = instance.view.state.doc.toString();
        const newContent = doc.content || '';

        // 如果内容相同，只更新元数据
        if (currentContent === newContent) {
            instance.contentTimestamp = doc.updated_at || '';
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
            }
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
        instance.contentTimestamp = doc.updated_at || '';
        instance.contentLength = newContent.length;
        instance.isDirty = false;
    };

    // 显示编辑器
    const showEditor = (instance: EditorInstance) => {
        if (!containerElement.value) return;

        try {
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
        instance.lastModified = Date.now();

        // 调度自动保存
        const autoSaveDelay = configStore.config.editing.autoSaveDelay;
        documentStore.scheduleAutoSave(
            docId,
            async () => {
                const content = instance.view.state.doc.toString();
                const savedDoc = await documentStore.saveDocument(docId, content);
                
                // 同步版本信息
                if (savedDoc) {
                    instance.contentTimestamp = savedDoc.updated_at || '';
                    instance.contentLength = (savedDoc.content || '').length;
                    instance.isDirty = false;
                }
            },
            autoSaveDelay
        );
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
                        cached.contentTimestamp = doc.updated_at || '';
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
            } else {
                // 场景4：创建新编辑器
                const editor = await createEditorInstance(docId, doc);
                
                // 添加到缓存
                editorCache.set(docId, editor, (_evictedKey, evictedInstance) => {
                    // 保存光标位置
                    const cursorPos = evictedInstance.view.state.selection.main.head;
                    editorStateStore.saveCursorPosition(evictedInstance.documentId, cursorPos);
                    
                    // 从扩展管理器移除
                    removeExtensionManagerView(evictedInstance.documentId);
                    
                    // 移除 DOM
                    if (evictedInstance.view.dom.parentElement) {
                        evictedInstance.view.dom.remove();
                    }
                    
                    // 销毁编辑器
                    evictedInstance.view.destroy();
                });

                showEditor(editor);
            }
        } catch (error) {
            console.error('Failed to switch editor:', error);
        } finally {
            setTimeout(() => {
                isLoading.value = false;
            }, EDITOR_CONFIG.LOADING_DELAY);
        }
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

    // 同步保存后的版本信息
    const syncAfterSave = async (docId: number) => {
        const instance = editorCache.get(docId);
        if (!instance) return;

        const doc = await documentStore.getDocument(docId);
        if (doc) {
            instance.contentTimestamp = doc.updated_at || '';
            instance.contentLength = (doc.content || '').length;
            instance.isDirty = false;
        }
    };

    // 销毁编辑器
    const destroyEditor = async (docId: number) => {
        const instance = editorCache.get(docId);
        if (!instance) return;

        try {
            // 保存光标位置
            const cursorPos = instance.view.state.selection.main.head;
            editorStateStore.saveCursorPosition(docId, cursorPos);

            // 从扩展管理器移除
            removeExtensionManagerView(docId);

            // 移除 DOM
            if (instance.view.dom && instance.view.dom.parentElement) {
                instance.view.dom.remove();
            }

            // 销毁编辑器
            instance.view.destroy();

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
    const destroyAllEditors = () => {
        editorCache.clear((_documentId, instance) => {
            // 保存光标位置
            const cursorPos = instance.view.state.selection.main.head;
            editorStateStore.saveCursorPosition(instance.documentId, cursorPos);
            
            // 从扩展管理器移除
            removeExtensionManagerView(instance.documentId);
            
            // 移除 DOM
            if (instance.view.dom.parentElement) {
                instance.view.dom.remove();
            }
            
            // 销毁编辑器
            instance.view.destroy();
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
        switchToEditor,
        destroyEditor,
        destroyAllEditors,

        // 查询方法
        getCurrentContent,
        getCurrentCursorPosition,
        hasUnsavedChanges,
        syncAfterSave,

        // 配置应用
        applyFontSettings,
        applyThemeSettings,
        applyTabSettings,
        applyKeymapSettings,
    };
});
