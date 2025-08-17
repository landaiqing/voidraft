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
    UpdateSourceType,
    GitBackupConfig,
    AuthMethod
} from '@/../bindings/voidraft/internal/models/models';
import {useI18n} from 'vue-i18n';
import {ConfigUtils} from '@/utils/configUtils';
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

type UpdatesConfigKeyMap = {
    readonly [K in keyof UpdatesConfig]: string;
};

type BackupConfigKeyMap = {
    readonly [K in keyof GitBackupConfig]: string;
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

const UPDATES_CONFIG_KEY_MAP: UpdatesConfigKeyMap = {
    version: 'updates.version',
    autoUpdate: 'updates.autoUpdate',
    primarySource: 'updates.primarySource',
    backupSource: 'updates.backupSource',
    backupBeforeUpdate: 'updates.backupBeforeUpdate',
    updateTimeout: 'updates.updateTimeout',
    github: 'updates.github',
    gitea: 'updates.gitea'
} as const;

const BACKUP_CONFIG_KEY_MAP: BackupConfigKeyMap = {
    enabled: 'backup.enabled',
    repo_url: 'backup.repo_url',
    auth_method: 'backup.auth_method',
    username: 'backup.username',
    password: 'backup.password',
    token: 'backup.token',
    ssh_key_path: 'backup.ssh_key_path',
    ssh_key_passphrase: 'backup.ssh_key_passphrase',
    backup_interval: 'backup.backup_interval',
    auto_backup: 'backup.auto_backup',

} as const;

// 配置限制
const CONFIG_LIMITS = {
    fontSize: {min: 12, max: 28, default: 13},
    tabSize: {min: 2, max: 8, default: 4},
    lineHeight: {min: 1.0, max: 3.0, default: 1.5},
    tabType: {values: [TabType.TabTypeSpaces, TabType.TabTypeTab], default: TabType.TabTypeSpaces}
} as const;

// 创建获取翻译的函数
export const createFontOptions = (t: (key: string) => string) => [
    {
        label: t('settings.fontFamilies.harmonyOS'),
        value: '"HarmonyOS Sans SC", "HarmonyOS Sans", "Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, sans-serif'
    },
    {
        label: t('settings.fontFamilies.microsoftYahei'),
        value: '"Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, sans-serif'
    },
    {
        label: t('settings.fontFamilies.pingfang'),
        value: '"PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif'
    },
    {
        label: t('settings.fontFamilies.jetbrainsMono'),
        value: '"JetBrains Mono", "Fira Code", "SF Mono", Monaco, Consolas, "Ubuntu Mono", monospace'
    },
    {
        label: t('settings.fontFamilies.firaCode'),
        value: '"Fira Code", "JetBrains Mono", "SF Mono", Monaco, Consolas, "Ubuntu Mono", monospace'
    },
    {
        label: t('settings.fontFamilies.sourceCodePro'),
        value: '"Source Code Pro", "SF Mono", Monaco, Consolas, "Ubuntu Mono", monospace'
    },
    {
        label: t('settings.fontFamilies.cascadiaCode'),
        value: '"Cascadia Code", "SF Mono", Monaco, Consolas, "Ubuntu Mono", monospace'
    }
];

// 常用字体选项
export const FONT_OPTIONS = createFontOptions((key) => key);

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
            systemTheme: SystemThemeType.SystemThemeAuto
        },
    updates: {
        version: "1.0.0",
        autoUpdate: true,
        primarySource: UpdateSourceType.UpdateSourceGithub,
        backupSource: UpdateSourceType.UpdateSourceGitea,
        backupBeforeUpdate: true,
        updateTimeout: 30,
        github: {
            owner: "landaiqing",
            repo: "voidraft",
        },
        gitea: {
            baseURL: "https://git.landaiqing.cn",
            owner: "landaiqing",
            repo: "voidraft",
        }
    },
    backup: {
        enabled: false,
        repo_url: "",
        auth_method: AuthMethod.UserPass,
        username: "",
        password: "",
        token: "",
        ssh_key_path: "",
        ssh_key_passphrase: "",
        backup_interval: 60,
        auto_backup: true,
    },
    metadata: {
        version: '1.0.0',
        lastUpdated: new Date().toString(),
    }
};


export const useConfigStore = defineStore('config', () => {
    const {locale, t} = useI18n();

    // 响应式状态
    const state = reactive({
        config: {...DEFAULT_CONFIG} as AppConfig,
        isLoading: false,
        configLoaded: false
    });
    
    // 初始化FONT_OPTIONS国际化版本
    const localizedFontOptions = computed(() => createFontOptions(t));

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

    // 通用布尔值切换器
    const createGeneralToggler = <T extends keyof GeneralConfig>(key: T) =>
        async () => await updateGeneralConfig(key, !state.config.general[key] as GeneralConfig[T]);

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
        localizedFontOptions,
        
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