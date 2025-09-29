import { defineStore } from 'pinia';
import { computed, readonly, ref, shallowRef, watchEffect, onScopeDispose } from 'vue';
import type { GitBackupConfig } from '@/../bindings/voidraft/internal/models';
import { BackupService } from '@/../bindings/voidraft/internal/services';
import { useConfigStore } from '@/stores/configStore';
import { createTimerManager } from '@/common/utils/timerUtils';

// 备份状态枚举
export enum BackupStatus {
  IDLE = 'idle',
  PUSHING = 'pushing',
  SUCCESS = 'success',
  ERROR = 'error'
}

// 备份操作结果类型
export interface BackupResult {
  status: BackupStatus;
  message?: string;
  timestamp?: number;
}

// 类型守卫函数
const isBackupError = (error: unknown): error is Error => {
  return error instanceof Error;
};

// 工具类型：提取错误消息
type ErrorMessage<T> = T extends Error ? string : string;


export const useBackupStore = defineStore('backup', () => {
  // === 核心状态 ===
  const config = shallowRef<GitBackupConfig | null>(null);

  // 统一的备份结果状态
  const backupResult = ref<BackupResult>({
    status: BackupStatus.IDLE
  });

  // === 定时器管理 ===
  const statusTimer = createTimerManager();
  
  // 组件卸载时清理定时器
  onScopeDispose(() => {
    statusTimer.clear();
  });

  // === 外部依赖 ===
  const configStore = useConfigStore();

  // === 计算属性 ===
  const isEnabled = computed(() => configStore.config.backup.enabled);
  const isConfigured = computed(() => Boolean(configStore.config.backup.repo_url?.trim()));
  
  // 派生状态计算属性
  const isPushing = computed(() => backupResult.value.status === BackupStatus.PUSHING);
  const isSuccess = computed(() => backupResult.value.status === BackupStatus.SUCCESS);
  const isError = computed(() => backupResult.value.status === BackupStatus.ERROR);
  const errorMessage = computed(() => 
    backupResult.value.status === BackupStatus.ERROR ? backupResult.value.message : null
  );

  // === 状态管理方法 ===
  
  /**
   * 设置备份状态
   * @param status 备份状态
   * @param message 可选消息
   * @param autoHide 是否自动隐藏（毫秒）
   */
  const setBackupStatus = <T extends BackupStatus>(
    status: T,
    message?: T extends BackupStatus.ERROR ? string : string,
    autoHide?: number
  ): void => {
    statusTimer.clear();
    
    backupResult.value = {
      status,
      message,
      timestamp: Date.now()
    };

    // 自动隐藏逻辑
    if (autoHide && (status === BackupStatus.SUCCESS || status === BackupStatus.ERROR)) {
      statusTimer.set(() => {
        if (backupResult.value.status === status) {
          backupResult.value = { status: BackupStatus.IDLE };
        }
      }, autoHide);
    }
  };

  /**
   * 清除当前状态
   */
  const clearStatus = (): void => {
    statusTimer.clear();
    backupResult.value = { status: BackupStatus.IDLE };
  };

  /**
   * 处理错误的通用方法
   */
  const handleError = (error: unknown): void => {
    const message: ErrorMessage<typeof error> = isBackupError(error) 
      ? error.message 
      : 'Backup operation failed';
    
    setBackupStatus(BackupStatus.ERROR, message, 5000);
  };

  // === 业务逻辑方法 ===
  
  /**
   * 推送到远程仓库
   * 使用现代 async/await 和错误处理
   */
  const pushToRemote = async (): Promise<void> => {
    // 前置条件检查
    if (isPushing.value || !isConfigured.value) {
      return;
    }

    try {
      setBackupStatus(BackupStatus.PUSHING);
      
      await BackupService.PushToRemote();
      
      setBackupStatus(BackupStatus.SUCCESS, 'Backup completed successfully', 3000);
    } catch (error) {
      handleError(error);
    }
  };

  /**
   * 重试备份操作
   */
  const retryBackup = async (): Promise<void> => {
    if (isError.value) {
      await pushToRemote();
    }
  };

  // === 响应式副作用 ===
  
  // 监听配置变化，自动清除错误状态
  watchEffect(() => {
    if (isEnabled.value && isConfigured.value && isError.value) {
      // 配置修复后清除错误状态
      clearStatus();
    }
  });

  // === 返回的 API ===
  return {
    // 只读状态
    config: readonly(config),
    backupResult: readonly(backupResult),

    // 计算属性
    isEnabled,
    isConfigured,
    isPushing,
    isSuccess,
    isError,
    errorMessage,

    // 方法
    pushToRemote,
    retryBackup,
    clearStatus
  } as const;
});