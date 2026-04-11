/**
 * 按 key 串行执行任务，并只保留最后一个待执行任务。
 */

interface Waiter<Result> {
  resolve: (result: Result) => void;
  reject: (error: unknown) => void;
}

interface Task<Input, Result> {
  payload: Input;
  waiters: Waiter<Result>[];
}

interface State<Input, Result, Meta> {
  inFlight: Task<Input, Result> | null;
  pending: Task<Input, Result> | null;
  meta: Meta;
}

export interface LatestTaskQueue<Key, Input, Result, Meta> {
  enqueue(key: Key, payload: Input): Promise<Result>;
  isIdle(key: Key): boolean;
  getMeta(key: Key): Meta | undefined;
  updateMeta(key: Key, updater: (meta: Meta) => void): void;
  remove(key: Key): void;
}

export interface LatestTaskQueueOptions<Key, Input, Result, Meta> {
  createMeta(): Meta;
  run(key: Key, payload: Input, meta: Meta): Promise<Result>;
  same?(current: Input, incoming: Input, meta: Meta): boolean;
  merge?(current: Input, incoming: Input, meta: Meta): Input;
  next?(pending: Input, result: Result, meta: Meta): Input;
  onSuccess?(key: Key, payload: Input, result: Result, meta: Meta): void;
  onError?(key: Key, payload: Input, error: unknown, meta: Meta): void;
  clearPendingOnError?: boolean;
}

export const createLatestTaskQueue = <Key, Input, Result, Meta>(
  options: LatestTaskQueueOptions<Key, Input, Result, Meta>
): LatestTaskQueue<Key, Input, Result, Meta> => {
  const states = new Map<Key, State<Input, Result, Meta>>();
  const same = options.same || (() => false);
  const merge = options.merge || ((_current: Input, incoming: Input) => incoming);
  const clearPendingOnError = options.clearPendingOnError ?? true;

  const ensureState = (key: Key): State<Input, Result, Meta> => {
    let state = states.get(key);
    if (!state) {
      state = {
        inFlight: null,
        pending: null,
        meta: options.createMeta()
      };
      states.set(key, state);
    }
    return state;
  };

  const enqueue = (key: Key, payload: Input): Promise<Result> => {
    const state = ensureState(key);

    return new Promise<Result>((resolve, reject) => {
      const incoming: Task<Input, Result> = {
        payload,
        waiters: [{resolve, reject}]
      };

      if (state.inFlight && same(state.inFlight.payload, payload, state.meta)) {
        state.inFlight.waiters.push(incoming.waiters[0]);
        return;
      }

      if (state.pending && same(state.pending.payload, payload, state.meta)) {
        state.pending.waiters.push(incoming.waiters[0]);
        return;
      }

      if (!state.inFlight) {
        state.inFlight = incoming;
        void run(key, state, incoming).catch(() => undefined);
        return;
      }

      if (!state.pending) {
        state.pending = incoming;
        return;
      }

      state.pending.payload = merge(state.pending.payload, payload, state.meta);
      state.pending.waiters.push(incoming.waiters[0]);
    });
  };

  const isIdle = (key: Key): boolean => {
    const state = states.get(key);
    return !state || (!state.inFlight && !state.pending);
  };

  const getMeta = (key: Key): Meta | undefined => {
    return states.get(key)?.meta;
  };

  const updateMeta = (key: Key, updater: (meta: Meta) => void) => {
    updater(ensureState(key).meta);
  };

  const remove = (key: Key) => {
    states.delete(key);
  };

  async function run(
    key: Key,
    state: State<Input, Result, Meta>,
    task: Task<Input, Result>
  ): Promise<void> {
    let resultBox: { value: Result } | undefined;

    try {
      const result = await options.run(key, task.payload, state.meta);
      resultBox = {value: result};
      options.onSuccess?.(key, task.payload, result, state.meta);
      resolve(task, result);
    } catch (error) {
      options.onError?.(key, task.payload, error, state.meta);
      reject(task, error);

      if (clearPendingOnError && state.pending) {
        reject(state.pending, error);
        state.pending = null;
      }

      throw error;
    } finally {
      if (state.inFlight === task) {
        state.inFlight = null;
      }
    }

    if (!state.pending) {
      return;
    }

    const nextTask = state.pending;
    state.pending = null;

    if (resultBox && options.next) {
      nextTask.payload = options.next(nextTask.payload, resultBox.value, state.meta);
    }

    state.inFlight = nextTask;
    await run(key, state, nextTask);
  }

  function resolve(task: Task<Input, Result>, result: Result) {
    task.waiters.forEach(({resolve}) => resolve(result));
  }

  function reject(task: Task<Input, Result>, error: unknown) {
    task.waiters.forEach(({reject}) => reject(error));
  }

  return {
    enqueue,
    isIdle,
    getMeta,
    updateMeta,
    remove
  };
};
