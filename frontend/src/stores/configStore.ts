import {defineStore} from 'pinia';
import {computed, reactive} from 'vue';
import {ConfigService, StartupService} from '@/../bindings/voidraft/internal/services';
import {
    AppConfig,
    AuthMethod,
    SyncTarget,
    LanguageType,
    SystemThemeType,
} from '@/../bindings/voidraft/internal/models/models';
import {useI18n} from 'vue-i18n';
import {ConfigUtils} from '@/common/utils/configUtils';
import {FONT_OPTIONS} from '@/common/constant/fonts';
import {CONFIG_KEY_MAP, CONFIG_LIMITS, ConfigKey, DEFAULT_CONFIG, NumberConfigKey} from '@/common/constant/config';
import * as runtime from '@wailsio/runtime';

export const useConfigStore = defineStore('config', () => {
    const {locale} = useI18n();

    const state = reactive({
        config: structuredClone(DEFAULT_CONFIG) as AppConfig,
        isLoading: false,
        configLoaded: false
    });

    const fontOptions = computed(() => FONT_OPTIONS);

    const applyConfig = (appConfig?: AppConfig | null): void => {
        const nextConfig = structuredClone(DEFAULT_CONFIG) as AppConfig;

        if (appConfig?.general) Object.assign(nextConfig.general, appConfig.general);
        if (appConfig?.editing) Object.assign(nextConfig.editing, appConfig.editing);
        if (appConfig?.appearance) Object.assign(nextConfig.appearance, appConfig.appearance);
        if (appConfig?.updates) Object.assign(nextConfig.updates, appConfig.updates);
        if (appConfig?.sync) {
            if (appConfig.sync.target) {
                nextConfig.sync.target = appConfig.sync.target;
            }
            if (appConfig.sync.git) {
                Object.assign(nextConfig.sync.git, appConfig.sync.git);
            }
            if (appConfig.sync.localfs) {
                Object.assign(nextConfig.sync.localfs, appConfig.sync.localfs);
            }
        }
        if (appConfig?.metadata) Object.assign(nextConfig.metadata, appConfig.metadata);

        state.config = nextConfig;
    };

    const ensureConfigLoaded = async (): Promise<void> => {
        if (!state.configLoaded && !state.isLoading) {
            await initConfig();
        }
    };

    const setValueByPath = (target: Record<string, any>, path: string, value: unknown): void => {
        const segments = path.split('.');
        const lastIndex = segments.length - 1;

        let current: Record<string, any> = target;
        for (let index = 0; index < lastIndex; index++) {
            current = current[segments[index]];
        }
        current[segments[lastIndex]] = value;
    };

    const getValueByPath = (target: Record<string, any>, path: string): unknown => {
        return path.split('.').reduce<unknown>((current, segment) => (current as Record<string, any>)[segment], target);
    };

    const updateConfig = async <K extends ConfigKey>(key: K, value: unknown): Promise<void> => {
        await ensureConfigLoaded();
        const path = CONFIG_KEY_MAP[key];
        await ConfigService.Set(path, value);
        setValueByPath(state.config as Record<string, any>, path, value);
    };

    const updateConfigLocal = <K extends ConfigKey>(key: K, value: unknown): void => {
        setValueByPath(state.config as Record<string, any>, CONFIG_KEY_MAP[key], value);
    };

    const saveConfig = async <K extends ConfigKey>(key: K): Promise<void> => {
        const path = CONFIG_KEY_MAP[key];
        await ConfigService.Set(path, getValueByPath(state.config as Record<string, any>, path));
    };

    const activeSyncKey = <G extends ConfigKey, L extends ConfigKey>(gitKey: G, localFSKey: L): G | L => (
        state.config.sync.target === SyncTarget.SyncTargetGit ? gitKey : localFSKey
    );

    const initConfig = async (): Promise<void> => {
        if (state.isLoading) return;

        state.isLoading = true;
        try {
            applyConfig(await ConfigService.GetConfig());
            state.configLoaded = true;
        } finally {
            state.isLoading = false;
        }
    };

    const resetConfig = async (): Promise<void> => {
        if (state.isLoading) return;

        state.isLoading = true;
        try {
            await ConfigService.ResetConfig();
            applyConfig(await ConfigService.GetConfig());
            state.configLoaded = true;
        } finally {
            state.isLoading = false;
        }
    };

    const clampValue = (value: number, key: NumberConfigKey): number => {
        const limit = CONFIG_LIMITS[key];
        return ConfigUtils.clamp(value, limit.min, limit.max);
    };

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
        config: computed(() => state.config),
        configLoaded: computed(() => state.configLoaded),
        isLoading: computed(() => state.isLoading),
        fontOptions,
        fontConfig,
        tabConfig,

        initConfig,
        resetConfig,

        setLanguage: async (value: LanguageType) => {
            await updateConfig('language', value);
            locale.value = value as any;
        },

        setSystemTheme: (value: SystemThemeType) => updateConfig('systemTheme', value),
        setCurrentTheme: (value: string) => updateConfig('currentTheme', value),

        setFontSize: async (value: number) => {
            await updateConfig('fontSize', clampValue(value, 'fontSize'));
        },
        increaseFontSize: async () => {
            await updateConfig('fontSize', clampValue(state.config.editing.fontSize + 1, 'fontSize'));
        },
        decreaseFontSize: async () => {
            await updateConfig('fontSize', clampValue(state.config.editing.fontSize - 1, 'fontSize'));
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

        setFontFamily: (value: string) => updateConfig('fontFamily', value),
        setFontWeight: (value: string) => updateConfig('fontWeight', value),
        setLineHeight: async (value: number) => {
            await updateConfig('lineHeight', clampValue(value, 'lineHeight'));
        },

        setEnableTabIndent: (value: boolean) => updateConfig('enableTabIndent', value),
        setTabSize: async (value: number) => {
            await updateConfig('tabSize', clampValue(value, 'tabSize'));
        },
        increaseTabSize: async () => {
            await updateConfig('tabSize', clampValue(state.config.editing.tabSize + 1, 'tabSize'));
        },
        decreaseTabSize: async () => {
            await updateConfig('tabSize', clampValue(state.config.editing.tabSize - 1, 'tabSize'));
        },
        toggleTabType: async () => {
            const values = CONFIG_LIMITS.tabType.values;
            const currentIndex = values.indexOf(state.config.editing.tabType as typeof values[number]);
            await updateConfig('tabType', values[(currentIndex + 1) % values.length]);
        },

        toggleAlwaysOnTop: async () => {
            await updateConfig('alwaysOnTop', !state.config.general.alwaysOnTop);
            await runtime.Window.SetAlwaysOnTop(state.config.general.alwaysOnTop);
        },
        setAlwaysOnTop: (value: boolean) => updateConfig('alwaysOnTop', value),
        setDataPath: (value: string) => updateConfigLocal('dataPath', value),
        setAutoSaveDelay: (value: number) => updateConfig('autoSaveDelay', value),
        setEnableGlobalHotkey: (value: boolean) => updateConfig('enableGlobalHotkey', value),
        setGlobalHotkey: (hotkey: any) => updateConfig('globalHotkey', hotkey),
        setEnableSystemTray: (value: boolean) => updateConfig('enableSystemTray', value),
        setStartAtLogin: async (value: boolean) => {
            await updateConfig('startAtLogin', value);
            await StartupService.SetEnabled(value);
        },
        setEnableWindowSnap: (value: boolean) => updateConfig('enableWindowSnap', value),
        setEnableLoadingAnimation: (value: boolean) => updateConfig('enableLoadingAnimation', value),
        setEnableTabs: (value: boolean) => updateConfig('enableTabs', value),
        setEnableMemoryMonitor: (value: boolean) => updateConfig('enableMemoryMonitor', value),
        setKeymapMode: (value: any) => updateConfig('keymapMode', value),
        setAutoUpdate: (value: boolean) => updateConfig('autoUpdate', value),

        setSyncTarget: (value: SyncTarget) => updateConfig('sync_target', value),
        setEnableSync: (value: boolean) => updateConfig(activeSyncKey('git_enabled', 'localfs_enabled'), value),
        setAutoSync: (value: boolean) => updateConfig(activeSyncKey('git_auto_sync', 'localfs_auto_sync'), value),
        setSyncInterval: (value: number) => updateConfig(
            activeSyncKey('git_sync_interval', 'localfs_sync_interval'),
            Math.max(1, value)
        ),
        setRepoUrl: (value: string) => updateConfig('git_repo_url', value),
        setAuthMethod: (value: AuthMethod) => updateConfig('git_auth_method', value),
        setUsername: (value: string) => updateConfig('git_username', value),
        setPassword: (value: string) => updateConfig('git_password', value),
        setToken: (value: string) => updateConfig('git_token', value),
        setSshKeyPath: (value: string) => updateConfig('git_ssh_key_path', value),
        setSshKeyPassphrase: (value: string) => updateConfig('git_ssh_key_passphrase', value),
        setLocalFSRootPath: (value: string) => updateConfig('localfs_root_path', value),
    };
});
