import {defineStore} from 'pinia';
import {ref, computed} from 'vue';
import {
    ConfigService
} from '@/../bindings/voidraft/internal/services';
import {EditorConfig, TabType, LanguageType} from '@/../bindings/voidraft/internal/models/models';
import {useLogStore} from './logStore';
import { useI18n } from 'vue-i18n';
import { ConfigUtils } from '@/utils/configUtils';

// 配置键映射 - 前端字段到后端配置键的映射
const CONFIG_KEY_MAP = {
    fontSize: 'editor.font_size',
    enableTabIndent: 'editor.enable_tab_indent',
    tabSize: 'editor.tab_size',
    tabType: 'editor.tab_type',
    language: 'editor.language',
    alwaysOnTop: 'editor.always_on_top'
} as const;

// 配置限制
const CONFIG_LIMITS = {
    fontSize: { min: 12, max: 28, default: 13 },
    tabSize: { min: 2, max: 8, default: 4 },
    tabType: { values: [TabType.TabTypeSpaces, TabType.TabTypeTab], default: TabType.TabTypeSpaces }
} as const;

export const useConfigStore = defineStore('config', () => {
    // 获取日志store
    const logStore = useLogStore();
    const { t } = useI18n();
    
    // 配置状态
    const config = ref<EditorConfig>(new EditorConfig({
        fontSize: CONFIG_LIMITS.fontSize.default,
        enableTabIndent: true,
        tabSize: CONFIG_LIMITS.tabSize.default,
        tabType: CONFIG_LIMITS.tabType.default,
        language: LanguageType.LangZhCN,
        alwaysOnTop: false
    }));

    // 加载状态
    const isLoading = ref(false);
    const configLoaded = ref(false);

    // 计算属性
    const MIN_FONT_SIZE = computed(() => CONFIG_LIMITS.fontSize.min);
    const MAX_FONT_SIZE = computed(() => CONFIG_LIMITS.fontSize.max);
    const MIN_TAB_SIZE = computed(() => CONFIG_LIMITS.tabSize.min);
    const MAX_TAB_SIZE = computed(() => CONFIG_LIMITS.tabSize.max);

    // 从后端加载配置
    async function loadConfig(): Promise<void> {
        if (isLoading.value) return;
        
        isLoading.value = true;
        try {
            const appConfig = await ConfigService.GetConfig();
            
            if (appConfig?.editor) {
                Object.assign(config.value, appConfig.editor);
            }
            
            configLoaded.value = true;
            logStore.info(t('config.loadSuccess'));
        } catch (error) {
            console.error('Failed to load configuration:', error);
            logStore.error(t('config.loadFailed'));
        } finally {
            isLoading.value = false;
        }
    }

    // 更新配置项的通用方法 - 直接调用后端Set方法
    async function updateConfig<K extends keyof EditorConfig>(key: K, value: EditorConfig[K]): Promise<void> {
        if (!configLoaded.value) return;
        
        try {
            const backendKey = CONFIG_KEY_MAP[key];
            await ConfigService.Set(backendKey, value);
            
            // 更新本地状态
            config.value[key] = value;
            
            logStore.info(t('config.saveSuccess'));
        } catch (error) {
            console.error(`Failed to update config ${key}:`, error);
            logStore.error(t('config.saveFailed'));
            throw error;
        }
    }

    // 字体大小操作
    async function adjustFontSize(delta: number): Promise<void> {
        const newSize = ConfigUtils.clamp(config.value.fontSize + delta, CONFIG_LIMITS.fontSize.min, CONFIG_LIMITS.fontSize.max);
        await updateConfig('fontSize', newSize);
    }

    // Tab大小操作
    async function adjustTabSize(delta: number): Promise<void> {
        const newSize = ConfigUtils.clamp(config.value.tabSize + delta, CONFIG_LIMITS.tabSize.min, CONFIG_LIMITS.tabSize.max);
        await updateConfig('tabSize', newSize);
    }

    // 切换操作
    async function toggleTabIndent(): Promise<void> {
        await updateConfig('enableTabIndent', !config.value.enableTabIndent);
    }

    async function toggleTabType(): Promise<void> {
        const newTabType = config.value.tabType === TabType.TabTypeSpaces ? TabType.TabTypeTab : TabType.TabTypeSpaces;
        await updateConfig('tabType', newTabType);
    }

    async function toggleAlwaysOnTop(): Promise<void> {
        await updateConfig('alwaysOnTop', !config.value.alwaysOnTop);
    }

    // 语言设置
    async function setLanguage(language: LanguageType): Promise<void> {
        try {
            await ConfigService.Set(CONFIG_KEY_MAP.language, language);
            config.value.language = language;
            logStore.info(t('config.languageChanged'));
        } catch (error) {
            console.error('Failed to set language:', error);
            logStore.error(t('config.languageChangeFailed'));
            throw error;
        }
    }

    // 重置配置
    async function resetConfig(): Promise<void> {
        if (isLoading.value) return;
        
        try {
            isLoading.value = true;
            await ConfigService.ResetConfig();
            await loadConfig();
            logStore.info(t('config.resetSuccess'));
        } catch (error) {
            console.error('Failed to reset configuration:', error);
            logStore.error(t('config.resetFailed'));
        } finally {
            isLoading.value = false;
        }
    }

    // 设置字体大小
    async function setFontSize(size: number): Promise<void> {
        await updateConfig('fontSize', size);
    }

    // 设置Tab大小
    async function setTabSize(size: number): Promise<void> {
        await updateConfig('tabSize', size);
    }
    
    return {
        // 状态
        config,
        configLoaded,
        isLoading,

        // 计算属性
        MIN_FONT_SIZE,
        MAX_FONT_SIZE,
        MIN_TAB_SIZE,
        MAX_TAB_SIZE,

        // 核心方法
        loadConfig,
        resetConfig,
        setLanguage,
        updateConfig,
        
        // 字体大小操作
        increaseFontSize: () => adjustFontSize(1),
        decreaseFontSize: () => adjustFontSize(-1),
        resetFontSize: () => setFontSize(CONFIG_LIMITS.fontSize.default),
        setFontSize,
        
        // Tab操作
        toggleTabIndent,
        increaseTabSize: () => adjustTabSize(1),
        decreaseTabSize: () => adjustTabSize(-1),
        toggleTabType,
        setTabSize,
        
        // 窗口操作
        toggleAlwaysOnTop
    };
}); 