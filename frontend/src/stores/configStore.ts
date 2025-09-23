import {defineStore} from 'pinia';
import {computed, reactive} from 'vue';
import {ConfigService, StartupService} from '@/../bindings/voidraft/internal/services';
import {
    AppConfig,
    AppearanceConfig,
    EditingConfig,
    GeneralConfig,
    LanguageType,
    SystemThemeType,
    TabType,
    UpdatesConfig,
    GitBackupConfig,
    AuthMethod
} from '@/../bindings/voidraft/internal/models/models';
import {useI18n} from 'vue-i18n';
import {ConfigUtils} from '@/common/utils/configUtils';
import {FONT_OPTIONS} from '@/common/constant/fonts';
import {SupportedLocaleType, SUPPORTED_LOCALES} from '@/common/constant/locales';
import {
    NumberConfigKey,
    GENERAL_CONFIG_KEY_MAP,
    EDITING_CONFIG_KEY_MAP,
    APPEARANCE_CONFIG_KEY_MAP,
    UPDATES_CONFIG_KEY_MAP,
    BACKUP_CONFIG_KEY_MAP,
    CONFIG_LIMITS,
    DEFAULT_CONFIG
} from '@/common/constant/config';
import * as runtime from '@wailsio/runtime';

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

export const useConfigStore = defineStore('config', () => {
    const {locale, t} = useI18n();

    // 响应式状态
    const state = reactive({
        config: {...DEFAULT_CONFIG} as AppConfig,
        isLoading: false,
        configLoaded: false
    });
    
    // Font options (no longer localized)
    const fontOptions = computed(() => FONT_OPTIONS);

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

    const updateUpdatesConfig = async <K extends keyof UpdatesConfig>(key: K, value: UpdatesConfig[K]): Promise<void> => {
        // 确保配置已加载
        if (!state.configLoaded && !state.isLoading) {
            await initConfig();
        }

        const backendKey = UPDATES_CONFIG_KEY_MAP[key];
        if (!backendKey) {
            throw new Error(`No backend key mapping found for updates.${key.toString()}`);
        }

        await ConfigService.Set(backendKey, value);
        state.config.updates[key] = value;
    };

    const updateBackupConfig = async <K extends keyof GitBackupConfig>(key: K, value: GitBackupConfig[K]): Promise<void> => {
        // 确保配置已加载
        if (!state.configLoaded && !state.isLoading) {
            await initConfig();
        }

        const backendKey = BACKUP_CONFIG_KEY_MAP[key];
        if (!backendKey) {
            throw new Error(`No backend key mapping found for backup.${key.toString()}`);
        }

        await ConfigService.Set(backendKey, value);
        state.config.backup[key] = value;
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
            increase: async () => await updateEditingConfig(key, clamp(state.config.editing[key] + 1)),
            decrease: async () => await updateEditingConfig(key, clamp(state.config.editing[key] - 1)),
            set: async (value: number) => await updateEditingConfig(key, clamp(value)),
            reset: async () => await updateEditingConfig(key, limit.default)
        };
    };

    const createEditingToggler = <T extends keyof EditingConfig>(key: T) =>
        async () => await updateEditingConfig(key, !state.config.editing[key] as EditingConfig[T]);

    // 枚举值切换器
    const createEnumToggler = <T extends TabType>(key: 'tabType', values: readonly T[]) =>
        async () => {
            const currentIndex = values.indexOf(state.config.editing[key] as T);
            const nextIndex = (currentIndex + 1) % values.length;
            return await updateEditingConfig(key, values[nextIndex]);
        };

    // 重置配置
    const resetConfig = async (): Promise<void> => {
        if (state.isLoading) return;

        state.isLoading = true;
        try {

            await ConfigService.ResetConfig()
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
        await updateAppearanceConfig('language', language);

        // 同步更新前端语言
        const frontendLocale = ConfigUtils.backendLanguageToFrontend(language);
        locale.value = frontendLocale as any;
    };

    // 系统主题设置方法
    const setSystemTheme = async (systemTheme: SystemThemeType): Promise<void> => {
        await updateAppearanceConfig('systemTheme', systemTheme);
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
            await updateGeneralConfig('alwaysOnTop', !state.config.general.alwaysOnTop);
            // 立即应用窗口置顶状态
            await runtime.Window.SetAlwaysOnTop(state.config.general.alwaysOnTop);
        },
        tabType: createEnumToggler('tabType', CONFIG_LIMITS.tabType.values)
    };

    // 字符串配置设置器
    const setters = {
        fontFamily: async (value: string) => await updateEditingConfig('fontFamily', value),
        fontWeight: async (value: string) => await updateEditingConfig('fontWeight', value),
        dataPath: async (value: string) => await updateGeneralConfig('dataPath', value),
        autoSaveDelay: async (value: number) => await updateEditingConfig('autoSaveDelay', value)
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
        setEnableTabIndent: (value: boolean) => updateEditingConfig('enableTabIndent', value),
        ...adjusters.tabSize,
        increaseTabSize: adjusters.tabSize.increase,
        decreaseTabSize: adjusters.tabSize.decrease,
        setTabSize: adjusters.tabSize.set,
        toggleTabType: togglers.tabType,

        // 行高操作
        setLineHeight: adjusters.lineHeight.set,

        // 窗口操作
        toggleAlwaysOnTop: togglers.alwaysOnTop,
        setAlwaysOnTop: (value: boolean) => updateGeneralConfig('alwaysOnTop', value),

        // 字体操作
        setFontFamily: setters.fontFamily,
        setFontWeight: setters.fontWeight,

        // 路径操作
        setDataPath: setters.dataPath,

        // 保存配置相关方法
        setAutoSaveDelay: setters.autoSaveDelay,

        // 热键配置相关方法
        setEnableGlobalHotkey: (value: boolean) => updateGeneralConfig('enableGlobalHotkey', value),
        setGlobalHotkey: (hotkey: any) => updateGeneralConfig('globalHotkey', hotkey),

        // 系统托盘配置相关方法
        setEnableSystemTray: (value: boolean) => updateGeneralConfig('enableSystemTray', value),

        // 开机启动配置相关方法
        setStartAtLogin: async (value: boolean) => {
            // 先更新配置文件
            await updateGeneralConfig('startAtLogin', value);
            // 再调用系统设置API
            await StartupService.SetEnabled(value);
        },
        
        // 窗口吸附配置相关方法
        setEnableWindowSnap: async (value: boolean) => await updateGeneralConfig('enableWindowSnap', value),

        // 加载动画配置相关方法
        setEnableLoadingAnimation: async (value: boolean) => await updateGeneralConfig('enableLoadingAnimation', value),

        // 更新配置相关方法
        setAutoUpdate: async (value: boolean) => await updateUpdatesConfig('autoUpdate', value),

        // 备份配置相关方法
        setEnableBackup: async (value: boolean) => {await updateBackupConfig('enabled', value);},
        setAutoBackup: async (value: boolean) => {await updateBackupConfig('auto_backup', value);},
        setRepoUrl: async (value: string) => await updateBackupConfig('repo_url', value),
        setAuthMethod: async (value: AuthMethod) => await updateBackupConfig('auth_method', value),
        setUsername: async (value: string) => await updateBackupConfig('username', value),
        setPassword: async (value: string) => await updateBackupConfig('password', value),
        setToken: async (value: string) => await updateBackupConfig('token', value),
        setSshKeyPath: async (value: string) => await updateBackupConfig('ssh_key_path', value),
        setSshKeyPassphrase: async (value: string) => await updateBackupConfig('ssh_key_passphrase', value),
        setBackupInterval: async (value: number) => await updateBackupConfig('backup_interval', value),
    };
});