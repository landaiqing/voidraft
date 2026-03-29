import { defineStore } from 'pinia';
import { ref } from 'vue';
import { SyncService } from '@/../bindings/voidraft/internal/services';

export const useSyncStore = defineStore('sync', () => {
  const isSyncing = ref(false);

  const sync = async (): Promise<void> => {
    if (isSyncing.value) {
      return;
    }

    isSyncing.value = true;
    try {
      await SyncService.Sync();
    } finally {
      isSyncing.value = false;
    }
  };

  return {
    isSyncing,
    sync
  };
});
