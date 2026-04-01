import {
    AppConfig,
    AuthMethod,
    SyncTarget,
    KeyBindingType,
    LanguageType,
    SystemThemeType,
    TabType,
} from '@/../bindings/voidraft/internal/models/models';
import {FONT_OPTIONS} from './fonts';

// 统一配置键映射（平级展开）
export const CONFIG_KEY_MAP = {
    alwaysOnTop: 'general.alwaysOnTop',
    dataPath: 'general.dataPath',
    enableSystemTray: 'general.enableSystemTray',
    startAtLogin: 'general.startAtLogin',
    enableGlobalHotkey: 'general.enableGlobalHotkey',
    globalHotkey: 'general.globalHotkey',
    enableWindowSnap: 'general.enableWindowSnap',
    enableLoadingAnimation: 'general.enableLoadingAnimation',
    enableTabs: 'general.enableTabs',
    enableMemoryMonitor: 'general.enableMemoryMonitor',

    fontSize: 'editing.fontSize',
    fontFamily: 'editing.fontFamily',
    fontWeight: 'editing.fontWeight',
    lineHeight: 'editing.lineHeight',
    enableTabIndent: 'editing.enableTabIndent',
    tabSize: 'editing.tabSize',
    tabType: 'editing.tabType',
    keymapMode: 'editing.keymapMode',
    autoSaveDelay: 'editing.autoSaveDelay',

    language: 'appearance.language',
    systemTheme: 'appearance.systemTheme',
    currentTheme: 'appearance.currentTheme',

    autoUpdate: 'updates.autoUpdate',
    backupBeforeUpdate: 'updates.backupBeforeUpdate',
    updateTimeout: 'updates.updateTimeout',
    github: 'updates.github',

    sync_target: 'sync.target',
    git_enabled: 'sync.git.enabled',
    git_auto_sync: 'sync.git.auto_sync',
    git_sync_interval: 'sync.git.sync_interval',
    git_repo_url: 'sync.git.repo_url',
    git_auth_method: 'sync.git.auth_method',
    git_username: 'sync.git.username',
    git_password: 'sync.git.password',
    git_token: 'sync.git.token',
    git_ssh_key_path: 'sync.git.ssh_key_path',
    git_ssh_key_passphrase: 'sync.git.ssh_key_passphrase',
    localfs_enabled: 'sync.localfs.enabled',
    localfs_auto_sync: 'sync.localfs.auto_sync',
    localfs_sync_interval: 'sync.localfs.sync_interval',
    localfs_root_path: 'sync.localfs.root_path',
} as const;

export type ConfigKey = keyof typeof CONFIG_KEY_MAP;
export type NumberConfigKey = 'fontSize' | 'tabSize' | 'lineHeight';

// 配置限制
export const CONFIG_LIMITS = {
    fontSize: {min: 12, max: 28, default: 13},
    tabSize: {min: 2, max: 8, default: 4},
    lineHeight: {min: 1.0, max: 3.0, default: 1.5},
    tabType: {values: [TabType.TabTypeSpaces, TabType.TabTypeTab], default: TabType.TabTypeSpaces}
} as const;

// 默认配置
export const DEFAULT_CONFIG: AppConfig = {
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
        },
        enableWindowSnap: true,
        enableLoadingAnimation: true,
        enableTabs: false,
        enableMemoryMonitor: true,
    },
    editing: {
        fontSize: CONFIG_LIMITS.fontSize.default,
        fontFamily: FONT_OPTIONS[0].value,
        fontWeight: '400',
        lineHeight: CONFIG_LIMITS.lineHeight.default,
        enableTabIndent: true,
        tabSize: CONFIG_LIMITS.tabSize.default,
        tabType: CONFIG_LIMITS.tabType.default,
        keymapMode: KeyBindingType.Standard,
        autoSaveDelay: 5000
    },
    appearance: {
        language: LanguageType.LangZhCN,
        systemTheme: SystemThemeType.SystemThemeDark,
        currentTheme: 'default-dark'
    },
    updates: {
        version: "1.0.0",
        autoUpdate: true,
        backupBeforeUpdate: true,
        updateTimeout: 120,
        github: {
            owner: "landaiqing",
            repo: "voidraft",
        },
    },
    sync: {
        target: SyncTarget.SyncTargetGit,
        git: {
            enabled: false,
            auto_sync: false,
            sync_interval: 60,
            repo_url: '',
            auth_method: AuthMethod.UserPass,
            username: '',
            password: '',
            token: '',
            ssh_key_path: '',
            ssh_key_passphrase: '',
        },
        localfs: {
            enabled: false,
            auto_sync: false,
            sync_interval: 60,
            root_path: '',
        },
    },
    metadata: {
        version: '1.0.0',
        lastUpdated: new Date().toString(),
    }
};
