export type TtlLruCache<T> = {
  get(key: string, now?: number): T | undefined;
  set(key: string, value: T, now?: number): void;
  size(): number;
  clear(): void;
};

export function createTtlLruCache<T>(
  maxEntries: number,
  ttlMs: number,
): TtlLruCache<T> {
  const store = new Map<string, { value: T; expiresAt: number }>();

  function evictExpired(now: number) {
    for (const [key, entry] of store) {
      if (entry.expiresAt <= now) store.delete(key);
    }
  }

  return {
    get(key, now = Date.now()) {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= now) {
        store.delete(key);
        return undefined;
      }
      store.delete(key);
      store.set(key, entry);
      return entry.value;
    },
    set(key, value, now = Date.now()) {
      evictExpired(now);
      if (store.has(key)) store.delete(key);
      store.set(key, { value, expiresAt: now + ttlMs });
      while (store.size > maxEntries) {
        const oldest = store.keys().next().value;
        if (oldest === undefined) break;
        store.delete(oldest);
      }
    },
    size() {
      return store.size;
    },
    clear() {
      store.clear();
    },
  };
}

export type SingleFlight<T> = {
  run(key: string, factory: () => Promise<T>): Promise<T>;
  pendingCount(): number;
};

export function createSingleFlight<T>(): SingleFlight<T> {
  const inflight = new Map<string, Promise<T>>();

  return {
    run(key, factory) {
      const existing = inflight.get(key);
      if (existing) return existing;
      const created = factory().finally(() => {
        inflight.delete(key);
      });
      inflight.set(key, created);
      return created;
    },
    pendingCount() {
      return inflight.size;
    },
  };
}

export type ConcurrencyGate = {
  run<T>(task: () => Promise<T>): Promise<T>;
  activeCount(): number;
};

export function createConcurrencyGate(limit: number): ConcurrencyGate {
  let active = 0;
  const waiters: Array<() => void> = [];

  async function acquire() {
    if (active < limit) {
      active += 1;
      return;
    }
    await new Promise<void>((resolve) => waiters.push(resolve));
    active += 1;
  }

  function release() {
    active = Math.max(0, active - 1);
    const next = waiters.shift();
    if (next) next();
  }

  return {
    async run(task) {
      await acquire();
      try {
        return await task();
      } finally {
        release();
      }
    },
    activeCount() {
      return active;
    },
  };
}
