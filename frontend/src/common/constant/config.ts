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
import {FONT_OPTIONS} from './fonts';

// 配置键映射和限制的类型定义
export type GeneralConfigKeyMap = {
    readonly [K in keyof GeneralConfig]: string;
};

export type EditingConfigKeyMap = {
    readonly [K in keyof EditingConfig]: string;
};

export type AppearanceConfigKeyMap = {
    readonly [K in keyof AppearanceConfig]: string;
};

export type UpdatesConfigKeyMap = {
    readonly [K in keyof UpdatesConfig]: string;
};

export type BackupConfigKeyMap = {
    readonly [K in keyof GitBackupConfig]: string;
};

export type NumberConfigKey = 'fontSize' | 'tabSize' | 'lineHeight';

// 配置键映射
export const GENERAL_CONFIG_KEY_MAP: GeneralConfigKeyMap = {
    alwaysOnTop: 'general.alwaysOnTop',
    dataPath: 'general.dataPath',
    enableSystemTray: 'general.enableSystemTray',
    startAtLogin: 'general.startAtLogin',
    enableGlobalHotkey: 'general.enableGlobalHotkey',
    globalHotkey: 'general.globalHotkey',
    enableWindowSnap: 'general.enableWindowSnap',
    enableLoadingAnimation: 'general.enableLoadingAnimation',
} as const;

export const EDITING_CONFIG_KEY_MAP: EditingConfigKeyMap = {
    fontSize: 'editing.fontSize',
    fontFamily: 'editing.fontFamily',
    fontWeight: 'editing.fontWeight',
    lineHeight: 'editing.lineHeight',
    enableTabIndent: 'editing.enableTabIndent',
    tabSize: 'editing.tabSize',
    tabType: 'editing.tabType',
    autoSaveDelay: 'editing.autoSaveDelay'
} as const;

export const APPEARANCE_CONFIG_KEY_MAP: AppearanceConfigKeyMap = {
    language: 'appearance.language',
    systemTheme: 'appearance.systemTheme'
} as const;

export const UPDATES_CONFIG_KEY_MAP: UpdatesConfigKeyMap = {
    version: 'updates.version',
    autoUpdate: 'updates.autoUpdate',
    primarySource: 'updates.primarySource',
    backupSource: 'updates.backupSource',
    backupBeforeUpdate: 'updates.backupBeforeUpdate',
    updateTimeout: 'updates.updateTimeout',
    github: 'updates.github',
    gitea: 'updates.gitea'
} as const;

export const BACKUP_CONFIG_KEY_MAP: BackupConfigKeyMap = {
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