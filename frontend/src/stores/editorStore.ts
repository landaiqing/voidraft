import {defineStore} from 'pinia';
import {ref, watch} from 'vue';
import {EditorView} from '@codemirror/view';
import {EditorState, Extension} from '@codemirror/state';
import {useConfigStore} from './configStore';
import {useDocumentStore} from './documentStore';
import {useThemeStore} from './themeStore';
import {useKeybindingStore} from './keybindingStore';
import {SystemThemeType} from '@/../bindings/voidraft/internal/models/models';
import {DocumentService, ExtensionService} from '@/../bindings/voidraft/internal/services';
import {ensureSyntaxTree} from "@codemirror/language"
import {createBasicSetup} from '@/views/editor/basic/basicSetup';
import {createThemeExtension, updateEditorTheme} from '@/views/editor/basic/themeExtension';
import {getTabExtensions, updateTabConfig} from '@/views/editor/basic/tabExtension';
import {createFontExtensionFromBackend, updateFontConfig} from '@/views/editor/basic/fontExtension';
import {createStatsUpdateExtension} from '@/views/editor/basic/statsExtension';
import {createAutoSavePlugin, createSaveShortcutPlugin} from '@/views/editor/basic/autoSaveExtension';
import {createDynamicKeymapExtension, updateKeymapExtension} from '@/views/editor/keymap';
import {createDynamicExtensions, getExtensionManager, setExtensionManagerView} from '@/views/editor/manager';
import {useExtensionStore} from './extensionStore';
import createCodeBlockExtension from "@/views/editor/extensions/codeblock";

export interface DocumentStats {
    lines: number;
    characters: number;
    selectedCharacters: number;
}

export const useEditorStore = defineStore('editor', () => {
    // 引用配置store
    const configStore = useConfigStore();
    const documentStore = useDocumentStore();
    const themeStore = useThemeStore();
    const extensionStore = useExtensionStore();

    // 状态
    const documentStats = ref<DocumentStats>({
        lines: 0,
        characters: 0,
        selectedCharacters: 0
    });
    // 编辑器视图
    const editorView = ref<EditorView | null>(null);
    // 编辑器是否已初始化
    const isEditorInitialized = ref(false);
    // 编辑器容器元素
    const editorContainer = ref<HTMLElement | null>(null);

    // 方法
    function setEditorView(view: EditorView | null) {
        editorView.value = view;
    }

    // 设置编辑器容器
    function setEditorContainer(container: HTMLElement | null) {
        editorContainer.value = container;
        // 如果编辑器已经创建但容器改变了，需要重新挂载
        if (editorView.value && container && editorView.value.dom.parentElement !== container) {
            container.appendChild(editorView.value.dom);
            // 重新挂载后立即滚动到底部
            scrollToBottom(editorView.value as EditorView);
        }
    }

    // 更新文档统计信息
    function updateDocumentStats(stats: DocumentStats) {
        documentStats.value = stats;
    }

    // 应用字体大小
    function applyFontSize() {
        if (!editorView.value) return;
        // 更新编辑器的字体大小
        const editorDOM = editorView.value.dom;
        if (editorDOM) {
            editorDOM.style.fontSize = `${configStore.config.editing.fontSize}px`;
            editorView.value?.requestMeasure();
        }
    }

    // 滚动到文档底部的辅助函数
    const scrollToBottom = (view: EditorView) => {
        if (!view) return;

        const lines = view.state.doc.lines;
        if (lines > 0) {
            const lastLinePos = view.state.doc.line(lines).to;
            view.dispatch({
                effects: EditorView.scrollIntoView(lastLinePos)
            });
        }
    };

    // 创建编辑器
    const createEditor = async (initialDoc: string = '') => {
        if (isEditorInitialized.value || !editorContainer.value) return;

        // 加载文档内容
        await documentStore.initialize();
        const docContent = documentStore.documentContent || initialDoc;

        // 获取基本扩展
        const basicExtensions = createBasicSetup();

        // 获取主题扩展
        const themeExtension = createThemeExtension(
            configStore.config.appearance.systemTheme || SystemThemeType.SystemThemeAuto
        );

        // 获取Tab相关扩展
        const tabExtensions = getTabExtensions(
            configStore.config.editing.tabSize,
            configStore.config.editing.enableTabIndent,
            configStore.config.editing.tabType
        );

        // 创建字体扩展
        const fontExtension = createFontExtensionFromBackend({
            fontFamily: configStore.config.editing.fontFamily,
            fontSize: configStore.config.editing.fontSize,
            lineHeight: configStore.config.editing.lineHeight,
            fontWeight: configStore.config.editing.fontWeight
        });

        // 创建统计信息更新扩展
        const statsExtension = createStatsUpdateExtension(
            updateDocumentStats
        );

        // 创建保存快捷键插件
        const saveShortcutExtension = createSaveShortcutPlugin(() => {
            if (editorView.value) {
                handleManualSave();
            }
        });

        // 创建自动保存插件
        const autoSaveExtension = createAutoSavePlugin({
            debounceDelay: 300, // 300毫秒的输入防抖
            onSave: (success) => {
                if (success) {
                    documentStore.lastSaved = new Date();
                }
            }
        });
        // 代码块功能
        const codeBlockExtension = createCodeBlockExtension({
            showBackground: true,
            enableAutoDetection: true
        });

        // 创建动态快捷键扩展
        const keymapExtension = await createDynamicKeymapExtension();

        // 创建动态扩展
        const dynamicExtensions = await createDynamicExtensions();

        // 组合所有扩展
        const extensions: Extension[] = [
            keymapExtension,
            themeExtension,
            ...basicExtensions,
            ...tabExtensions,
            fontExtension,
            statsExtension,
            saveShortcutExtension,
            autoSaveExtension,
            codeBlockExtension,
            ...dynamicExtensions
        ];

        // 创建编辑器状态
        const state = EditorState.create({
            doc: docContent,
            extensions
        });

        // 创建编辑器视图
        const view = new EditorView({
            state,
            parent: editorContainer.value
        });

        // 将编辑器实例保存到store
        setEditorView(view);

        // 设置编辑器视图到扩展管理器
        setExtensionManagerView(view);

        isEditorInitialized.value = true;

        scrollToBottom(view);

        ensureSyntaxTree(view.state, view.state.doc.length, 5000)

        // 应用初始字体大小
        applyFontSize();
    };

    // 重新配置编辑器
    const reconfigureTabSettings = () => {
        if (!editorView.value) return;
        updateTabConfig(
            editorView.value as EditorView,
            configStore.config.editing.tabSize,
            configStore.config.editing.enableTabIndent,
            configStore.config.editing.tabType
        );
    };

    // 重新配置字体设置
    const reconfigureFontSettings = () => {
        if (!editorView.value) return;
        updateFontConfig(editorView.value as EditorView, {
            fontFamily: configStore.config.editing.fontFamily,
            fontSize: configStore.config.editing.fontSize,
            lineHeight: configStore.config.editing.lineHeight,
            fontWeight: configStore.config.editing.fontWeight
        });
    };

    // 手动保存文档
    const handleManualSave = async () => {
        if (!editorView.value) return;

        const view = editorView.value as EditorView;
        const content = view.state.doc.toString();

        // 先更新内容
        await DocumentService.UpdateActiveDocumentContent(content);
        // 然后调用强制保存方法
        await documentStore.forceSaveDocument();
    };

    // 销毁编辑器
    const destroyEditor = () => {
        if (editorView.value) {
            editorView.value.destroy();
            editorView.value = null;
            isEditorInitialized.value = false;
        }
    };

    // 监听Tab设置变化
    watch([
        () => configStore.config.editing.tabSize,
        () => configStore.config.editing.enableTabIndent,
        () => configStore.config.editing.tabType,
    ], () => {
        reconfigureTabSettings();
    });

    // 监听字体大小变化
    watch([
        () => configStore.config.editing.fontFamily,
        () => configStore.config.editing.fontSize,
        () => configStore.config.editing.lineHeight,
        () => configStore.config.editing.fontWeight,
    ], () => {
        reconfigureFontSettings();
        applyFontSize();
    });

    // 监听主题变化
    watch(() => themeStore.currentTheme, (newTheme) => {
        if (editorView.value && newTheme) {
            updateEditorTheme(editorView.value as EditorView, newTheme);
        }
    });

    // 扩展管理方法
    const updateExtension = async (id: any, enabled: boolean, config?: any) => {
        try {
            // 如果只是更新启用状态
            if (config === undefined) {
                await ExtensionService.UpdateExtensionEnabled(id, enabled)
            } else {
                // 如果需要更新配置
                await ExtensionService.UpdateExtensionState(id, enabled, config)
            }
            
            // 更新前端编辑器扩展
            const manager = getExtensionManager()
            if (manager) {
                manager.updateExtension(id, enabled, config || {})
            }

            // 重新加载扩展配置
            await extensionStore.loadExtensions()
            
            // 更新快捷键映射
            if (editorView.value) {
                updateKeymapExtension(editorView.value)
            }
        } catch (error) {
            throw error
        }
    }

    // 监听扩展状态变化，自动更新快捷键
    watch(() => extensionStore.enabledExtensions.length, () => {
        if (editorView.value) {
            updateKeymapExtension(editorView.value)
        }
    })

    return {
        // 状态
        documentStats,
        editorView,
        isEditorInitialized,
        editorContainer,

        // 方法
        setEditorContainer,
        createEditor,
        reconfigureTabSettings,
        reconfigureFontSettings,
        handleManualSave,
        destroyEditor,
        updateExtension
    };
});