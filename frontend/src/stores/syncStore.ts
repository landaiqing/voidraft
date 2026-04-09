import {defineStore} from 'pinia';
import {computed, ref} from 'vue';
import {SyncService} from '@/../bindings/voidraft/internal/services';
import {SyncRunRecord} from '@/../bindings/voidraft/internal/models/models';

const DEFAULT_RUNS_PAGE_SIZE = 8;

export const useSyncStore = defineStore('sync', () => {
  const isSyncing = ref(false);
  const isLoadingRuns = ref(false);
  const runs = ref<SyncRunRecord[]>([]);
  const currentPage = ref(1);
  const hasMoreRuns = ref(false);
  const canLoadPrevRuns = computed(() => currentPage.value > 1);
  const canLoadNextRuns = computed(() => hasMoreRuns.value);

  /** Loads recent sync records. */
  const loadRuns = async (page = 1): Promise<void> => {
    const safePage = Math.max(page, 1);
    isLoadingRuns.value = true;
    try {
      const items = await SyncService.ListSyncRunLogs(safePage, DEFAULT_RUNS_PAGE_SIZE + 1);
      hasMoreRuns.value = items.length > DEFAULT_RUNS_PAGE_SIZE;
      runs.value = hasMoreRuns.value ? items.slice(0, DEFAULT_RUNS_PAGE_SIZE) : items;
      currentPage.value = safePage;
    } finally {
      isLoadingRuns.value = false;
    }
  };

  /** Loads previous sync log page. */
  const loadPrevRunsPage = async (): Promise<void> => {
    if (!canLoadPrevRuns.value || isLoadingRuns.value) {
      return;
    }

    await loadRuns(currentPage.value - 1);
  };

  /** Loads next sync log page. */
  const loadNextRunsPage = async (): Promise<void> => {
    if (!canLoadNextRuns.value || isLoadingRuns.value) {
      return;
    }

    await loadRuns(currentPage.value + 1);
  };

  /** Runs one sync. */
  const sync = async (): Promise<void> => {
    if (isSyncing.value) {
      return;
    }

    let syncError: unknown = null;

    isSyncing.value = true;
    try {
      await SyncService.Sync();
    } catch (error) {
      syncError = error;
    } finally {
      isSyncing.value = false;
      try {
        await loadRuns(1);
      } catch {
      }
    }

    if (syncError) {
      throw syncError;
    }
  };

  return {
    isSyncing,
    isLoadingRuns,
    runs,
    currentPage,
    hasMoreRuns,
    canLoadPrevRuns,
    canLoadNextRuns,
    loadRuns,
    loadPrevRunsPage,
    loadNextRunsPage,
    sync
  };
});
