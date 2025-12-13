import { ref, readonly, onUnmounted, type Ref, type DeepReadonly } from 'vue';

export interface UseConfirmOptions<T extends string | number = string | number> {
  /** Auto cancel timeout in ms (default: 3000, set 0 to disable) */
  timeout?: number;
  /** Callback when confirmed */
  onConfirm?: (id: T) => void | Promise<void>;
  /** Callback when cancelled (timeout or manual) */
  onCancel?: (id: T) => void;
}

export interface UseConfirmReturn<T extends string | number = string | number> {
  /** Current confirming id (readonly) */
  confirmId: DeepReadonly<Ref<T | null>>;
  /** Whether confirm action is executing */
  isPending: DeepReadonly<Ref<boolean>>;
  /** Check if a specific id is in confirming state */
  isConfirming: (id: T) => boolean;
  /** Start confirming state (with auto timeout) */
  startConfirm: (id: T) => void;
  /** Request confirmation (toggle between request and execute) */
  requestConfirm: (id: T) => Promise<boolean>;
  /** Manually confirm current id */
  confirm: () => Promise<void>;
  /** Cancel confirmation */
  cancel: () => void;
  /** Reset without triggering callbacks */
  reset: () => void;
}

/**
 * Composable for handling confirm actions (e.g., delete confirmation)
 * 
 * @example
 * ```ts
 * // Basic usage
 * const { isConfirming, requestConfirm } = useConfirm({
 *   timeout: 3000,
 *   onConfirm: async (id) => { await deleteItem(id) }
 * })
 * 
 * // In template
 * <button @click="requestConfirm('delete')">
 *   {{ isConfirming('delete') ? 'Confirm?' : 'Delete' }}
 * </button>
 * 
 * // With loading state
 * const { isPending, requestConfirm } = useConfirm({ ... })
 * <button :disabled="isPending" @click="requestConfirm('id')">
 *   {{ isPending ? 'Processing...' : 'Delete' }}
 * </button>
 * ```
 */
export function useConfirm<T extends string | number = string | number>(
  options: UseConfirmOptions<T> = {}
): UseConfirmReturn<T> {
  const { timeout = 3000, onConfirm, onCancel } = options;

  const confirmId = ref<T | null>(null) as Ref<T | null>;
  const isPending = ref(false);
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = (): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  /**
   * Check if a specific id is in confirming state
   */
  const isConfirming = (id: T): boolean => {
    return confirmId.value === id;
  };

  /**
   * Start confirming state for an id (with auto timeout)
   */
  const startConfirm = (id: T): void => {
    clearTimer();
    confirmId.value = id;

    // Auto cancel after timeout (0 = disabled)
    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        if (confirmId.value === id) {
          confirmId.value = null;
          onCancel?.(id);
        }
      }, timeout);
    }
  };

  /**
   * Request confirmation for an id
   * - First click: enter confirming state
   * - Second click: execute confirm action
   * @returns true if confirmed, false if entered confirming state
   */
  const requestConfirm = async (id: T): Promise<boolean> => {
    // Prevent action while pending
    if (isPending.value) return false;

    if (confirmId.value === id) {
      // Already confirming, execute action
      clearTimer();
      isPending.value = true;
      try {
        await onConfirm?.(id);
        return true;
      } finally {
        confirmId.value = null;
        isPending.value = false;
      }
    } else {
      // Enter confirming state
      startConfirm(id);
      return false;
    }
  };

  /**
   * Manually confirm the current id
   */
  const confirm = async (): Promise<void> => {
    if (confirmId.value === null || isPending.value) return;
    
    clearTimer();
    const id = confirmId.value;
    isPending.value = true;
    try {
      await onConfirm?.(id);
    } finally {
      confirmId.value = null;
      isPending.value = false;
    }
  };

  /**
   * Cancel the confirming state
   */
  const cancel = (): void => {
    if (confirmId.value === null) return;
    
    const id = confirmId.value;
    clearTimer();
    confirmId.value = null;
    onCancel?.(id);
  };

  /**
   * Reset state without triggering callbacks
   */
  const reset = (): void => {
    clearTimer();
    confirmId.value = null;
    isPending.value = false;
  };

  // Cleanup on unmount
  onUnmounted(clearTimer);

  return {
    confirmId: readonly(confirmId),
    isPending: readonly(isPending),
    isConfirming,
    startConfirm,
    requestConfirm,
    confirm,
    cancel,
    reset
  };
}
