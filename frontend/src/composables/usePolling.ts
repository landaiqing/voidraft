import { ref, readonly, onUnmounted, type Ref, type DeepReadonly } from 'vue';

export interface UsePollingOptions<T> {
  /** Polling interval in ms (default: 500) */
  interval?: number;
  /** Execute immediately when started (default: true) */
  immediate?: boolean;
  /** Auto-stop condition, return true to stop polling */
  shouldStop?: (data: T) => boolean;
  /** Callback on each successful poll */
  onSuccess?: (data: T) => void;
  /** Callback when error occurs */
  onError?: (error: unknown) => void;
  /** Callback when polling stops (either manual or auto) */
  onStop?: () => void;
}

export interface UsePollingReturn<T> {
  /** Latest fetched data (readonly) */
  data: DeepReadonly<Ref<T | null>>;
  /** Error message if any (readonly) */
  error: DeepReadonly<Ref<string>>;
  /** Whether polling is active (readonly) */
  isActive: DeepReadonly<Ref<boolean>>;
  /** Start polling */
  start: () => void;
  /** Stop polling */
  stop: () => void;
  /** Reset all state (also stops polling) */
  reset: () => void;
}

/**
 * Composable for polling async operations with auto-stop support
 * 
 * @example
 * ```ts
 * // Basic usage
 * const { data, isActive, start, stop } = usePolling(
 *   () => api.getProgress(),
 *   {
 *     interval: 200,
 *     shouldStop: (d) => d.progress >= 100 || !!d.error,
 *     onSuccess: (d) => console.log('Progress:', d.progress)
 *   }
 * )
 * 
 * // Start polling
 * start()
 * 
 * // With reactive data binding
 * <div>{{ isActive ? `${data?.progress}%` : 'Idle' }}</div>
 * ```
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  options: UsePollingOptions<T> = {}
): UsePollingReturn<T> {
  const {
    interval = 500,
    immediate = true,
    shouldStop,
    onSuccess,
    onError,
    onStop
  } = options;

  const data = ref<T | null>(null) as Ref<T | null>;
  const error = ref('');
  const isActive = ref(false);
  let timerId = 0;

  const clearTimer = (): void => {
    if (timerId) {
      clearInterval(timerId);
      timerId = 0;
    }
  };

  const poll = async (): Promise<void> => {
    try {
      const result = await fetcher();
      data.value = result;
      error.value = '';
      onSuccess?.(result);

      // Check auto-stop condition
      if (shouldStop?.(result)) {
        stop();
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      onError?.(e);
      stop();
    }
  };

  /**
   * Start polling
   */
  const start = (): void => {
    if (isActive.value) return;

    isActive.value = true;
    error.value = '';

    // Execute immediately if configured
    if (immediate) {
      poll();
    }

    timerId = window.setInterval(poll, interval);
  };

  /**
   * Stop polling
   */
  const stop = (): void => {
    if (!isActive.value) return;

    clearTimer();
    isActive.value = false;
    onStop?.();
  };

  /**
   * Reset all state to initial values
   */
  const reset = (): void => {
    clearTimer();
    data.value = null;
    error.value = '';
    isActive.value = false;
  };

  // Cleanup on unmount
  onUnmounted(clearTimer);

  return {
    data: readonly(data),
    error: readonly(error),
    isActive: readonly(isActive),
    start,
    stop,
    reset
  };
}
