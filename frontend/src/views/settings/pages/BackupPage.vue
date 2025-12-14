<script setup lang="ts">
import {useConfigStore} from '@/stores/configStore';
import {useBackupStore} from '@/stores/backupStore';
import {useI18n} from 'vue-i18n';
import {computed, ref, watch, onUnmounted} from 'vue';
import SettingSection from '../components/SettingSection.vue';
import SettingItem from '../components/SettingItem.vue';
import ToggleSwitch from '../components/ToggleSwitch.vue';
import {AuthMethod} from '@/../bindings/voidraft/internal/models/models';
import {DialogService} from '@/../bindings/voidraft/internal/services';

const {t} = useI18n();
const configStore = useConfigStore();
const backupStore = useBackupStore();

// 消息显示状态
const message = ref<string | null>(null);
const isError = ref(false);
let messageTimer: ReturnType<typeof setTimeout> | null = null;

const clearMessage = () => {
  if (messageTimer) {
    clearTimeout(messageTimer);
    messageTimer = null;
  }
  message.value = null;
};

// 监听同步完成，显示消息并自动消失
watch(() => backupStore.isSyncing, (syncing, wasSyncing) => {
  if (wasSyncing && !syncing) {
    clearMessage();
    if (backupStore.error) {
      message.value = backupStore.error;
      isError.value = true;
      messageTimer = setTimeout(clearMessage, 5000);
    } else {
      message.value = 'Sync successful';
      isError.value = false;
      messageTimer = setTimeout(clearMessage, 3000);
    }
  }
});

onUnmounted(clearMessage);

const authMethodOptions = computed(() => [
  {value: AuthMethod.Token, label: t('settings.backup.authMethods.token')},
  {value: AuthMethod.SSHKey, label: t('settings.backup.authMethods.sshKey')},
  {value: AuthMethod.UserPass, label: t('settings.backup.authMethods.userPass')}
]);

const backupIntervalOptions = computed(() => [
  {value: 5, label: t('settings.backup.intervals.5min')},
  {value: 10, label: t('settings.backup.intervals.10min')},
  {value: 15, label: t('settings.backup.intervals.15min')},
  {value: 30, label: t('settings.backup.intervals.30min')},
  {value: 60, label: t('settings.backup.intervals.1hour')}
]);

const selectSshKeyFile = async () => {
  const selectedPath = await DialogService.SelectFile();
  if (selectedPath.trim()) {
    configStore.setSshKeyPath(selectedPath.trim());
  }
};
</script>

<template>
  <div class="settings-page">
    <!-- 基本设置 -->
    <SettingSection :title="t('settings.backup.basicSettings')">
      <SettingItem :title="t('settings.backup.enableBackup')">
        <ToggleSwitch 
          :modelValue="configStore.config.backup.enabled"
          @update:modelValue="configStore.setEnableBackup"
        />
      </SettingItem>

      <SettingItem
        :title="t('settings.backup.autoBackup')"
        :class="{ 'disabled-setting': !configStore.config.backup.enabled }"
      >
        <ToggleSwitch 
          :modelValue="configStore.config.backup.auto_backup"
          @update:modelValue="configStore.setAutoBackup"
          :disabled="!configStore.config.backup.enabled"
        />
      </SettingItem>

      <SettingItem
        :title="t('settings.backup.backupInterval')"
        :class="{ 'disabled-setting': !configStore.config.backup.enabled || !configStore.config.backup.auto_backup }"
      >
        <select
          class="backup-interval-select"
          :value="configStore.config.backup.backup_interval"
          @change="(e) => configStore.setBackupInterval(Number((e.target as HTMLSelectElement).value))"
          :disabled="!configStore.config.backup.enabled || !configStore.config.backup.auto_backup"
        >
          <option v-for="option in backupIntervalOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </SettingItem>
    </SettingSection>

    <!-- 仓库配置 -->
    <SettingSection :title="t('settings.backup.repositoryConfig')">
      <SettingItem :title="t('settings.backup.repoUrl')">
        <input
          type="text"
          class="repo-url-input"
          :value="configStore.config.backup.repo_url"
          @input="(e) => configStore.setRepoUrl((e.target as HTMLInputElement).value)"
          :placeholder="t('settings.backup.repoUrlPlaceholder')"
          :disabled="!configStore.config.backup.enabled"
        />
      </SettingItem>
    </SettingSection>

    <!-- 认证配置 -->
    <SettingSection :title="t('settings.backup.authConfig')">
      <SettingItem :title="t('settings.backup.authMethod')">
        <select
          class="auth-method-select"
          :value="configStore.config.backup.auth_method"
          @change="(e) => configStore.setAuthMethod((e.target as HTMLSelectElement).value as AuthMethod)"
          :disabled="!configStore.config.backup.enabled"
        >
          <option v-for="option in authMethodOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </SettingItem>

      <!-- 用户名密码认证 -->
      <template v-if="configStore.config.backup.auth_method === AuthMethod.UserPass">
        <SettingItem :title="t('settings.backup.username')">
          <input
            type="text"
            class="username-input"
            :value="configStore.config.backup.username"
            @input="(e) => configStore.setUsername((e.target as HTMLInputElement).value)"
            :placeholder="t('settings.backup.usernamePlaceholder')"
            :disabled="!configStore.config.backup.enabled"
          />
        </SettingItem>

        <SettingItem :title="t('settings.backup.password')">
          <input
            type="password"
            class="password-input"
            :value="configStore.config.backup.password"
            @input="(e) => configStore.setPassword((e.target as HTMLInputElement).value)"
            :placeholder="t('settings.backup.passwordPlaceholder')"
            :disabled="!configStore.config.backup.enabled"
          />
        </SettingItem>
      </template>

      <!-- 访问令牌认证 -->
      <template v-if="configStore.config.backup.auth_method === AuthMethod.Token">
        <SettingItem :title="t('settings.backup.token')">
          <input
            type="password"
            class="token-input"
            :value="configStore.config.backup.token"
            @input="(e) => configStore.setToken((e.target as HTMLInputElement).value)"
            :placeholder="t('settings.backup.tokenPlaceholder')"
            :disabled="!configStore.config.backup.enabled"
          />
        </SettingItem>
      </template>

      <!-- SSH密钥认证 -->
      <template v-if="configStore.config.backup.auth_method === AuthMethod.SSHKey">
        <SettingItem :title="t('settings.backup.sshKeyPath')">
          <input
            type="text"
            class="ssh-key-path-input"
            :value="configStore.config.backup.ssh_key_path"
            :placeholder="t('settings.backup.sshKeyPathPlaceholder')"
            :disabled="!configStore.config.backup.enabled"
            readonly
            @click="configStore.config.backup.enabled && selectSshKeyFile()"
          />
        </SettingItem>

        <SettingItem :title="t('settings.backup.sshKeyPassphrase')">
          <input
            type="password"
            class="ssh-passphrase-input"
            :value="configStore.config.backup.ssh_key_passphrase"
            @input="(e) => configStore.setSshKeyPassphrase((e.target as HTMLInputElement).value)"
            :placeholder="t('settings.backup.sshKeyPassphrasePlaceholder')"
            :disabled="!configStore.config.backup.enabled"
          />
        </SettingItem>
      </template>
    </SettingSection>

    <!-- 备份操作 -->
    <SettingSection :title="t('settings.backup.backupOperations')">
      <SettingItem 
        :title="t('settings.backup.syncToRemote')"
        :description="message || undefined"
        :descriptionType="message ? (isError ? 'error' : 'success') : 'default'"
      >
        <button
          class="sync-button"
          @click="backupStore.sync"
          :disabled="!configStore.config.backup.enabled || !configStore.config.backup.repo_url || backupStore.isSyncing"
          :class="{ 'syncing': backupStore.isSyncing }"
        >
          <span v-if="backupStore.isSyncing" class="loading-spinner"></span>
          {{ backupStore.isSyncing ? t('settings.backup.syncing') : t('settings.backup.actions.sync') }}
        </button>
      </SettingItem>
    </SettingSection>
  </div>
</template>

<style scoped lang="scss">
.settings-page {
  //max-width: 800px;
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

// 按钮样式
.sync-button {
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

  &.syncing {
    background-color: #2196f3;
    border-color: #2196f3;
    color: white;
  }
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