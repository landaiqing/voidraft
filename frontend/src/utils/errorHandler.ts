import { useLogStore } from '@/stores/logStore';
import { useI18n } from 'vue-i18n';

/**
 * 创建组合式函数，用于在组件中使用错误处理
 */
export function useErrorHandler() {
  const logStore = useLogStore();
  const { t } = useI18n();

  const handleError = (error: unknown, messageKey: string) => {
    logStore.error(t(messageKey));
  };

  const safeCall = async <T>(
    operation: () => Promise<T>,
    errorMessageKey: string,
    successMessageKey?: string
  ): Promise<T | null> => {
    try {
      const result = await operation();
      if (successMessageKey) {
        logStore.info(t(successMessageKey));
      }
      return result;
    } catch (error) {
      logStore.error(t(errorMessageKey));
      return null;
    }
  };

  /**
   * 静默处理错误，不显示用户提示
   */
  const silentCall = async <T>(
    operation: () => Promise<T>
  ): Promise<T | null> => {
    try {
      return await operation();
    } catch (error) {
      // 静默忽略错误
      return null;
    }
  };

  /**
   * 创建带错误处理的数值调整器
   */
  const createSafeAdjuster = (
    adjustFn: () => Promise<void>,
    errorMessageKey: string
  ) => () => safeCall(adjustFn, errorMessageKey);

  return {
    handleError,
    safeCall,
    silentCall,
    createSafeAdjuster
  };
}

/**
 * 错误处理工具函数集合（不依赖Vue上下文）
 */
export const ErrorUtils = {
  /**
   * 静默处理错误
   */
  silent: async <T>(operation: () => Promise<T>): Promise<T | null> => {
    try {
      return await operation();
    } catch (error) {
      return null;
    }
  },

  /**
   * 带重试的错误处理
   */
  withRetry: async <T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T | null> => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === maxRetries - 1) {
          return null;
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    return null;
  }
}; 