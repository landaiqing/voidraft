import { defineStore } from 'pinia';
import { ref } from 'vue';
import { BackupService } from '@/../bindings/voidraft/internal/services';

export const useBackupStore = defineStore('backup', () => {
  const isSyncing = ref(false);

  const sync = async (): Promise<void> => {
    if (isSyncing.value) {
      return;
    }

    isSyncing.value = true;

    try {
      await BackupService.Sync();
    } catch (e) {
      throw e;
    } finally {
      isSyncing.value = false;
    }
  };

  return {
    isSyncing,
    sync
  };
});