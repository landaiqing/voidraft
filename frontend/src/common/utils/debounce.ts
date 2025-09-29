/**
 * 防抖函数工具类
 * 用于限制函数的执行频率，在指定时间内只执行最后一次调用
 */

export interface DebounceOptions {
  /** 延迟时间（毫秒），默认 300ms */
  delay?: number;
  /** 是否立即执行第一次调用，默认 false */
  immediate?: boolean;
}

/**
 * 创建防抖函数
 * @param fn 要防抖的函数
 * @param options 防抖选项
 * @returns 返回防抖后的函数和清理函数
 */
export function createDebounce<T extends (...args: any[]) => any>(
  fn: T,
  options: DebounceOptions = {}
): {
  debouncedFn: T;
  cancel: () => void;
  flush: () => void;
} {
  const { delay = 300, immediate = false } = options;
  let timeoutId: number | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastThis: any = null;

  const debouncedFn = function (this: any, ...args: Parameters<T>) {
    lastArgs = args;
    lastThis = this;

    const callNow = immediate && !timeoutId;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = window.setTimeout(() => {
      timeoutId = null;
      if (!immediate && lastArgs) {
        fn.apply(lastThis, lastArgs);
      }
    }, delay);

    if (callNow) {
      return fn.apply(this, args);
    }
  } as T;

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastArgs = null;
    lastThis = null;
  };

  const flush = () => {
    if (timeoutId && lastArgs) {
      clearTimeout(timeoutId);
      fn.apply(lastThis, lastArgs);
      timeoutId = null;
      lastArgs = null;
      lastThis = null;
    }
  };

  return {
    debouncedFn,
    cancel,
    flush
  };
}


/**
 * 节流函数
 * 在指定时间内最多执行一次函数
 * @param fn 要节流的函数
 * @param delay 节流时间间隔（毫秒）
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 300
): T {
  let lastExecTime = 0;
  let timeoutId: number | null = null;

  return ((...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastExecTime >= delay) {
      lastExecTime = now;
      fn(...args);
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => {
        lastExecTime = Date.now();
        fn(...args);
      }, delay - (now - lastExecTime));
    }
  }) as T;
}