import {defineStore} from 'pinia';
import {ref} from 'vue';
import {SyncService} from '@/../bindings/voidraft/internal/services';
import {SyncConnectionResult, SyncStatus} from '@/../bindings/voidraft/internal/services/models';

export const useSyncStore = defineStore('sync', () => {
  const isSyncing = ref(false);
  const isTestingConnection = ref(false);
  const status = ref<SyncStatus | null>(null);

  /** Loads the latest sync status. */
  const loadStatus = async (): Promise<SyncStatus | null> => {
    status.value = await SyncService.GetStatus();
    return status.value;
  };

  /** Runs one sync and caches the latest status. */
  const sync = async (): Promise<SyncStatus | null> => {
    if (isSyncing.value) {
      return status.value;
    }

    isSyncing.value = true;
    try {
      status.value = await SyncService.Sync();
      return status.value;
    } catch (error) {
      await loadStatus();
      throw error;
    } finally {
      isSyncing.value = false;
    }
  };

  /** Verifies the selected target config immediately. */
  const testConnection = async (): Promise<SyncConnectionResult | null> => {
    if (isTestingConnection.value) {
      return null;
    }

    isTestingConnection.value = true;
    try {
      return await SyncService.TestConnection();
    } finally {
      isTestingConnection.value = false;
    }
  };

  return {
    isSyncing,
    isTestingConnection,
    status,
    loadStatus,
    sync,
    testConnection
  };
});
