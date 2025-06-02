import {defineStore} from 'pinia';
import {computed, reactive} from 'vue';
import {
    ConfigService
} from '@/../bindings/voidraft/internal/services';
import {EditorConfig, TabType, LanguageType} from '@/../bindings/voidraft/internal/models/models';
import {useLogStore} from './logStore';
import { useI18n } from 'vue-i18n';
import { ConfigUtils } from '@/utils/configUtils';

// 国际化相关导入
export type SupportedLocaleType = 'zh-CN' | 'en-US';

// 支持的语言列表
export const SUPPORTED_LOCALES = [
    {
        code: 'zh-CN' as SupportedLocaleType,
        name: '简体中文'
    },
    {
        code: 'en-US' as SupportedLocaleType,
        name: 'English'
    }
];

// 配置键映射和限制的类型定义
type ConfigKeyMap = {
    readonly [K in keyof EditorConfig]: string;
};

type NumberConfigKey = 'fontSize' | 'tabSize' | 'lineHeight';
type StringConfigKey = 'fontFamily' | 'fontWeight';
type BooleanConfigKey = 'enableTabIndent' | 'alwaysOnTop';
type EnumConfigKey = 'tabType' | 'language';

// 配置键映射
const CONFIG_KEY_MAP: ConfigKeyMap = {
    fontSize: 'editor.font_size',
    fontFamily: 'editor.font_family',
    fontWeight: 'editor.font_weight',
    lineHeight: 'editor.line_height',
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
    lineHeight: { min: 1.0, max: 3.0, default: 1.5 },
    tabType: { values: [TabType.TabTypeSpaces, TabType.TabTypeTab], default: TabType.TabTypeSpaces }
} as const;

// 常用字体选项
export const FONT_OPTIONS = [
    { label: '鸿蒙字体', value: '"HarmonyOS Sans SC", "HarmonyOS Sans", "Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, sans-serif' },
    { label: '微软雅黑', value: '"Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, sans-serif' },
    { label: '苹方字体', value: '"PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif' },
    { label: 'JetBrains Mono', value: '"JetBrains Mono", "Fira Code", "SF Mono", Monaco, Consolas, "Ubuntu Mono", monospace' },
    { label: 'Fira Code', value: '"Fira Code", "JetBrains Mono", "SF Mono", Monaco, Consolas, "Ubuntu Mono", monospace' },
    { label: 'Source Code Pro', value: '"Source Code Pro", "SF Mono", Monaco, Consolas, "Ubuntu Mono", monospace' },
    { label: 'Cascadia Code', value: '"Cascadia Code", "SF Mono", Monaco, Consolas, "Ubuntu Mono", monospace' },
    { label: '系统等宽字体', value: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace' }
] as const;

// 获取浏览器的默认语言
const getBrowserLanguage = (): SupportedLocaleType => {
    const browserLang = navigator.language;
    const langCode = browserLang.split('-')[0];

    // 检查是否支持此语言
    const supportedLang = SUPPORTED_LOCALES.find(locale =>
        locale.code.startsWith(langCode) || locale.code.split('-')[0] === langCode
    );

    return supportedLang?.code || 'zh-CN';
};

// 默认配置
const DEFAULT_CONFIG: EditorConfig = {
    fontSize: CONFIG_LIMITS.fontSize.default,
    fontFamily: FONT_OPTIONS[0].value,
    fontWeight: 'normal',
    lineHeight: CONFIG_LIMITS.lineHeight.default,
    enableTabIndent: true,
    tabSize: CONFIG_LIMITS.tabSize.default,
    tabType: CONFIG_LIMITS.tabType.default,
    language: LanguageType.LangZhCN,
    alwaysOnTop: false
};

export const useConfigStore = defineStore('config', () => {
    const logStore = useLogStore();
    const { t, locale } = useI18n();
    
    // 响应式状态
    const state = reactive({
        config: { ...DEFAULT_CONFIG } as EditorConfig,
        isLoading: false,
        configLoaded: false
    });

    // 计算属性 - 使用工厂函数简化
    const createLimitComputed = (key: NumberConfigKey) => computed(() => CONFIG_LIMITS[key]);
    const limits = {
        fontSize: createLimitComputed('fontSize'),
        tabSize: createLimitComputed('tabSize'),
        lineHeight: createLimitComputed('lineHeight')
    };

    // 错误处理装饰器
    const withErrorHandling = <T extends any[], R>(
        fn: (...args: T) => Promise<R>,
        errorMsg: string,
        successMsg?: string
    ) => async (...args: T): Promise<R | null> => {
        const result = await fn(...args).catch(error => {
            console.error(errorMsg, error);
            logStore.error(t(errorMsg));
            return null;
        });
        
        if (result !== null && successMsg) {
            logStore.info(t(successMsg));
        }
        
        return result;
    };

    // 通用配置更新方法
    const updateConfig = withErrorHandling(
        async <K extends keyof EditorConfig>(key: K, value: EditorConfig[K]): Promise<void> => {
            // 确保配置已加载
            if (!state.configLoaded && !state.isLoading) {
                await initConfig();
            }
            
            const backendKey = CONFIG_KEY_MAP[key];
            if (!backendKey) {
                throw new Error(`No backend key mapping found for ${key.toString()}`);
            }
            
            await ConfigService.Set(backendKey, value);
            state.config[key] = value;
        },
        'config.saveFailed',
        'config.saveSuccess'
    );

    // 加载配置
    const initConfig = withErrorHandling(
        async (): Promise<void> => {
            if (state.isLoading) return;
            
            state.isLoading = true;
            const appConfig = await ConfigService.GetConfig();
            
            if (appConfig?.editor) {
                Object.assign(state.config, appConfig.editor);
            }
            
            state.configLoaded = true;
            state.isLoading = false;
        },
        'config.loadFailed',
        'config.loadSuccess'
    );

    // 数值调整工厂函数
    const createNumberAdjuster = (key: NumberConfigKey) => {
        const limit = CONFIG_LIMITS[key];
        return {
            increase: () => updateConfig(key, ConfigUtils.clamp(state.config[key] + 1, limit.min, limit.max)),
            decrease: () => updateConfig(key, ConfigUtils.clamp(state.config[key] - 1, limit.min, limit.max)),
            set: (value: number) => updateConfig(key, ConfigUtils.clamp(value, limit.min, limit.max)),
            reset: () => updateConfig(key, limit.default)
        };
    };

    // 布尔值切换工厂函数
    const createToggler = (key: BooleanConfigKey) => 
        () => updateConfig(key, !state.config[key]);

    // 枚举值切换工厂函数
    const createEnumToggler = <T extends TabType>(key: 'tabType', values: readonly T[]) =>
        () => {
            const currentIndex = values.indexOf(state.config[key] as T);
            const nextIndex = (currentIndex + 1) % values.length;
            return updateConfig(key, values[nextIndex]);
        };

    // 重置配置
    const resetConfig = withErrorHandling(
        async (): Promise<void> => {
            if (state.isLoading) return;
            
            state.isLoading = true;
            await ConfigService.ResetConfig();
            await initConfig();
            state.isLoading = false;
        },
        'config.resetFailed',
        'config.resetSuccess'
    );

    // 语言设置方法
    const setLanguage = withErrorHandling(
        async (language: LanguageType): Promise<void> => {
            await ConfigService.Set(CONFIG_KEY_MAP.language, language);
            state.config.language = language;
            
            // 同步更新前端语言
            const frontendLocale = ConfigUtils.backendLanguageToFrontend(language);
            locale.value = frontendLocale as any;
        },
        'config.languageChangeFailed',
        'config.languageChanged'
    );

    // 通过前端语言代码设置语言
    const setLocale = async (localeCode: SupportedLocaleType): Promise<void> => {
        const backendLanguage = ConfigUtils.frontendLanguageToBackend(localeCode);
        await setLanguage(backendLanguage);
    };

    // 初始化语言设置
    const initializeLanguage = async (): Promise<void> => {
        try {
            // 如果配置未加载，先加载配置
            if (!state.configLoaded) {
                await initConfig();
            }
            
            // 同步前端语言设置
            const frontendLocale = ConfigUtils.backendLanguageToFrontend(state.config.language);
            locale.value = frontendLocale as any;
        } catch (error) {
            const browserLang = getBrowserLanguage();
            locale.value = browserLang as any;
        }
    };

    // 创建数值调整器
    const fontSize = createNumberAdjuster('fontSize');
    const tabSize = createNumberAdjuster('tabSize');
    const lineHeight = createNumberAdjuster('lineHeight');

    // 创建切换器
    const toggleTabIndent = createToggler('enableTabIndent');
    const toggleAlwaysOnTop = createToggler('alwaysOnTop');
    const toggleTabType = createEnumToggler('tabType', CONFIG_LIMITS.tabType.values);

    // 字符串配置设置器
    const setFontFamily = (value: string) => updateConfig('fontFamily', value);
    const setFontWeight = (value: string) => updateConfig('fontWeight', value);

    return {
        // 状态
        config: computed(() => state.config),
        configLoaded: computed(() => state.configLoaded),
        isLoading: computed(() => state.isLoading),

        // 限制常量
        ...limits,

        // 核心方法
        initConfig,
        resetConfig,
        updateConfig,
        
        // 语言相关方法
        setLanguage,
        setLocale,
        initializeLanguage,
        
        // 字体大小操作
        ...fontSize,
        increaseFontSize: fontSize.increase,
        decreaseFontSize: fontSize.decrease,
        resetFontSize: fontSize.reset,
        setFontSize: fontSize.set,
        
        // Tab操作
        toggleTabIndent,
        ...tabSize,
        increaseTabSize: tabSize.increase,
        decreaseTabSize: tabSize.decrease,
        setTabSize: tabSize.set,
        toggleTabType,
        
        // 行高操作
        setLineHeight: lineHeight.set,
        
        // 窗口操作
        toggleAlwaysOnTop,

        // 字体操作
        setFontFamily,
        setFontWeight,
    };
},{
    persist: true,
});