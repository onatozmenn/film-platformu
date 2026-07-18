export interface RateLimiterPort {
  consume(key: string): boolean;
}

type RateLimitEntry = Readonly<{ count: number; resetsAt: number }>;

export function createFixedWindowRateLimiter(
  limit: number,
  windowMilliseconds: number,
  clock: () => number = Date.now,
  maximumKeys: number = 10_000,
): RateLimiterPort {
  const entries = new Map<string, RateLimitEntry>();

  return {
    consume(key) {
      const now = clock();
      const current = entries.get(key);
      if (current === undefined || current.resetsAt <= now) {
        for (const [storedKey, entry] of entries) {
          if (entry.resetsAt <= now) {
            entries.delete(storedKey);
          }
        }
        if (!entries.has(key) && entries.size >= maximumKeys) {
          const oldest = entries.keys().next();
          if (!oldest.done) {
            entries.delete(oldest.value);
          }
        }
        entries.set(key, { count: 1, resetsAt: now + windowMilliseconds });
        return true;
      }
      if (current.count >= limit) {
        return false;
      }
      entries.set(key, { ...current, count: current.count + 1 });
      return true;
    },
  };
}
