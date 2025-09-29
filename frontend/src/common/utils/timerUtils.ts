/**
 * 定时器管理工具类
 * 提供安全的定时器创建、清理和管理功能
 */

/**
 * 定时器管理器接口
 */
export interface TimerManager {
  /** 当前定时器 ID */
  readonly timerId: number | null;
  /** 清除定时器 */
  clear(): void;
  /** 设置定时器 */
  set(callback: () => void, delay: number): void;
}

/**
 * 创建定时器管理器工厂函数
 * 提供安全的定时器管理，自动处理清理和重置
 * 
 * @returns 定时器管理器实例
 * 
 * @example
 * ```typescript
 * const timer = createTimerManager();
 * 
 * // 设置定时器
 * timer.set(() => {
 *   console.log('Timer executed');
 * }, 1000);
 * 
 * // 清除定时器
 * timer.clear();
 * 
 * // 检查定时器状态
 * if (timer.timerId !== null) {
 *   console.log('Timer is running');
 * }
 * ```
 */
export const createTimerManager = (): TimerManager => {
  let timerId: number | null = null;
  
  return {
    get timerId() { 
      return timerId; 
    },
    
    clear() {
      if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
      }
    },
    
    set(callback: () => void, delay: number) {
      // 先清除现有定时器
      this.clear();
      
      // 设置新定时器
      timerId = window.setTimeout(() => {
        callback();
        timerId = null; // 执行完成后自动重置
      }, delay);
    }
  };
};

/**
 * 创建带有自动清理功能的定时器
 * 适用于需要在组件卸载时自动清理的场景
 * 
 * @param onCleanup 清理回调函数，通常在 onScopeDispose 或 onUnmounted 中调用
 * @returns 定时器管理器实例
 * 
 * @example
 * ```typescript
 * import { onScopeDispose } from 'vue';
 * 
 * const timer = createAutoCleanupTimer(() => {
 *   // 组件卸载时自动清理
 * });
 * 
 * onScopeDispose(() => {
 *   timer.clear();
 * });
 * ```
 */
export const createAutoCleanupTimer = (onCleanup?: () => void): TimerManager => {
  const timer = createTimerManager();
  
  // 如果提供了清理回调，则包装 clear 方法
  if (onCleanup) {
    const originalClear = timer.clear.bind(timer);
    timer.clear = () => {
      originalClear();
      onCleanup();
    };
  }
  
  return timer;
};

/**
 * 延迟执行工具函数
 * 简化的 Promise 版本延迟执行
 * 
 * @param delay 延迟时间（毫秒）
 * @returns Promise
 * 
 * @example
 * ```typescript
 * await delay(1000); // 延迟 1 秒
 * console.log('1 second later');
 * ```
 */
export const delay = (delay: number): Promise<void> => {
  return new Promise(resolve => {
    setTimeout(resolve, delay);
  });
};

/**
 * 创建可取消的延迟 Promise
 * 
 * @param delay 延迟时间（毫秒）
 * @returns 包含 promise 和 cancel 方法的对象
 * 
 * @example
 * ```typescript
 * const { promise, cancel } = createCancelableDelay(1000);
 * 
 * promise
 *   .then(() => console.log('Executed'))
 *   .catch(() => console.log('Cancelled'));
 * 
 * // 取消延迟
 * cancel();
 * ```
 */
export const createCancelableDelay = (delay: number) => {
  let timeoutId: number;
  let cancelled = false;
  
  const promise = new Promise<void>((resolve, reject) => {
    timeoutId = window.setTimeout(() => {
      if (!cancelled) {
        resolve();
      }
    }, delay);
  });
  
  const cancel = () => {
    cancelled = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };
  
  return { promise, cancel };
};