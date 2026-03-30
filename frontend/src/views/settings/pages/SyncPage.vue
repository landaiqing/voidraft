<script setup lang="ts">
import {computed, onMounted} from 'vue';
import {useI18n} from 'vue-i18n';
import {AuthMethod, SyncTarget} from '@/../bindings/voidraft/internal/models/models';
import {DialogService} from '@/../bindings/voidraft/internal/services';
import toast from '@/components/toast';
import {useConfigStore} from '@/stores/configStore';
import {useSyncStore} from '@/stores/syncStore';
import SettingItem from '../components/SettingItem.vue';
import SettingSection from '../components/SettingSection.vue';
import ToggleSwitch from '../components/ToggleSwitch.vue';

const {t} = useI18n();
const configStore = useConfigStore();
const syncStore = useSyncStore();

const syncConfig = computed(() => configStore.config.sync);
const isGitTarget = computed(() => syncConfig.value.target === SyncTarget.SyncTargetGit);
const isSyncEnabled = computed(() => isGitTarget.value ? syncConfig.value.git.enabled : syncConfig.value.localfs.enabled);
const isAutoSyncEnabled = computed(() => isGitTarget.value ? syncConfig.value.git.auto_sync : syncConfig.value.localfs.auto_sync);
const currentInterval = computed(() => isGitTarget.value ? syncConfig.value.git.sync_interval : syncConfig.value.localfs.sync_interval);
const syncStatus = computed(() => syncStore.status);
const lastSyncText = computed(() => formatTimestamp(syncStatus.value?.last_sync_at));
const lastSuccessText = computed(() => formatTimestamp(syncStatus.value?.last_success_at));
const hasTargetConfig = computed(() => (
  isGitTarget.value
    ? Boolean(syncConfig.value.git.repo_url.trim())
    : Boolean(syncConfig.value.localfs.root_path.trim())
));
const canTestConnection = computed(() => hasTargetConfig.value);
const canSync = computed(() => isSyncEnabled.value && hasTargetConfig.value);

const authMethodOptions = computed(() => [
  {value: AuthMethod.Token, label: t('settings.sync.authMethods.token')},
  {value: AuthMethod.SSHKey, label: t('settings.sync.authMethods.sshKey')},
  {value: AuthMethod.UserPass, label: t('settings.sync.authMethods.userPass')}
]);

const syncTargetOptions = computed(() => [
  {value: SyncTarget.SyncTargetGit, label: t('settings.sync.targetTypes.git')},
  {value: SyncTarget.SyncTargetLocalFS, label: t('settings.sync.targetTypes.localfs')}
]);

const syncIntervalOptions = computed(() => [
  {value: 5, label: t('settings.sync.intervals.5min')},
  {value: 10, label: t('settings.sync.intervals.10min')},
  {value: 15, label: t('settings.sync.intervals.15min')},
  {value: 30, label: t('settings.sync.intervals.30min')},
  {value: 60, label: t('settings.sync.intervals.1hour')}
]);

const selectSshKeyFile = async () => {
  const selectedPath = await DialogService.SelectFile();
  if (selectedPath.trim()) {
    await configStore.setSshKeyPath(selectedPath.trim());
  }
};

const selectLocalFSDirectory = async () => {
  const selectedPath = await DialogService.SelectDirectory();
  if (selectedPath.trim()) {
    await configStore.setLocalFSRootPath(selectedPath.trim());
  }
};

/** Tests the current sync target immediately. */
const handleTestConnection = async () => {
  try {
    const result = await syncStore.testConnection();
    if (result?.resolved_branch) {
      toast.success(t('settings.sync.testConnectionSuccessWithBranch', {branch: result.resolved_branch}));
      return;
    }
    toast.success(t('settings.sync.testConnectionSuccess'));
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
  }
};

/** Runs one manual sync. */
const handleSync = async () => {
  try {
    await syncStore.sync();
    toast.success(t('settings.sync.syncSuccess'));
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
  }
};

/** Formats a sync timestamp for display. */
const formatTimestamp = (value?: string) => (
  value ? new Date(value).toLocaleString() : t('settings.none')
);

onMounted(() => {
  void syncStore.loadStatus();
});
</script>

<template>
  <div class="settings-page">
    <SettingSection :title="t('settings.sync.basicSettings')">
      <SettingItem :title="t('settings.sync.enableSync')">
        <ToggleSwitch
          :modelValue="isSyncEnabled"
          @update:modelValue="configStore.setEnableSync"
        />
      </SettingItem>

      <SettingItem :title="t('settings.sync.targetType')">
        <select
          class="target-type-select"
          :value="syncConfig.target"
          @change="(e) => configStore.setSyncTarget((e.target as HTMLSelectElement).value as SyncTarget)"
        >
          <option v-for="option in syncTargetOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </SettingItem>

      <SettingItem
        :title="t('settings.sync.autoSync')"
        :class="{ 'disabled-setting': !isSyncEnabled }"
      >
        <ToggleSwitch
          :modelValue="isAutoSyncEnabled"
          :disabled="!isSyncEnabled"
          @update:modelValue="configStore.setAutoSync"
        />
      </SettingItem>

      <SettingItem
        :title="t('settings.sync.syncInterval')"
        :class="{ 'disabled-setting': !isSyncEnabled || !isAutoSyncEnabled }"
      >
        <select
          class="sync-interval-select"
          :value="currentInterval"
          :disabled="!isSyncEnabled || !isAutoSyncEnabled"
          @change="(e) => configStore.setSyncInterval(Number((e.target as HTMLSelectElement).value))"
        >
          <option v-for="option in syncIntervalOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </SettingItem>
    </SettingSection>

    <SettingSection :title="isGitTarget ? t('settings.sync.repositoryConfig') : t('settings.sync.storageConfig')">
      <template v-if="isGitTarget">
        <SettingItem :title="t('settings.sync.repoUrl')">
          <input
            type="text"
            class="repo-url-input"
            :value="syncConfig.git.repo_url"
            :placeholder="t('settings.sync.repoUrlPlaceholder')"
            :disabled="!isSyncEnabled"
            @input="(e) => configStore.setRepoUrl((e.target as HTMLInputElement).value)"
          />
        </SettingItem>
      </template>

      <template v-else>
        <SettingItem :title="t('settings.sync.localfsRootPath')">
          <input
            type="text"
            class="localfs-root-path-input"
            :value="syncConfig.localfs.root_path"
            :placeholder="t('settings.sync.localfsRootPathPlaceholder')"
            :disabled="!isSyncEnabled"
            readonly
            @click="isSyncEnabled && selectLocalFSDirectory()"
          />
        </SettingItem>
      </template>
    </SettingSection>

    <SettingSection v-if="isGitTarget" :title="t('settings.sync.authConfig')">
      <SettingItem :title="t('settings.sync.authMethod')">
        <select
          class="auth-method-select"
          :value="syncConfig.git.auth_method"
          :disabled="!isSyncEnabled"
          @change="(e) => configStore.setAuthMethod((e.target as HTMLSelectElement).value as AuthMethod)"
        >
          <option v-for="option in authMethodOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </SettingItem>

      <template v-if="syncConfig.git.auth_method === AuthMethod.UserPass">
        <SettingItem :title="t('settings.sync.username')">
          <input
            type="text"
            class="username-input"
            :value="syncConfig.git.username ?? ''"
            :placeholder="t('settings.sync.usernamePlaceholder')"
            :disabled="!isSyncEnabled"
            @input="(e) => configStore.setUsername((e.target as HTMLInputElement).value)"
          />
        </SettingItem>

        <SettingItem :title="t('settings.sync.password')">
          <input
            type="password"
            class="password-input"
            :value="syncConfig.git.password ?? ''"
            :placeholder="t('settings.sync.passwordPlaceholder')"
            :disabled="!isSyncEnabled"
            @input="(e) => configStore.setPassword((e.target as HTMLInputElement).value)"
          />
        </SettingItem>
      </template>

      <template v-if="syncConfig.git.auth_method === AuthMethod.Token">
        <SettingItem :title="t('settings.sync.token')">
          <input
            type="password"
            class="token-input"
            :value="syncConfig.git.token ?? ''"
            :placeholder="t('settings.sync.tokenPlaceholder')"
            :disabled="!isSyncEnabled"
            @input="(e) => configStore.setToken((e.target as HTMLInputElement).value)"
          />
        </SettingItem>
      </template>

      <template v-if="syncConfig.git.auth_method === AuthMethod.SSHKey">
        <SettingItem :title="t('settings.sync.sshKeyPath')">
          <input
            type="text"
            class="ssh-key-path-input"
            :value="syncConfig.git.ssh_key_path ?? ''"
            :placeholder="t('settings.sync.sshKeyPathPlaceholder')"
            :disabled="!isSyncEnabled"
            readonly
            @click="isSyncEnabled && selectSshKeyFile()"
          />
        </SettingItem>

        <SettingItem :title="t('settings.sync.sshKeyPassphrase')">
          <input
            type="password"
            class="ssh-passphrase-input"
            :value="syncConfig.git.ssh_key_passphrase ?? ''"
            :placeholder="t('settings.sync.sshKeyPassphrasePlaceholder')"
            :disabled="!isSyncEnabled"
            @input="(e) => configStore.setSshKeyPassphrase((e.target as HTMLInputElement).value)"
          />
        </SettingItem>
      </template>
    </SettingSection>

    <SettingSection :title="t('settings.sync.syncOperations')">
      <SettingItem :title="t('settings.sync.syncToTarget')">
        <div class="sync-action">
          <div class="sync-actions">
            <button
              class="sync-button secondary"
              :disabled="!canTestConnection || syncStore.isSyncing || syncStore.isTestingConnection"
              @click="handleTestConnection"
            >
              <span v-if="syncStore.isTestingConnection" class="loading-spinner"></span>
              {{ syncStore.isTestingConnection ? t('settings.sync.testingConnection') : t('settings.sync.actions.testConnection') }}
            </button>

            <button
              class="sync-button"
              :disabled="!canSync || syncStore.isSyncing || syncStore.isTestingConnection"
              :class="{ 'syncing': syncStore.isSyncing }"
              @click="handleSync"
            >
              <span v-if="syncStore.isSyncing" class="loading-spinner"></span>
              {{ syncStore.isSyncing ? t('settings.sync.syncing') : t('settings.sync.actions.sync') }}
            </button>
          </div>

          <div v-if="syncStatus" class="sync-status">
            <div>{{ t('settings.sync.lastSync') }}: {{ lastSyncText }}</div>
            <div>{{ t('settings.sync.lastSuccess') }}: {{ lastSuccessText }}</div>
            <div v-if="syncStatus.last_error" class="sync-status-error">
              {{ t('settings.sync.lastError') }}: {{ syncStatus.last_error }}
            </div>
          </div>
        </div>
      </SettingItem>
    </SettingSection>
  </div>
</template>

<style scoped lang="scss">
.repo-url-input,
.localfs-root-path-input,
.username-input,
.password-input,
.token-input,
.ssh-key-path-input,
.ssh-passphrase-input,
.sync-interval-select,
.auth-method-select,
.target-type-select {
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

.sync-interval-select,
.auth-method-select,
.target-type-select {
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

  &.secondary {
    background-color: transparent;
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

.sync-action {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}

.sync-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.sync-status {
  font-size: 12px;
  color: var(--settings-text-secondary);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sync-status-error {
  color: #ff7875;
}

.disabled-setting {
  opacity: 0.5;
  pointer-events: none;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}
</style>
