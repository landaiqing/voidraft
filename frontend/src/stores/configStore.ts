import {defineStore} from 'pinia';
import {computed, reactive} from 'vue';
import {ConfigService, StartupService} from '@/../bindings/voidraft/internal/services';
import {AppConfig, AuthMethod, LanguageType, SystemThemeType, TabType} from '@/../bindings/voidraft/internal/models/models';
import {useI18n} from 'vue-i18n';
import {ConfigUtils} from '@/common/utils/configUtils';
import {FONT_OPTIONS} from '@/common/constant/fonts';
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

    // 辅助函数：限制数值范围
    const clampValue = (value: number, key: NumberConfigKey): number => {
        const limit = CONFIG_LIMITS[key];
        return ConfigUtils.clamp(value, limit.min, limit.max);
    };

    // 计算属性
    const fontConfig = computed(() => ({
        fontSize: state.config.editing.fontSize,
        fontFamily: state.config.editing.fontFamily,
        lineHeight: state.config.editing.lineHeight,
        fontWeight: state.config.editing.fontWeight
    }));

    const tabConfig = computed(() => ({
        tabSize: state.config.editing.tabSize,
        enableTabIndent: state.config.editing.enableTabIndent,
        tabType: state.config.editing.tabType
    }));

    return {
        // 状态
        config: computed(() => state.config),
        configLoaded: computed(() => state.configLoaded),
        isLoading: computed(() => state.isLoading),
        fontOptions,
        fontConfig,
        tabConfig,

        // 核心方法
        initConfig,
        resetConfig,

        // 语言相关方法
        setLanguage: (value: LanguageType) => {
            updateConfig('language', value);
            locale.value = value as any;
        },

        // 主题相关方法
        setSystemTheme: (value: SystemThemeType) => updateConfig('systemTheme', value),
        setCurrentTheme: (value: string) => updateConfig('currentTheme', value),

        // 字体大小操作
        setFontSize: async (value: number) => {
            await updateConfig('fontSize', clampValue(value, 'fontSize'));
        },
        increaseFontSize: async () => {
            const newValue = state.config.editing.fontSize + 1;
            await updateConfig('fontSize', clampValue(newValue, 'fontSize'));
        },
        decreaseFontSize: async () => {
            const newValue = state.config.editing.fontSize - 1;
            await updateConfig('fontSize', clampValue(newValue, 'fontSize'));
        },
        resetFontSize: async () => {
            await updateConfig('fontSize', CONFIG_LIMITS.fontSize.default);
        },
        increaseFontSizeLocal: () => {
            updateConfigLocal('fontSize', clampValue(state.config.editing.fontSize + 1, 'fontSize'));
        },
        decreaseFontSizeLocal: () => {
            updateConfigLocal('fontSize', clampValue(state.config.editing.fontSize - 1, 'fontSize'));
        },
        saveFontSize: async () => {
            await saveConfig('fontSize');
        },

        // 字体操作
        setFontFamily: (value: string) => updateConfig('fontFamily', value),
        setFontWeight: (value: string) => updateConfig('fontWeight', value),

        // 行高操作
        setLineHeight: async (value: number) => {
            await updateConfig('lineHeight', clampValue(value, 'lineHeight'));
        },

        // Tab操作
        setEnableTabIndent: (value: boolean) => updateConfig('enableTabIndent', value),
        setTabSize: async (value: number) => {
            await updateConfig('tabSize', clampValue(value, 'tabSize'));
        },
        increaseTabSize: async () => {
            const newValue = state.config.editing.tabSize + 1;
            await updateConfig('tabSize', clampValue(newValue, 'tabSize'));
        },
        decreaseTabSize: async () => {
            const newValue = state.config.editing.tabSize - 1;
            await updateConfig('tabSize', clampValue(newValue, 'tabSize'));
        },
        toggleTabType: async () => {
            const values = CONFIG_LIMITS.tabType.values;
            const currentIndex = values.indexOf(state.config.editing.tabType as typeof values[number]);
            const nextIndex = (currentIndex + 1) % values.length;
            await updateConfig('tabType', values[nextIndex]);
        },

        // 窗口操作
        toggleAlwaysOnTop: async () => {
            await updateConfig('alwaysOnTop', !state.config.general.alwaysOnTop);
            await runtime.Window.SetAlwaysOnTop(state.config.general.alwaysOnTop);
        },
        setAlwaysOnTop: (value: boolean) => updateConfig('alwaysOnTop', value),

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