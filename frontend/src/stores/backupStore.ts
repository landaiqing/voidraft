import { defineStore } from 'pinia';
import { ref, onScopeDispose } from 'vue';
import { BackupService } from '@/../bindings/voidraft/internal/services';
import { useConfigStore } from '@/stores/configStore';
import { createTimerManager } from '@/common/utils/timerUtils';

export const useBackupStore = defineStore('backup', () => {
  const isPushing = ref(false);
  const message = ref<string | null>(null);
  const isError = ref(false);
  
  const timer = createTimerManager();
  const configStore = useConfigStore();

  onScopeDispose(() => timer.clear());

  const pushToRemote = async () => {
    const isConfigured = Boolean(configStore.config.backup.repo_url?.trim());
    
    if (isPushing.value || !isConfigured) {
      return;
    }

    try {
      isPushing.value = true;
      message.value = null;
      timer.clear();
      
      await BackupService.PushToRemote();
      
      isError.value = false;
      message.value = 'push successful';
      timer.set(() => { message.value = null; }, 3000);
    } catch (error) {
      isError.value = true;
      message.value = error instanceof Error ? error.message : 'backup operation failed';
      timer.set(() => { message.value = null; }, 5000);
    } finally {
      isPushing.value = false;
    }
  };

  return {
    isPushing,
    message,
    isError,
    pushToRemote
  };
});