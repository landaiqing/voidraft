import {defineStore} from 'pinia';
import {ref, watch, inject} from 'vue';
import {useDebounceFn} from '@vueuse/core';
import {
    GetEditorConfig,
    ResetToDefault,
    UpdateEditorConfig
} from '@/../bindings/voidraft/internal/services/configservice';
import {EditorConfig, TabType} from '@/../bindings/voidraft/internal/models/models';
import {useLogStore} from './logStore';
import { useI18n } from 'vue-i18n';

// 字体大小范围
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 28;
const DEFAULT_FONT_SIZE = 13;

// Tab设置
const DEFAULT_TAB_SIZE = 4;
const MIN_TAB_SIZE = 2;
const MAX_TAB_SIZE = 8;

export const useConfigStore = defineStore('config', () => {
    // 获取日志store
    const logStore = useLogStore();
    const { t } = useI18n();
    
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
            config.value = await GetEditorConfig();
            
            // 验证并纠正配置
            validateAndFixConfig();
            
            configLoaded.value = true;
            logStore.info(t('config.loadSuccess'));
        } catch (error) {
            console.error('Failed to load configuration:', error);
            logStore.error(t('config.loadFailed'));
        }
    }
    
    // 验证配置是否在合理范围内，并修正无效值
    function validateAndFixConfig() {
        let hasChanges = false;
        
        // 验证字体大小
        if (config.value.fontSize < MIN_FONT_SIZE || config.value.fontSize > MAX_FONT_SIZE) {
            const oldValue = config.value.fontSize;
            config.value.fontSize = oldValue < MIN_FONT_SIZE ? MIN_FONT_SIZE : 
                                   oldValue > MAX_FONT_SIZE ? MAX_FONT_SIZE : 
                                   DEFAULT_FONT_SIZE;
            
            logStore.warning(t('config.fontSizeFixed', {
                value: oldValue,
                fixed: config.value.fontSize
            }));
            
            hasChanges = true;
        }
        
        // 验证Tab大小
        if (config.value.tabSize < MIN_TAB_SIZE || config.value.tabSize > MAX_TAB_SIZE) {
            const oldValue = config.value.tabSize;
            config.value.tabSize = oldValue < MIN_TAB_SIZE ? MIN_TAB_SIZE : 
                                  oldValue > MAX_TAB_SIZE ? MAX_TAB_SIZE : 
                                  DEFAULT_TAB_SIZE;
            
            logStore.warning(t('config.tabSizeFixed', {
                value: oldValue,
                fixed: config.value.tabSize
            }));
            
            hasChanges = true;
        }
        
        // 验证TabType是否合法
        const validTabTypes = [TabType.TabTypeSpaces, TabType.TabTypeTab];
        if (!validTabTypes.includes(config.value.tabType)) {
            const oldValue = config.value.tabType;
            config.value.tabType = TabType.TabTypeSpaces;
            
            logStore.warning(t('config.tabTypeFixed', { value: oldValue }));
            hasChanges = true;
        }
        
        // 如果配置被修正，保存回后端
        if (hasChanges && configLoaded.value) {
            saveConfigToBackend();
        }
    }

    // 使用防抖保存配置到后端
    const saveConfigToBackend = useDebounceFn(async () => {
        try {
            await UpdateEditorConfig(config.value);
            logStore.info(t('config.saveSuccess'));
        } catch (error) {
            console.error('Failed to save configuration:', error);
            logStore.error(t('config.saveFailed'));
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
        try {
            await ResetToDefault();
            await loadConfigFromBackend();
            logStore.info(t('config.resetSuccess'));
        } catch (error) {
            console.error('Failed to reset configuration:', error);
            logStore.error(t('config.resetFailed'));
        }
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