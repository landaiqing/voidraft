<script setup lang="ts">
import {useConfigStore} from '@/stores/configStore';
import {useBackupStore} from '@/stores/backupStore';
import {useI18n} from 'vue-i18n';
import {computed, onUnmounted} from 'vue';
import SettingSection from '../components/SettingSection.vue';
import SettingItem from '../components/SettingItem.vue';
import ToggleSwitch from '../components/ToggleSwitch.vue';
import {AuthMethod} from '@/../bindings/voidraft/internal/models/models';
import {DialogService} from '@/../bindings/voidraft/internal/services';

const {t} = useI18n();
const configStore = useConfigStore();
const backupStore = useBackupStore();

onUnmounted(() => {
  backupStore.clearStatus();
});

// 认证方式选项
const authMethodOptions = computed(() => [
  {value: AuthMethod.Token, label: t('settings.backup.authMethods.token')},
  {value: AuthMethod.SSHKey, label: t('settings.backup.authMethods.sshKey')},
  {value: AuthMethod.UserPass, label: t('settings.backup.authMethods.userPass')}
]);

// 备份间隔选项（分钟）
const backupIntervalOptions = computed(() => [
  {value: 5, label: t('settings.backup.intervals.5min')},
  {value: 10, label: t('settings.backup.intervals.10min')},
  {value: 15, label: t('settings.backup.intervals.15min')},
  {value: 30, label: t('settings.backup.intervals.30min')},
  {value: 60, label: t('settings.backup.intervals.1hour')}
]);

// 计算属性 - 启用备份
const enableBackup = computed({
  get: () => configStore.config.backup.enabled,
  set: (value: boolean) => configStore.setEnableBackup(value)
});

// 计算属性 - 自动备份
const autoBackup = computed({
  get: () => configStore.config.backup.auto_backup,
  set: (value: boolean) => configStore.setAutoBackup(value)
});

// 仓库URL
const repoUrl = computed({
  get: () => configStore.config.backup.repo_url,
  set: (value: string) => configStore.setRepoUrl(value)
});


// 认证方式
const authMethod = computed({
  get: () => configStore.config.backup.auth_method,
  set: (value: AuthMethod) => configStore.setAuthMethod(value)
});

// 备份间隔
const backupInterval = computed({
  get: () => configStore.config.backup.backup_interval,
  set: (value: number) => configStore.setBackupInterval(value)
});

// 用户名
const username = computed({
  get: () => configStore.config.backup.username,
  set: (value: string) => configStore.setUsername(value)
});

// 密码
const password = computed({
  get: () => configStore.config.backup.password,
  set: (value: string) => configStore.setPassword(value)
});

// 访问令牌
const token = computed({
  get: () => configStore.config.backup.token,
  set: (value: string) => configStore.setToken(value)
});

// SSH密钥路径
const sshKeyPath = computed({
  get: () => configStore.config.backup.ssh_key_path,
  set: (value: string) => configStore.setSshKeyPath(value)
});

// SSH密钥密码
const sshKeyPassphrase = computed({
  get: () => configStore.config.backup.ssh_key_passphrase,
  set: (value: string) => configStore.setSshKeyPassphrase(value)
});

// 处理输入变化
const handleRepoUrlChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  repoUrl.value = target.value;
};


const handleUsernameChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  username.value = target.value;
};

const handlePasswordChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  password.value = target.value;
};

const handleTokenChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  token.value = target.value;
};

const handleSshKeyPassphraseChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  sshKeyPassphrase.value = target.value;
};

const handleAuthMethodChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  authMethod.value = target.value as AuthMethod;
};

const handleBackupIntervalChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  backupInterval.value = parseInt(target.value);
};

// 推送到远程
const pushToRemote = async () => {
  await backupStore.pushToRemote();
};

// 重试备份
const retryBackup = async () => {
  await backupStore.retryBackup();
};

// 选择SSH密钥文件
const selectSshKeyFile = async () => {
  // 使用DialogService选择文件
  const selectedPath = await DialogService.SelectFile();
  // 检查用户是否取消了选择或路径为空
  if (!selectedPath.trim()) {
    return;
  }
  // 更新SSH密钥路径
  sshKeyPath.value = selectedPath.trim();
};
</script>

<template>
  <div class="settings-page">
    <!-- 基本设置 -->
    <SettingSection :title="t('settings.backup.basicSettings')">
      <SettingItem
          :title="t('settings.backup.enableBackup')"
      >
        <ToggleSwitch v-model="enableBackup"/>
      </SettingItem>

      <SettingItem
          :title="t('settings.backup.autoBackup')"
          :class="{ 'disabled-setting': !enableBackup }"
      >
        <ToggleSwitch v-model="autoBackup" :disabled="!enableBackup"/>
      </SettingItem>

      <SettingItem
          :title="t('settings.backup.backupInterval')"
          :class="{ 'disabled-setting': !enableBackup || !autoBackup }"
      >
        <select
            class="backup-interval-select"
            :value="backupInterval"
            @change="handleBackupIntervalChange"
            :disabled="!enableBackup || !autoBackup"
        >
          <option
              v-for="option in backupIntervalOptions"
              :key="option.value"
              :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </SettingItem>
    </SettingSection>

    <!-- 仓库配置 -->
    <SettingSection :title="t('settings.backup.repositoryConfig')">
      <SettingItem
          :title="t('settings.backup.repoUrl')"
      >
        <input
            type="text"
            class="repo-url-input"
            :value="repoUrl"
            @input="handleRepoUrlChange"
            :placeholder="t('settings.backup.repoUrlPlaceholder')"
            :disabled="!enableBackup"
        />
      </SettingItem>


    </SettingSection>

    <!-- 认证配置 -->
    <SettingSection :title="t('settings.backup.authConfig')">
      <SettingItem
          :title="t('settings.backup.authMethod')"
      >
        <select
            class="auth-method-select"
            :value="authMethod"
            @change="handleAuthMethodChange"
            :disabled="!enableBackup"
        >
          <option
              v-for="option in authMethodOptions"
              :key="option.value"
              :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </SettingItem>

      <!-- 用户名密码认证 -->
      <template v-if="authMethod === AuthMethod.UserPass">
        <SettingItem :title="t('settings.backup.username')">
          <input
              type="text"
              class="username-input"
              :value="username"
              @input="handleUsernameChange"
              :placeholder="t('settings.backup.usernamePlaceholder')"
              :disabled="!enableBackup"
          />
        </SettingItem>

        <SettingItem :title="t('settings.backup.password')">
          <input
              type="password"
              class="password-input"
              :value="password"
              @input="handlePasswordChange"
              :placeholder="t('settings.backup.passwordPlaceholder')"
              :disabled="!enableBackup"
          />
        </SettingItem>
      </template>

      <!-- 访问令牌认证 -->
      <template v-if="authMethod === AuthMethod.Token">
        <SettingItem
            :title="t('settings.backup.token')"
        >
          <input
              type="password"
              class="token-input"
              :value="token"
              @input="handleTokenChange"
              :placeholder="t('settings.backup.tokenPlaceholder')"
              :disabled="!enableBackup"
          />
        </SettingItem>
      </template>

      <!-- SSH密钥认证 -->
      <template v-if="authMethod === AuthMethod.SSHKey">
        <SettingItem
            :title="t('settings.backup.sshKeyPath')"
        >
          <input
              type="text"
              class="ssh-key-path-input"
              :value="sshKeyPath"
              :placeholder="t('settings.backup.sshKeyPathPlaceholder')"
              :disabled="!enableBackup"
              readonly
              @click="enableBackup && selectSshKeyFile()"
          />
        </SettingItem>

        <SettingItem
            :title="t('settings.backup.sshKeyPassphrase')"
        >
          <input
              type="password"
              class="ssh-passphrase-input"
              :value="sshKeyPassphrase"
              @input="handleSshKeyPassphraseChange"
              :placeholder="t('settings.backup.sshKeyPassphrasePlaceholder')"
              :disabled="!enableBackup"
          />
        </SettingItem>
      </template>
    </SettingSection>

    <!-- 备份操作 -->
    <SettingSection :title="t('settings.backup.backupOperations')">
      <SettingItem
          :title="t('settings.backup.pushToRemote')"
      >
        <div class="backup-operation-container">
          <div class="backup-status-icons">
            <span v-if="backupStore.isSuccess" class="success-icon">✓</span>
            <span v-if="backupStore.isError" class="error-icon">✗</span>
          </div>
          <button
              class="push-button"
              @click="() => pushToRemote()"
              :disabled="!enableBackup || !repoUrl || backupStore.isPushing"
              :class="{ 'backing-up': backupStore.isPushing }"
          >
            <span v-if="backupStore.isPushing" class="loading-spinner"></span>
            {{ backupStore.isPushing ? t('settings.backup.pushing') : t('settings.backup.actions.push') }}
          </button>
          <button
              v-if="backupStore.isError"
              class="retry-button"
              @click="() => retryBackup()"
              :disabled="backupStore.isPushing"
          >
            {{ t('settings.backup.actions.retry') }}
          </button>
        </div>
      </SettingItem>
      <div v-if="backupStore.errorMessage" class="error-message-row">
        {{ backupStore.errorMessage }}
      </div>
    </SettingSection>
  </div>
</template>

<style scoped lang="scss">
.settings-page {
  max-width: 800px;
}

// 统一的输入控件样式
.repo-url-input,
.branch-input,
.username-input,
.password-input,
.token-input,
.ssh-key-path-input,
.ssh-passphrase-input,
.backup-interval-select,
.auth-method-select {
  width: 50%;
  min-width: 200px;
  padding: 10px 12px;
  background-color: var(--settings-input-bg);
  border: 1px solid var(--settings-input-border);
  border-radius: 4px;
  color: var(--settings-text);
  font-size: 12px;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: #4a9eff;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background-color: var(--settings-hover);
  }

  &::placeholder {
    color: var(--settings-text-secondary);
  }

  &[readonly]:not(:disabled) {
    cursor: pointer;

    &:hover {
      border-color: var(--settings-hover);
      background-color: var(--settings-hover);
    }
  }
}

// 选择框特有样式
.backup-interval-select,
.auth-method-select {
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23999999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 8px center;
  background-size: 16px;
  padding-right: 30px;

  option {
    background-color: var(--settings-input-bg);
    color: var(--settings-text);
  }
}

// 备份操作容器
.backup-operation-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

// 备份状态图标
.backup-status-icons {
  width: 24px;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-right: 8px;
}

// 成功和错误图标
.success-icon {
  color: #4caf50;
  font-size: 18px;
  font-weight: bold;
}

.error-icon {
  color: #f44336;
  font-size: 18px;
  font-weight: bold;
}

// 按钮样式
.push-button,
.retry-button {
  padding: 8px 16px;
  background-color: var(--settings-input-bg);
  border: 1px solid var(--settings-input-border);
  border-radius: 4px;
  color: var(--settings-text);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;

  &:hover:not(:disabled) {
    background-color: var(--settings-hover);
    border-color: var(--settings-border);
  }

  &:active:not(:disabled) {
    transform: translateY(1px);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .loading-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: var(--settings-text);
    animation: spin 1s linear infinite;
  }

  &.backing-up {
    background-color: #2196f3;
    border-color: #2196f3;
    color: white;
  }
}

.retry-button {
  background-color: #ff9800;
  border-color: #ff9800;
  color: white;

  &:hover:not(:disabled) {
    background-color: #f57c00;
    border-color: #f57c00;
  }
}

// 错误信息行样式
.error-message-row {
  color: #f44336;
  font-size: 11px;
  line-height: 1.4;
  word-wrap: break-word;
  margin-top: 8px;
  padding: 8px 16px;
  background-color: rgba(244, 67, 54, 0.1);
  border-left: 3px solid #f44336;
  border-radius: 4px;
}

// 禁用状态
.disabled-setting {
  opacity: 0.5;
  pointer-events: none;
}

// 加载动画
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>