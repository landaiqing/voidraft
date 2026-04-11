<script setup lang="ts">
import {computed, onMounted} from 'vue';
import {useI18n} from 'vue-i18n';
import {AuthMethod, SyncRunRecord, SyncRunStatus, SyncRunTriggerType, SyncTarget} from '@/../bindings/voidraft/internal/models/models';
import {DialogService} from '@/../bindings/voidraft/internal/services';
import toast from '@/components/toast';
import {useConfigStore} from '@/stores/configStore';
import {useDocumentStore} from '@/stores/documentStore';
import {useEditorStore} from '@/stores/editorStore';
import {useSyncStore} from '@/stores/syncStore';
import SettingItem from '../components/SettingItem.vue';
import SettingSection from '../components/SettingSection.vue';
import ToggleSwitch from '../components/ToggleSwitch.vue';

const {t} = useI18n();
const configStore = useConfigStore();
const documentStore = useDocumentStore();
const editorStore = useEditorStore();
const syncStore = useSyncStore();

const syncConfig = computed(() => configStore.config.sync);
const isGitTarget = computed(() => syncConfig.value.target === SyncTarget.SyncTargetGit);
const isSyncEnabled = computed(() => syncConfig.value.enabled);
const isAutoSyncEnabled = computed(() => syncConfig.value.auto_sync);
const currentInterval = computed(() => syncConfig.value.sync_interval);
const hasTargetConfig = computed(() => (
  isGitTarget.value
    ? Boolean(syncConfig.value.git.repo_url.trim())
    : Boolean(syncConfig.value.localfs.root_path.trim())
));
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

const formatRunTime = (value: string): string => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

const formatRunDuration = (run: SyncRunRecord): string => {
  const startedAt = new Date(run.started_at);
  const finishedAt = new Date(run.finished_at);
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(finishedAt.getTime())) {
    return '-';
  }

  const durationMs = Math.max(finishedAt.getTime() - startedAt.getTime(), 0);
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  return `${(durationMs / 1000).toFixed(durationMs >= 10000 ? 0 : 1)}s`;
};

const formatRunStatus = (status: SyncRunStatus): string => {
  return status === SyncRunStatus.SyncRunStatusSuccess
    ? t('settings.sync.historyStatus.success')
    : t('settings.sync.historyStatus.failed');
};

const formatRunTrigger = (trigger: SyncRunTriggerType): string => {
  return trigger === SyncRunTriggerType.SyncRunTriggerAuto
    ? t('settings.sync.historyTrigger.auto')
    : t('settings.sync.historyTrigger.manual');
};

const formatRunTarget = (target: SyncTarget): string => {
  return target === SyncTarget.SyncTargetLocalFS
    ? t('settings.sync.targetTypes.localfs')
    : t('settings.sync.targetTypes.git');
};

const formatRunSummary = (run: SyncRunRecord): string => {
  const parts: string[] = [];
  const {flow, changes, error} = run.details;

  if (flow.pulled && flow.pushed) {
    parts.push(t('settings.sync.historyFlow.pulledAndPushed'));
  } else if (flow.pulled) {
    parts.push(t('settings.sync.historyFlow.pulled'));
  } else if (flow.pushed) {
    parts.push(t('settings.sync.historyFlow.pushed'));
  }

  const changed = changes.added + changes.updated + changes.deleted;
  if (changed > 0) {
    parts.push(`+${changes.added} ~${changes.updated} -${changes.deleted}`);
  } else {
    parts.push(t('settings.sync.historyFlow.noChanges'));
  }

  if (run.status === SyncRunStatus.SyncRunStatusFailed && error?.stage) {
    parts.push(error.stage);
  }

  return parts.join(' · ');
};

const handlePrevPage = async () => {
  await syncStore.loadPrevRunsPage();
};

const handleNextPage = async () => {
  await syncStore.loadNextRunsPage();
};

/** Runs one manual sync. */
const handleSync = async () => {
  try {
    await editorStore.saveAllDirtyEditors();
    await syncStore.sync();
    editorStore.clearEditorCache();

    const currentDocument = await documentStore.reloadCurrentDocument();
    if (currentDocument) {
      await editorStore.loadEditor(currentDocument);
    }

    toast.success(t('settings.sync.syncSuccess'));
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
  }
};

onMounted(async () => {
  if (syncStore.runs.length === 0) {
    await syncStore.loadRuns(1);
  }
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
            @change="(e) => configStore.setRepoUrl((e.target as HTMLInputElement).value)"
          />
        </SettingItem>

        <SettingItem :title="t('settings.sync.branch')">
          <input
            type="text"
            class="branch-input"
            :value="syncConfig.git.branch"
            :placeholder="t('settings.sync.branchPlaceholder')"
            :disabled="!isSyncEnabled"
            @change="(e) => configStore.setGitBranch((e.target as HTMLInputElement).value)"
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
            @change="(e) => configStore.setUsername((e.target as HTMLInputElement).value)"
          />
        </SettingItem>

        <SettingItem :title="t('settings.sync.password')">
          <input
            type="password"
            class="password-input"
            :value="syncConfig.git.password ?? ''"
            :placeholder="t('settings.sync.passwordPlaceholder')"
            :disabled="!isSyncEnabled"
            @change="(e) => configStore.setPassword((e.target as HTMLInputElement).value)"
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
            @change="(e) => configStore.setToken((e.target as HTMLInputElement).value)"
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
            @change="(e) => configStore.setSshKeyPassphrase((e.target as HTMLInputElement).value)"
          />
        </SettingItem>
      </template>
    </SettingSection>

    <SettingSection :title="t('settings.sync.syncOperations')">
      <SettingItem :title="t('settings.sync.syncToTarget')">
        <div class="sync-action">
          <div class="sync-actions">
            <button
              class="sync-button"
              :disabled="!canSync || syncStore.isSyncing"
              :class="{ 'syncing': syncStore.isSyncing }"
              @click="handleSync"
            >
              <span v-if="syncStore.isSyncing" class="loading-spinner"></span>
              {{ syncStore.isSyncing ? t('settings.sync.syncing') : t('settings.sync.actions.sync') }}
            </button>
          </div>
        </div>
      </SettingItem>
    </SettingSection>

    <SettingSection :title="t('settings.sync.syncHistory')">
      <div v-if="syncStore.isLoadingRuns" class="sync-history-empty">
        {{ t('settings.sync.historyLoading') }}
      </div>

      <div v-else-if="syncStore.runs.length === 0" class="sync-history-empty">
        {{ t('settings.sync.historyEmpty') }}
      </div>

      <div v-else class="sync-history-list">
        <div
          v-for="run in syncStore.runs"
          :key="run.id"
          class="sync-history-item"
        >
          <div class="sync-history-row sync-history-row-primary">
            <span class="sync-history-time">{{ formatRunTime(run.started_at) }}</span>
            <span class="sync-history-meta">
              {{ formatRunTarget(run.target_type) }} · {{ formatRunTrigger(run.trigger_type) }} · {{ formatRunDuration(run) }}<template v-if="run.branch"> · {{ run.branch }}</template>
            </span>
            <span
              class="sync-history-status"
              :class="{ success: run.status === SyncRunStatus.SyncRunStatusSuccess, failed: run.status === SyncRunStatus.SyncRunStatusFailed }"
            >
              {{ formatRunStatus(run.status) }}
            </span>
          </div>

          <div class="sync-history-row sync-history-row-secondary">
            <span class="sync-history-path" :title="run.target_path || '-'">
              {{ run.target_path || '-' }}
            </span>
            <span class="sync-history-summary" :title="run.details.error?.message || formatRunSummary(run)">
              {{ formatRunSummary(run) }}
            </span>
          </div>

          <details class="sync-history-details">
            <summary>
              <span class="sync-history-details-arrow"></span>
              <span>{{ t('settings.sync.historyDetails') }}</span>
            </summary>
            <div class="sync-history-detail-grid">
              <div>{{ t('settings.sync.historyFields.attempt') }}: {{ run.details.attempt }}/{{ run.details.max_attempts }}</div>
              <div>{{ t('settings.sync.historyFields.pulled') }}: {{ run.details.flow.pulled ? t('settings.sync.historyBoolean.yes') : t('settings.sync.historyBoolean.no') }}</div>
              <div>{{ t('settings.sync.historyFields.pushed') }}: {{ run.details.flow.pushed ? t('settings.sync.historyBoolean.yes') : t('settings.sync.historyBoolean.no') }}</div>
              <div>{{ t('settings.sync.historyFields.changes') }}: +{{ run.details.changes.added }} ~{{ run.details.changes.updated }} -{{ run.details.changes.deleted }}</div>
              <div v-if="run.details.error?.stage">{{ t('settings.sync.historyFields.errorStage') }}: {{ run.details.error.stage }}</div>
              <div v-if="run.details.error?.message">{{ t('settings.sync.historyFields.errorMessage') }}: {{ run.details.error.message }}</div>
              <div v-if="run.details.paths.data_path">{{ t('settings.sync.historyFields.dataPath') }}: {{ run.details.paths.data_path }}</div>
              <div v-if="run.details.paths.repo_path">{{ t('settings.sync.historyFields.repoPath') }}: {{ run.details.paths.repo_path }}</div>
            </div>
          </details>
        </div>
      </div>

      <div
        v-if="syncStore.runs.length > 0 && (syncStore.currentPage > 1 || syncStore.hasMoreRuns)"
        class="sync-history-pagination"
      >
        <button
          class="sync-page-button"
          :disabled="!syncStore.canLoadPrevRuns || syncStore.isLoadingRuns"
          @click="handlePrevPage"
        >
          {{ t('settings.sync.pagination.prev') }}
        </button>
        <span class="sync-page-indicator">
          {{ t('settings.sync.pagination.page', { page: syncStore.currentPage }) }}
        </span>
        <button
          class="sync-page-button"
          :disabled="!syncStore.canLoadNextRuns || syncStore.isLoadingRuns"
          @click="handleNextPage"
        >
          {{ t('settings.sync.pagination.next') }}
        </button>
      </div>
    </SettingSection>
  </div>
</template>

<style scoped lang="scss">
.repo-url-input,
.branch-input,
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

.sync-history-empty {
  color: var(--settings-text-secondary);
  font-size: 12px;
}

.sync-history-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.sync-history-item {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid var(--settings-input-border);
  border-radius: 6px;
  background-color: var(--settings-input-bg);
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: hidden;
}

.sync-history-row {
  display: grid;
  min-width: 0;
  gap: 12px;
  align-items: center;
}

.sync-history-row-primary {
  grid-template-columns: auto minmax(0, 1fr) auto;
}

.sync-history-row-secondary {
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

.sync-history-time {
  font-size: 12px;
  color: var(--settings-text);
  white-space: nowrap;
}

.sync-history-meta,
.sync-history-branch,
.sync-history-summary,
.sync-history-path,
.sync-history-detail-grid {
  font-size: 11px;
  color: var(--settings-text-secondary);
}

.sync-history-meta,
.sync-history-branch,
.sync-history-summary,
.sync-history-path {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sync-history-path {
  color: var(--settings-text);
}

.sync-history-status {
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 11px;
  border: 1px solid var(--settings-input-border);
  white-space: nowrap;

  &.success {
    color: #20c997;
    border-color: rgba(32, 201, 151, 0.35);
    background-color: rgba(32, 201, 151, 0.08);
  }

  &.failed {
    color: #ff6b6b;
    border-color: rgba(255, 107, 107, 0.35);
    background-color: rgba(255, 107, 107, 0.08);
  }
}

.sync-history-details {
  font-size: 11px;

  summary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    color: var(--settings-text);
    user-select: none;
    list-style: none;

    &::-webkit-details-marker {
      display: none;
    }
  }

  &[open] .sync-history-details-arrow {
    transform: rotate(90deg);
  }
}

.sync-history-details-arrow {
  width: 0;
  height: 0;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-left: 5px solid var(--settings-text-secondary);
  transition: transform 0.18s ease;
}

.sync-history-detail-grid {
  margin-top: 6px;
  display: grid;
  gap: 4px;

  > div {
    overflow-wrap: anywhere;
  }
}

.sync-history-pagination {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.sync-page-button {
  padding: 4px 10px;
  border: 1px solid var(--settings-input-border);
  border-radius: 4px;
  background-color: var(--settings-input-bg);
  color: var(--settings-text);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background-color: var(--settings-hover);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.sync-page-indicator {
  font-size: 11px;
  color: var(--settings-text-secondary);
  white-space: nowrap;
}

.sync-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
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
