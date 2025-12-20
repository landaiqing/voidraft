import {defineStore} from 'pinia';
import {computed, reactive} from 'vue';
import {ConfigService, StartupService} from '@/../bindings/voidraft/internal/services';
import {
    AppConfig,
    AuthMethod,
    EditingConfig,
    LanguageType,
    SystemThemeType,
    TabType
} from '@/../bindings/voidraft/internal/models/models';
import {useI18n} from 'vue-i18n';
import {ConfigUtils} from '@/common/utils/configUtils';
import {FONT_OPTIONS} from '@/common/constant/fonts';
import {SUPPORTED_LOCALES} from '@/common/constant/locales';
import {
    CONFIG_KEY_MAP,
    CONFIG_LIMITS,
    ConfigKey,
    ConfigSection,
    DEFAULT_CONFIG,
    NumberConfigKey
} from '@/common/constant/config';
import * as runtime from '@wailsio/runtime';

export const useConfigStore = defineStore('config', () => {
    const {locale} = useI18n();

    // 响应式状态
    const state = reactive({
        config: {...DEFAULT_CONFIG} as AppConfig,
        isLoading: false,
        configLoaded: false
    });

    // Font options (no longer localized)
    const fontOptions = computed(() => FONT_OPTIONS);

    // 计算属性
    const createLimitComputed = (key: NumberConfigKey) => computed(() => CONFIG_LIMITS[key]);
    const limits = Object.fromEntries(
        (['fontSize', 'tabSize', 'lineHeight'] as const).map(key => [key, createLimitComputed(key)])
    ) as Record<NumberConfigKey, ReturnType<typeof createLimitComputed>>;

    // 统一配置更新方法
    const updateConfig = async <K extends ConfigKey>(key: K, value: any): Promise<void> => {
        if (!state.configLoaded && !state.isLoading) {
            await initConfig();
        }

        const backendKey = CONFIG_KEY_MAP[key];
        if (!backendKey) {
            throw new Error(`No backend key mapping found for ${String(key)}`);
        }

        // 从 backendKey 提取 section（例如 'general.alwaysOnTop' -> 'general'）
        const section = backendKey.split('.')[0] as ConfigSection;

        await ConfigService.Set(backendKey, value);
        (state.config[section] as any)[key] = value;
    };

    // 只更新本地状态，不保存到后端
    const updateConfigLocal = <K extends ConfigKey>(key: K, value: any): void => {
        const backendKey = CONFIG_KEY_MAP[key];
        const section = backendKey.split('.')[0] as ConfigSection;
        (state.config[section] as any)[key] = value;
    };

    // 保存指定配置到后端
    const saveConfig = async <K extends ConfigKey>(key: K): Promise<void> => {
        const backendKey = CONFIG_KEY_MAP[key];
        const section = backendKey.split('.')[0] as ConfigSection;
        await ConfigService.Set(backendKey, (state.config[section] as any)[key]);
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
                if (appConfig.backup) Object.assign(state.config.backup, appConfig.backup);
                if (appConfig.metadata) Object.assign(state.config.metadata, appConfig.metadata);
            }

            state.configLoaded = true;

        } finally {
            state.isLoading = false;
        }
    };

    // 通用数值调整器工厂
    const createAdjuster = <T extends NumberConfigKey>(key: T) => {
        const limit = CONFIG_LIMITS[key];
        const clamp = (value: number) => ConfigUtils.clamp(value, limit.min, limit.max);

        return {
            increase: async () => await updateConfig(key, clamp(state.config.editing[key] + 1)),
            decrease: async () => await updateConfig(key, clamp(state.config.editing[key] - 1)),
            set: async (value: number) => await updateConfig(key, clamp(value)),
            reset: async () => await updateConfig(key, limit.default),
            increaseLocal: () => updateConfigLocal(key, clamp(state.config.editing[key] + 1)),
            decreaseLocal: () => updateConfigLocal(key, clamp(state.config.editing[key] - 1))
        };
    };

    const createEditingToggler = <T extends keyof EditingConfig>(key: T) =>
        async () => await updateConfig(key as ConfigKey, !state.config.editing[key] as EditingConfig[T]);

    // 枚举值切换器
    const createEnumToggler = <T extends TabType>(key: 'tabType', values: readonly T[]) =>
        async () => {
            const currentIndex = values.indexOf(state.config.editing[key] as T);
            const nextIndex = (currentIndex + 1) % values.length;
            return await updateConfig(key, values[nextIndex]);
        };

    // 重置配置
    const resetConfig = async (): Promise<void> => {
        if (state.isLoading) return;

        state.isLoading = true;
        try {

            await ConfigService.ResetConfig();
            const appConfig = await ConfigService.GetConfig();
            if (appConfig) {
                state.config = JSON.parse(JSON.stringify(appConfig)) as AppConfig;
            }
        } finally {
            state.isLoading = false;
        }
    };

    // 语言设置方法
    const setLanguage = async (language: LanguageType): Promise<void> => {
        await updateConfig('language', language);
        const frontendLocale = ConfigUtils.backendLanguageToFrontend(language);
        locale.value = frontendLocale as any;
    };

    // 系统主题设置方法
    const setSystemTheme = async (systemTheme: SystemThemeType): Promise<void> => {
        await updateConfig('systemTheme', systemTheme);
    };

    // 当前主题设置方法
    const setCurrentTheme = async (themeName: string): Promise<void> => {
        await updateConfig('currentTheme', themeName);
    };


    // 初始化语言设置
    const initLanguage = async (): Promise<void> => {
        try {
            // 如果配置未加载，先加载配置
            if (!state.configLoaded) {
                await initConfig();
            }

            // 同步前端语言设置
            const frontendLocale = ConfigUtils.backendLanguageToFrontend(state.config.appearance.language);
            locale.value = frontendLocale as any;
        } catch (_error) {
            const browserLang = SUPPORTED_LOCALES[0].code;
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
            await updateConfig('alwaysOnTop', !state.config.general.alwaysOnTop);
            await runtime.Window.SetAlwaysOnTop(state.config.general.alwaysOnTop);
        },
        tabType: createEnumToggler('tabType', CONFIG_LIMITS.tabType.values)
    };

    return {
        // 状态
        config: computed(() => state.config),
        configLoaded: computed(() => state.configLoaded),
        isLoading: computed(() => state.isLoading),
        fontOptions,

        // 限制常量
        ...limits,

        // 核心方法
        initConfig,
        resetConfig,

        // 语言相关方法
        setLanguage,
        initLanguage,

        // 主题相关方法
        setSystemTheme,
        setCurrentTheme,

        // 字体大小操作
        ...adjusters.fontSize,
        increaseFontSize: adjusters.fontSize.increase,
        decreaseFontSize: adjusters.fontSize.decrease,
        resetFontSize: adjusters.fontSize.reset,
        setFontSize: adjusters.fontSize.set,
        // 字体大小操作
        increaseFontSizeLocal: adjusters.fontSize.increaseLocal,
        decreaseFontSizeLocal: adjusters.fontSize.decreaseLocal,
        saveFontSize: () => saveConfig('fontSize'),

        // Tab操作
        toggleTabIndent: togglers.tabIndent,
        setEnableTabIndent: (value: boolean) => updateConfig('enableTabIndent', value),
        ...adjusters.tabSize,
        increaseTabSize: adjusters.tabSize.increase,
        decreaseTabSize: adjusters.tabSize.decrease,
        setTabSize: adjusters.tabSize.set,
        toggleTabType: togglers.tabType,

        // 行高操作
        setLineHeight: adjusters.lineHeight.set,

        // 窗口操作
        toggleAlwaysOnTop: togglers.alwaysOnTop,
        setAlwaysOnTop: (value: boolean) => updateConfig('alwaysOnTop', value),

        // 字体操作
        setFontFamily: (value: string) => updateConfig('fontFamily', value),
        setFontWeight: (value: string) => updateConfig('fontWeight', value),

        // 路径操作
        setDataPath: (value: string) => updateConfigLocal('dataPath', value),

        // 保存配置相关方法
        setAutoSaveDelay: (value: number) => updateConfig('autoSaveDelay', value),

        // 热键配置相关方法
        setEnableGlobalHotkey: (value: boolean) => updateConfig('enableGlobalHotkey', value),
        setGlobalHotkey: (hotkey: any) => updateConfig('globalHotkey', hotkey),

        // 系统托盘配置相关方法
        setEnableSystemTray: (value: boolean) => updateConfig('enableSystemTray', value),

        // 开机启动配置相关方法
        setStartAtLogin: async (value: boolean) => {
            await updateConfig('startAtLogin', value);
            await StartupService.SetEnabled(value);
        },

        // 窗口吸附配置相关方法
        setEnableWindowSnap: (value: boolean) => updateConfig('enableWindowSnap', value),

        // 加载动画配置相关方法
        setEnableLoadingAnimation: (value: boolean) => updateConfig('enableLoadingAnimation', value),

        // 标签页配置相关方法
        setEnableTabs: (value: boolean) => updateConfig('enableTabs', value),

        // 快捷键模式配置相关方法
        setKeymapMode: (value: any) => updateConfig('keymapMode', value),

        // 更新配置相关方法
        setAutoUpdate: (value: boolean) => updateConfig('autoUpdate', value),

        // 备份配置相关方法
        setEnableBackup: (value: boolean) => updateConfig('enabled', value),
        setAutoBackup: (value: boolean) => updateConfig('auto_backup', value),
        setRepoUrl: (value: string) => updateConfig('repo_url', value),
        setAuthMethod: (value: AuthMethod) => updateConfig('auth_method', value),
        setUsername: (value: string) => updateConfig('username', value),
        setPassword: (value: string) => updateConfig('password', value),
        setToken: (value: string) => updateConfig('token', value),
        setSshKeyPath: (value: string) => updateConfig('ssh_key_path', value),
        setSshKeyPassphrase: (value: string) => updateConfig('ssh_key_passphrase', value),
        setBackupInterval: (value: number) => updateConfig('backup_interval', value),
    };
});