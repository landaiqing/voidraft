import { defineStore } from 'pinia';
import { ref } from 'vue';
import { BackupService } from '@/../bindings/voidraft/internal/services';

export const useBackupStore = defineStore('backup', () => {
  const isSyncing = ref(false);
  const error = ref<string | null>(null);

  const sync = async (): Promise<void> => {
    if (isSyncing.value) {
      return;
    }

    isSyncing.value = true;
    error.value = null;

    try {
      await BackupService.Sync();
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      isSyncing.value = false;
    }
  };

  return {
    isSyncing,
    error,
    sync
  };
});