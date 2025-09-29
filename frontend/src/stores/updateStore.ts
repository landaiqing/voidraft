import { defineStore } from 'pinia';
import { computed, readonly, ref, shallowRef, onScopeDispose } from 'vue';
import { CheckForUpdates, ApplyUpdate, RestartApplication } from '@/../bindings/voidraft/internal/services/selfupdateservice';
import { SelfUpdateResult } from '@/../bindings/voidraft/internal/services/models';
import { useConfigStore } from './configStore';
import { createTimerManager } from '@/common/utils/timerUtils';
import * as runtime from "@wailsio/runtime";

// 更新状态枚举
export enum UpdateStatus {
  IDLE = 'idle',
  CHECKING = 'checking',
  UPDATE_AVAILABLE = 'update_available',
  UPDATING = 'updating',
  UPDATE_SUCCESS = 'update_success',
  ERROR = 'error'
}

// 更新操作结果类型
export interface UpdateOperationResult {
  status: UpdateStatus;
  result?: SelfUpdateResult;
  message?: string;
  timestamp?: number;
}

// 类型守卫函数
const isUpdateError = (error: unknown): error is Error => {
  return error instanceof Error;
};

export const useUpdateStore = defineStore('update', () => {
  // === 核心状态 ===
  const hasCheckedOnStartup = ref(false);
  
  // 统一的更新操作结果状态
  const updateOperation = ref<UpdateOperationResult>({
    status: UpdateStatus.IDLE
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
  
  // 派生状态计算属性
  const isChecking = computed(() => updateOperation.value.status === UpdateStatus.CHECKING);
  const isUpdating = computed(() => updateOperation.value.status === UpdateStatus.UPDATING);
  const hasUpdate = computed(() => updateOperation.value.status === UpdateStatus.UPDATE_AVAILABLE);
  const updateSuccess = computed(() => updateOperation.value.status === UpdateStatus.UPDATE_SUCCESS);
  const isError = computed(() => updateOperation.value.status === UpdateStatus.ERROR);
  
  // 数据访问计算属性
  const updateResult = computed(() => updateOperation.value.result || undefined);
  const errorMessage = computed(() => 
    updateOperation.value.status === UpdateStatus.ERROR ? updateOperation.value.message : ''
  );

  // === 状态管理方法 ===
  
  /**
   * 设置更新状态
   * @param status 更新状态
   * @param result 可选的更新结果
   * @param message 可选消息
   * @param autoHide 是否自动隐藏（毫秒）
   */
  const setUpdateStatus = <T extends UpdateStatus>(
    status: T,
    result?: SelfUpdateResult,
    message?: string,
    autoHide?: number
  ): void => {
    updateOperation.value = {
      status,
      result,
      message,
      timestamp: Date.now()
    };

    // 自动隐藏功能
    if (autoHide && autoHide > 0) {
      statusTimer.set(() => {
        if (updateOperation.value.status === status) {
          updateOperation.value = { status: UpdateStatus.IDLE };
        }
      }, autoHide);
    }
  };

  /**
   * 清除状态
   */
  const clearStatus = (): void => {
    statusTimer.clear();
    updateOperation.value = { status: UpdateStatus.IDLE };
  };

  // === 业务方法 ===

  /**
   * 检查更新
   * @returns Promise<boolean> 是否成功检查
   */
  const checkForUpdates = async (): Promise<boolean> => {
    if (isChecking.value) return false;

    setUpdateStatus(UpdateStatus.CHECKING);
    
    try {
      const result = await CheckForUpdates();
      
      if (result?.error) {
        setUpdateStatus(UpdateStatus.ERROR, result, result.error);
        return false;
      }
      
      if (result?.hasUpdate) {
        setUpdateStatus(UpdateStatus.UPDATE_AVAILABLE, result);
        return true;
      }
      
      // 没有更新，设置为空闲状态
      setUpdateStatus(UpdateStatus.IDLE, result || undefined);
      return true;
      
    } catch (error) {
      const message = isUpdateError(error) ? error.message : 'Network error';
      setUpdateStatus(UpdateStatus.ERROR, undefined, message);
      return false;
    }
  };

  /**
   * 应用更新
   * @returns Promise<boolean> 是否成功应用更新
   */
  const applyUpdate = async (): Promise<boolean> => {
    if (isUpdating.value) return false;

    setUpdateStatus(UpdateStatus.UPDATING);
    
    try {
      const result = await ApplyUpdate();
      
      if (result?.error) {
        setUpdateStatus(UpdateStatus.ERROR, result || undefined, result.error);
        return false;
      }
      
      if (result?.updateApplied) {
        setUpdateStatus(UpdateStatus.UPDATE_SUCCESS, result || undefined);
        return true;
      }
      
      setUpdateStatus(UpdateStatus.ERROR, result || undefined, 'Update failed');
      return false;
      
    } catch (error) {
      const message = isUpdateError(error) ? error.message : 'Update failed';
      setUpdateStatus(UpdateStatus.ERROR, undefined, message);
      return false;
    }
  };

  /**
   * 重启应用
   * @returns Promise<boolean> 是否成功重启
   */
  const restartApplication = async (): Promise<boolean> => {
    try {
      await RestartApplication();
      return true;
    } catch (error) {
      const message = isUpdateError(error) ? error.message : 'Restart failed';
      setUpdateStatus(UpdateStatus.ERROR, undefined, message);
      return false;
    }
  };

  /**
   * 启动时检查更新
   */
  const checkOnStartup = async (): Promise<void> => {
    if (hasCheckedOnStartup.value) return;
    
    if (configStore.config.updates.autoUpdate) {
      await checkForUpdates();
    }
    hasCheckedOnStartup.value = true;
  };

  /**
   * 打开发布页面
   */
  const openReleaseURL = async (): Promise<void> => {
    const result = updateResult.value;
    if (result?.assetURL) {
      await runtime.Browser.OpenURL(result.assetURL);
    }
  };

  // === 公共接口 ===
  return {
    // 只读状态
    hasCheckedOnStartup: readonly(hasCheckedOnStartup),
    
    // 计算属性
    isChecking,
    isUpdating,
    hasUpdate,
    updateSuccess,
    isError,
    updateResult,
    errorMessage,

    // 方法
    checkForUpdates,
    applyUpdate,
    restartApplication,
    checkOnStartup,
    openReleaseURL,
    clearStatus,
    
    // 内部状态管理
    setUpdateStatus
  };
});