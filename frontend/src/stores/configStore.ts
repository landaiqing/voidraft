import {defineStore} from 'pinia';
import {computed, reactive} from 'vue';
import {ConfigService, StartupService} from '../../bindings/voidraft/internal/services';
import {
    AppConfig,
    AppearanceConfig,
    EditingConfig,
    GeneralConfig,
    LanguageType,
    SystemThemeType,
    TabType,
} from '@/../bindings/voidraft/internal/models/models';
import {useI18n} from 'vue-i18n';
import {useErrorHandler} from '@/utils/errorHandler';
import {ConfigUtils} from '@/utils/configUtils';
import {WindowController} from '@/utils/windowController';
import * as runtime from '@wailsio/runtime';
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
] as const;

// 配置键映射和限制的类型定义
type GeneralConfigKeyMap = {
    readonly [K in keyof GeneralConfig]: string;
};

type EditingConfigKeyMap = {
    readonly [K in keyof EditingConfig]: string;
};

type AppearanceConfigKeyMap = {
    readonly [K in keyof AppearanceConfig]: string;
};

type NumberConfigKey = 'fontSize' | 'tabSize' | 'lineHeight';

// 配置键映射
const GENERAL_CONFIG_KEY_MAP: GeneralConfigKeyMap = {
    alwaysOnTop: 'general.alwaysOnTop',
    dataPath: 'general.dataPath',
    enableSystemTray: 'general.enableSystemTray',
    startAtLogin: 'general.startAtLogin',
    enableGlobalHotkey: 'general.enableGlobalHotkey',
    globalHotkey: 'general.globalHotkey'
} as const;

const EDITING_CONFIG_KEY_MAP: EditingConfigKeyMap = {
    fontSize: 'editing.fontSize',
    fontFamily: 'editing.fontFamily',
    fontWeight: 'editing.fontWeight',
    lineHeight: 'editing.lineHeight',
    enableTabIndent: 'editing.enableTabIndent',
    tabSize: 'editing.tabSize',
    tabType: 'editing.tabType',
    autoSaveDelay: 'editing.autoSaveDelay'
} as const;

const APPEARANCE_CONFIG_KEY_MAP: AppearanceConfigKeyMap = {
    language: 'appearance.language',
    systemTheme: 'appearance.systemTheme'
} as const;

// 配置限制
const CONFIG_LIMITS = {
    fontSize: {min: 12, max: 28, default: 13},
    tabSize: {min: 2, max: 8, default: 4},
    lineHeight: {min: 1.0, max: 3.0, default: 1.5},
    tabType: {values: [TabType.TabTypeSpaces, TabType.TabTypeTab], default: TabType.TabTypeSpaces}
} as const;

// 常用字体选项
export const FONT_OPTIONS = [
    {
        label: '鸿蒙字体',
        value: '"HarmonyOS Sans SC", "HarmonyOS Sans", "Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, sans-serif'
    },
    {label: '微软雅黑', value: '"Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, sans-serif'},
    {label: '苹方字体', value: '"PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif'},
    {
        label: 'JetBrains Mono',
        value: '"JetBrains Mono", "Fira Code", "SF Mono", Monaco, Consolas, "Ubuntu Mono", monospace'
    },
    {label: 'Fira Code', value: '"Fira Code", "JetBrains Mono", "SF Mono", Monaco, Consolas, "Ubuntu Mono", monospace'},
    {label: 'Source Code Pro', value: '"Source Code Pro", "SF Mono", Monaco, Consolas, "Ubuntu Mono", monospace'},
    {label: 'Cascadia Code', value: '"Cascadia Code", "SF Mono", Monaco, Consolas, "Ubuntu Mono", monospace'},
    {
        label: '系统等宽字体',
        value: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace'
    }
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
const DEFAULT_CONFIG: AppConfig = {
    general: {
        alwaysOnTop: false,
        dataPath: '',
        enableSystemTray: true,
        startAtLogin: false,
        enableGlobalHotkey: false,
        globalHotkey: {
            ctrl: false,
            shift: false,
            alt: true,
            win: false,
            key: 'X'
        }
    },
    editing: {
        fontSize: CONFIG_LIMITS.fontSize.default,
        fontFamily: FONT_OPTIONS[0].value,
        fontWeight: 'normal',
        lineHeight: CONFIG_LIMITS.lineHeight.default,
        enableTabIndent: true,
        tabSize: CONFIG_LIMITS.tabSize.default,
        tabType: CONFIG_LIMITS.tabType.default,
        autoSaveDelay: 5000
    },
    appearance: {
        language: LanguageType.LangZhCN,
        systemTheme: SystemThemeType.SystemThemeDark
    },
    updates: {},
    metadata: {
        lastUpdated: new Date().toString()
    }
};


export const useConfigStore = defineStore('config', () => {
    const {locale} = useI18n();
    const {safeCall} = useErrorHandler();

    // 响应式状态
    const state = reactive({
        config: {...DEFAULT_CONFIG} as AppConfig,
        isLoading: false,
        configLoaded: false
    });

    // 计算属性 - 使用工厂函数简化
    const createLimitComputed = (key: NumberConfigKey) => computed(() => CONFIG_LIMITS[key]);
    const limits = Object.fromEntries(
        (['fontSize', 'tabSize', 'lineHeight'] as const).map(key => [key, createLimitComputed(key)])
    ) as Record<NumberConfigKey, ReturnType<typeof createLimitComputed>>;

    // 通用配置更新方法
    const updateGeneralConfig = async <K extends keyof GeneralConfig>(key: K, value: GeneralConfig[K]): Promise<void> => {
        // 确保配置已加载
        if (!state.configLoaded && !state.isLoading) {
            await initConfig();
        }

        const backendKey = GENERAL_CONFIG_KEY_MAP[key];
        if (!backendKey) {
            throw new Error(`No backend key mapping found for general.${key.toString()}`);
        }

        await ConfigService.Set(backendKey, value);
        state.config.general[key] = value;
    };

    const updateEditingConfig = async <K extends keyof EditingConfig>(key: K, value: EditingConfig[K]): Promise<void> => {
        // 确保配置已加载
        if (!state.configLoaded && !state.isLoading) {
            await initConfig();
        }

        const backendKey = EDITING_CONFIG_KEY_MAP[key];
        if (!backendKey) {
            throw new Error(`No backend key mapping found for editing.${key.toString()}`);
        }

        await ConfigService.Set(backendKey, value);
        state.config.editing[key] = value;
    };

    const updateAppearanceConfig = async <K extends keyof AppearanceConfig>(key: K, value: AppearanceConfig[K]): Promise<void> => {
        // 确保配置已加载
        if (!state.configLoaded && !state.isLoading) {
            await initConfig();
        }

        const backendKey = APPEARANCE_CONFIG_KEY_MAP[key];
        if (!backendKey) {
            throw new Error(`No backend key mapping found for appearance.${key.toString()}`);
        }

        await ConfigService.Set(backendKey, value);
        state.config.appearance[key] = value;
    };

    // 加载配置
    const initConfig = async (): Promise<void> => {
        if (state.isLoading) return;

        state.isLoading = true;
        try {
            const appConfig = await ConfigService.GetConfig();

            if (appConfig) {
                // 合并配置
                if (appConfig.general) Object.assign(state.config.general, appConfig.general);
                if (appConfig.editing) Object.assign(state.config.editing, appConfig.editing);
                if (appConfig.appearance) Object.assign(state.config.appearance, appConfig.appearance);
                if (appConfig.updates) Object.assign(state.config.updates, appConfig.updates);
                if (appConfig.metadata) Object.assign(state.config.metadata, appConfig.metadata);
            }

            state.configLoaded = true;

            // 初始化热键监听器
            const windowController = WindowController.getInstance();
            await windowController.initializeHotkeyListener();
        } finally {
            state.isLoading = false;
        }
    };

    // 通用数值调整器工厂
    const createAdjuster = <T extends NumberConfigKey>(key: T) => {
        const limit = CONFIG_LIMITS[key];
        const clamp = (value: number) => ConfigUtils.clamp(value, limit.min, limit.max);

        return {
            increase: () => safeCall(() => updateEditingConfig(key, clamp(state.config.editing[key] + 1)), 'config.saveFailed', 'config.saveSuccess'),
            decrease: () => safeCall(() => updateEditingConfig(key, clamp(state.config.editing[key] - 1)), 'config.saveFailed', 'config.saveSuccess'),
            set: (value: number) => safeCall(() => updateEditingConfig(key, clamp(value)), 'config.saveFailed', 'config.saveSuccess'),
            reset: () => safeCall(() => updateEditingConfig(key, limit.default), 'config.saveFailed', 'config.saveSuccess')
        };
    };

    // 通用布尔值切换器
    const createGeneralToggler = <T extends keyof GeneralConfig>(key: T) =>
        () => safeCall(() => updateGeneralConfig(key, !state.config.general[key] as GeneralConfig[T]), 'config.saveFailed', 'config.saveSuccess');

    const createEditingToggler = <T extends keyof EditingConfig>(key: T) =>
        () => safeCall(() => updateEditingConfig(key, !state.config.editing[key] as EditingConfig[T]), 'config.saveFailed', 'config.saveSuccess');

    // 枚举值切换器
    const createEnumToggler = <T extends TabType>(key: 'tabType', values: readonly T[]) =>
        () => {
            const currentIndex = values.indexOf(state.config.editing[key] as T);
            const nextIndex = (currentIndex + 1) % values.length;
            return safeCall(() => updateEditingConfig(key, values[nextIndex]), 'config.saveFailed', 'config.saveSuccess');
        };

    // 重置配置
    const resetConfig = async (): Promise<void> => {
        if (state.isLoading) return;

        state.isLoading = true;
        try {
            // 调用后端重置配置
            await safeCall(() => ConfigService.ResetConfig(), 'config.resetFailed', 'config.resetSuccess');
            
            // 立即重新加载后端配置以确保前端状态同步
            await safeCall(async () => {
                const appConfig = await ConfigService.GetConfig();
                if (appConfig) {
                    state.config = JSON.parse(JSON.stringify(appConfig)) as AppConfig;
                }
            }, 'config.loadFailed', 'config.loadSuccess');
        } finally {
            state.isLoading = false;
        }
    };

    // 语言设置方法
    const setLanguage = async (language: LanguageType): Promise<void> => {
        await safeCall(async () => {
            await updateAppearanceConfig('language', language);

            // 同步更新前端语言
            const frontendLocale = ConfigUtils.backendLanguageToFrontend(language);
            locale.value = frontendLocale as any;
        }, 'config.languageChangeFailed', 'config.languageChanged');
    };

    // 系统主题设置方法
    const setSystemTheme = async (systemTheme: SystemThemeType): Promise<void> => {
        await safeCall(async () => {
            await updateAppearanceConfig('systemTheme', systemTheme);
        }, 'config.systemThemeChangeFailed', 'config.systemThemeChanged');
    };

    // 初始化语言设置
    const initializeLanguage = async (): Promise<void> => {
        try {
            // 如果配置未加载，先加载配置
            if (!state.configLoaded) {
                await initConfig();
            }

            // 同步前端语言设置
            const frontendLocale = ConfigUtils.backendLanguageToFrontend(state.config.appearance.language);
            locale.value = frontendLocale as any;
        } catch (error) {
            const browserLang = getBrowserLanguage();
            locale.value = browserLang as any;
        }
    };

    // 创建数值调整器实例
    const adjusters = {
        fontSize: createAdjuster('fontSize'),
        tabSize: createAdjuster('tabSize'),
        lineHeight: createAdjuster('lineHeight')
    };

    // 创建切换器实例
    const togglers = {
        tabIndent: createEditingToggler('enableTabIndent'),
        alwaysOnTop: async () => {
            await safeCall(async () => {
                await updateGeneralConfig('alwaysOnTop', !state.config.general.alwaysOnTop);
                // 立即应用窗口置顶状态
                await runtime.Window.SetAlwaysOnTop(state.config.general.alwaysOnTop);
            }, 'config.alwaysOnTopFailed', 'config.alwaysOnTopSuccess');
        },
        tabType: createEnumToggler('tabType', CONFIG_LIMITS.tabType.values)
    };

    // 字符串配置设置器
    const setters = {
        fontFamily: (value: string) => safeCall(() => updateEditingConfig('fontFamily', value), 'config.saveFailed', 'config.saveSuccess'),
        fontWeight: (value: string) => safeCall(() => updateEditingConfig('fontWeight', value), 'config.saveFailed', 'config.saveSuccess'),
        dataPath: (value: string) => safeCall(() => updateGeneralConfig('dataPath', value), 'config.saveFailed', 'config.saveSuccess'),
        autoSaveDelay: (value: number) => safeCall(() => updateEditingConfig('autoSaveDelay', value), 'config.saveFailed', 'config.saveSuccess')
    };

    return {
        // 状态
        config: computed(() => state.config),
        configLoaded: computed(() => state.configLoaded),
        isLoading: computed(() => state.isLoading),

        // 限制常量
        ...limits,

        // 核心方法
        initConfig: () => safeCall(() => initConfig(), 'config.loadFailed', 'config.loadSuccess'),
        resetConfig,

        // 语言相关方法
        setLanguage,
        initializeLanguage,

        // 主题相关方法
        setSystemTheme,

        // 字体大小操作
        ...adjusters.fontSize,
        increaseFontSize: adjusters.fontSize.increase,
        decreaseFontSize: adjusters.fontSize.decrease,
        resetFontSize: adjusters.fontSize.reset,
        setFontSize: adjusters.fontSize.set,

        // Tab操作
        toggleTabIndent: togglers.tabIndent,
        setEnableTabIndent: (value: boolean) => safeCall(() => updateEditingConfig('enableTabIndent', value), 'config.saveFailed', 'config.saveSuccess'),
        ...adjusters.tabSize,
        increaseTabSize: adjusters.tabSize.increase,
        decreaseTabSize: adjusters.tabSize.decrease,
        setTabSize: adjusters.tabSize.set,
        toggleTabType: togglers.tabType,

        // 行高操作
        setLineHeight: adjusters.lineHeight.set,

        // 窗口操作
        toggleAlwaysOnTop: togglers.alwaysOnTop,
        setAlwaysOnTop: (value: boolean) => safeCall(() => updateGeneralConfig('alwaysOnTop', value), 'config.saveFailed', 'config.saveSuccess'),

        // 字体操作
        setFontFamily: setters.fontFamily,
        setFontWeight: setters.fontWeight,

        // 路径操作
        setDataPath: setters.dataPath,

        // 保存配置相关方法
        setAutoSaveDelay: setters.autoSaveDelay,

        // 热键配置相关方法
        setEnableGlobalHotkey: (value: boolean) => safeCall(() => updateGeneralConfig('enableGlobalHotkey', value), 'config.saveFailed', 'config.saveSuccess'),
        setGlobalHotkey: (hotkey: any) => safeCall(() => updateGeneralConfig('globalHotkey', hotkey), 'config.saveFailed', 'config.saveSuccess'),

        // 系统托盘配置相关方法
        setEnableSystemTray: (value: boolean) => safeCall(() => updateGeneralConfig('enableSystemTray', value), 'config.saveFailed', 'config.saveSuccess'),

        // 开机启动配置相关方法
        setStartAtLogin: async (value: boolean) => {
            await safeCall(async () => {
                // 先调用系统设置
                await StartupService.SetEnabled(value);
                state.config.general.startAtLogin = value;
            }, 'config.startupFailed', 'config.startupSuccess');
        }
    };
});