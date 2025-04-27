import {defineStore} from 'pinia';
import {ref, watch} from 'vue';
import {useDebounceFn} from '@vueuse/core';
import {
    GetEditorConfig,
    ResetToDefault,
    UpdateEditorConfig
} from '@/../bindings/voidraft/internal/services/configservice';
import {EditorConfig, TabType} from '@/../bindings/voidraft/internal/models/models';

// 字体大小范围
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 28;
const DEFAULT_FONT_SIZE = 13;

// Tab设置
const DEFAULT_TAB_SIZE = 4;
const MIN_TAB_SIZE = 2;
const MAX_TAB_SIZE = 8;

export const useConfigStore = defineStore('config', () => {
    // 配置状态
    const config = ref<EditorConfig>(new EditorConfig({
        fontSize: DEFAULT_FONT_SIZE,
        encoding: 'UTF-8',
        enableTabIndent: true,
        tabSize: DEFAULT_TAB_SIZE,
        tabType: TabType.TabTypeSpaces
    }));

    // 配置是否已从后端加载
    const configLoaded = ref(false);

    // 从后端加载配置
    async function loadConfigFromBackend() {
        try {
            const editorConfig = await GetEditorConfig();
            config.value = editorConfig;
            configLoaded.value = true;
        } catch (error) {
            console.error('Failed to load configuration:', error);
        }
    }

    // 使用防抖保存配置到后端
    const saveConfigToBackend = useDebounceFn(async () => {
        try {
            await UpdateEditorConfig(config.value);
        } catch (error) {
            console.error('Failed to save configuration:', error);
        }
    }, 500); // 500ms防抖

    // 监听配置变化，自动保存到后端
    watch(() => config.value, async () => {
        if (configLoaded.value) {
            await saveConfigToBackend();
        }
    }, {deep: true});

    // 字体缩放
    function increaseFontSize() {
        if (config.value.fontSize < MAX_FONT_SIZE) {
            config.value.fontSize += 1;
        }
    }

    // 字体缩小
    function decreaseFontSize() {
        if (config.value.fontSize > MIN_FONT_SIZE) {
            config.value.fontSize -= 1;
        }
    }

    // 重置字体大小
    function resetFontSize() {
        config.value.fontSize = DEFAULT_FONT_SIZE;
    }

    // 设置编码
    function setEncoding(newEncoding: string) {
        config.value.encoding = newEncoding;
    }

    // Tab相关方法
    function toggleTabIndent() {
        config.value.enableTabIndent = !config.value.enableTabIndent;
    }

    // 增加Tab大小
    function increaseTabSize() {
        if (config.value.tabSize < MAX_TAB_SIZE) {
            config.value.tabSize += 1;
        }
    }

    // 减少Tab大小
    function decreaseTabSize() {
        if (config.value.tabSize > MIN_TAB_SIZE) {
            config.value.tabSize -= 1;
        }
    }

    // 切换Tab类型（空格或制表符）
    function toggleTabType() {
        config.value.tabType = config.value.tabType === TabType.TabTypeSpaces
            ? TabType.TabTypeTab
            : TabType.TabTypeSpaces;
    }

    // 重置为默认配置
    async function resetToDefaults() {
        await ResetToDefault();
        await loadConfigFromBackend();
    }
    return {
        // 状态
        config,
        configLoaded,

        // 常量
        MIN_FONT_SIZE,
        MAX_FONT_SIZE,
        DEFAULT_FONT_SIZE,
        MIN_TAB_SIZE,
        MAX_TAB_SIZE,

        // 方法
        loadConfigFromBackend,
        saveConfigToBackend,
        setEncoding,
        increaseFontSize,
        decreaseFontSize,
        resetFontSize,
        toggleTabIndent,
        increaseTabSize,
        decreaseTabSize,
        toggleTabType,
        resetToDefaults
    };
}); 