type PendingWrite<Result> = {
  observedAt: number;
  waiters: Array<{
    reject: (reason?: unknown) => void;
    resolve: (value: Result) => void;
  }>;
  write: () => Promise<Result>;
};

type ActiveWrite<Result> = {
  observedAt: number;
  pending: PendingWrite<Result> | null;
  promise: Promise<Result>;
};

export interface LatestWriteCoalescer<Result> {
  run(key: string, observedAt: Date, write: () => Promise<Result>): Promise<Result>;
}

export function createLatestWriteCoalescer<Result>(
  maximumKeys: number = 10_000,
): LatestWriteCoalescer<Result> {
  const activeWrites = new Map<string, ActiveWrite<Result>>();

  function start(
    key: string,
    state: ActiveWrite<Result>,
    observedAt: number,
    write: () => Promise<Result>,
  ): Promise<Result> {
    state.observedAt = observedAt;
    const promise = Promise.resolve().then(write);
    state.promise = promise;
    const continueWithPending = () => {
      const pending = state.pending;
      if (pending === null) {
        if (activeWrites.get(key) === state) {
          activeWrites.delete(key);
        }
        return;
      }

      state.pending = null;
      const next = start(key, state, pending.observedAt, pending.write);
      void next.then(
        (result) => {
          for (const waiter of pending.waiters) {
            waiter.resolve(result);
          }
        },
        (error: unknown) => {
          for (const waiter of pending.waiters) {
            waiter.reject(error);
          }
        },
      );
    };
    void promise.then(continueWithPending, continueWithPending);
    return promise;
  }

  return {
    run(key, observedAt, write) {
      const timestamp = observedAt.getTime();
      const current = activeWrites.get(key);
      if (current === undefined) {
        if (activeWrites.size >= maximumKeys) {
          return write();
        }
        const state: ActiveWrite<Result> = {
          observedAt: timestamp,
          pending: null,
          promise: Promise.resolve(null as never),
        };
        activeWrites.set(key, state);
        return start(key, state, timestamp, write);
      }
      if (timestamp <= current.observedAt) {
        return current.promise;
      }

      return new Promise<Result>((resolve, reject) => {
        const waiter = { reject, resolve };
        if (current.pending === null) {
          current.pending = { observedAt: timestamp, waiters: [waiter], write };
          return;
        }
        current.pending.waiters.push(waiter);
        if (timestamp >= current.pending.observedAt) {
          current.pending.observedAt = timestamp;
          current.pending.write = write;
        }
      });
    },
  };
}
