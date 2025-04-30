import {defineStore} from 'pinia';
import {ref, watch} from 'vue';
import {useDebounceFn} from '@vueuse/core';
import {
    ConfigService
} from '@/../bindings/voidraft/internal/services/config';
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

// 配置项限制定义
const CONFIG_LIMITS = {
    fontSize: { min: MIN_FONT_SIZE, max: MAX_FONT_SIZE, default: DEFAULT_FONT_SIZE },
    tabSize: { min: MIN_TAB_SIZE, max: MAX_TAB_SIZE, default: DEFAULT_TAB_SIZE },
    tabType: { values: [TabType.TabTypeSpaces, TabType.TabTypeTab], default: TabType.TabTypeSpaces },
};

export const useConfigStore = defineStore('config', () => {
    // 获取日志store
    const logStore = useLogStore();
    const { t } = useI18n();
    
    // 配置状态
    const config = ref<EditorConfig>(new EditorConfig({
        fontSize: DEFAULT_FONT_SIZE,
        enableTabIndent: true,
        tabSize: DEFAULT_TAB_SIZE,
        tabType: TabType.TabTypeSpaces
    }));

    // 配置是否已从后端加载
    const configLoaded = ref(false);

    // 从后端加载配置
    async function loadConfigFromBackend() {
        try {
            config.value = await ConfigService.GetEditorConfig();
            
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
        if (config.value.fontSize < CONFIG_LIMITS.fontSize.min || config.value.fontSize > CONFIG_LIMITS.fontSize.max) {
            const oldValue = config.value.fontSize;
            config.value.fontSize = oldValue < CONFIG_LIMITS.fontSize.min ? CONFIG_LIMITS.fontSize.min : 
                                   oldValue > CONFIG_LIMITS.fontSize.max ? CONFIG_LIMITS.fontSize.max : 
                                   CONFIG_LIMITS.fontSize.default;
            
            logStore.warning(t('config.fontSizeFixed'));
            
            hasChanges = true;
        }
        
        // 验证Tab大小
        if (config.value.tabSize < CONFIG_LIMITS.tabSize.min || config.value.tabSize > CONFIG_LIMITS.tabSize.max) {
            const oldValue = config.value.tabSize;
            config.value.tabSize = oldValue < CONFIG_LIMITS.tabSize.min ? CONFIG_LIMITS.tabSize.min : 
                                  oldValue > CONFIG_LIMITS.tabSize.max ? CONFIG_LIMITS.tabSize.max : 
                                  CONFIG_LIMITS.tabSize.default;
            
            logStore.warning(t('config.tabSizeFixed'));
            
            hasChanges = true;
        }
        
        // 验证TabType是否合法
        if (!CONFIG_LIMITS.tabType.values.includes(config.value.tabType)) {
            const oldValue = config.value.tabType;
            config.value.tabType = CONFIG_LIMITS.tabType.default;
            
            logStore.warning(t('config.tabTypeFixed'));
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
            await ConfigService.UpdateEditorConfig(config.value);
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

    // 更新特定配置项的类型安全方法
    function updateConfig<K extends keyof EditorConfig>(
        key: K, 
        value: EditorConfig[K] | ((currentValue: EditorConfig[K]) => EditorConfig[K])
    ) {
        if (typeof value === 'function') {
            const currentValue = config.value[key];
            const fn = value as (val: EditorConfig[K]) => EditorConfig[K];
            config.value[key] = fn(currentValue);
        } else {
            config.value[key] = value;
        }
    }

    // 用于数字类型配置的增减方法
    function adjustFontSize(amount: number) {
        let newValue = config.value.fontSize + amount;
        
        if (newValue < MIN_FONT_SIZE) newValue = MIN_FONT_SIZE;
        if (newValue > MAX_FONT_SIZE) newValue = MAX_FONT_SIZE;
        
        config.value.fontSize = newValue;
    }

    function adjustTabSize(amount: number) {
        let newValue = config.value.tabSize + amount;
        
        if (newValue < MIN_TAB_SIZE) newValue = MIN_TAB_SIZE;
        if (newValue > MAX_TAB_SIZE) newValue = MAX_TAB_SIZE;
        
        config.value.tabSize = newValue;
    }

    // Tab相关类型安全的配置切换
    function toggleTabType() {
        config.value.tabType = config.value.tabType === TabType.TabTypeSpaces 
            ? TabType.TabTypeTab 
            : TabType.TabTypeSpaces;
    }

    // 重置为默认配置
    async function resetToDefaults() {
        try {
            await ConfigService.ResetConfig();
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

        // 核心方法
        loadConfigFromBackend,
        saveConfigToBackend,
        updateConfig,
        resetToDefaults,
        
        // 字体大小方法
        increaseFontSize: () => adjustFontSize(1),
        decreaseFontSize: () => adjustFontSize(-1),
        resetFontSize: () => updateConfig('fontSize', DEFAULT_FONT_SIZE),
        
        // Tab操作
        toggleTabIndent: () => updateConfig('enableTabIndent', val => !val),
        increaseTabSize: () => adjustTabSize(1),
        decreaseTabSize: () => adjustTabSize(-1),
        toggleTabType
    };
}); 