export type RequestCacheEvent =
  | "hit"
  | "miss"
  | "deduplicated"
  | "stale-hit";

export type RequestCacheOptions<T> = {
  ttlMs: number;
  negativeTtlMs?: number;
  staleWhileRevalidateMs?: number;
  isNegative?: (value: T) => boolean;
};

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  staleUntil: number;
  touchedAt: number;
};

export class SingleFlightTtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();

  constructor(private readonly maximumEntries = 200) {}

  clear() {
    this.entries.clear();
    this.inFlight.clear();
  }

  size() {
    return this.entries.size;
  }

  async getOrLoad(
    key: string,
    loader: () => Promise<T>,
    options: RequestCacheOptions<T>,
    onEvent?: (event: RequestCacheEvent) => void
  ): Promise<T> {
    const now = Date.now();
    const cached = this.entries.get(key);

    if (cached && now < cached.expiresAt) {
      cached.touchedAt = now;
      onEvent?.("hit");
      return cached.value;
    }

    if (cached && now < cached.staleUntil) {
      cached.touchedAt = now;
      onEvent?.("stale-hit");
      if (!this.inFlight.has(key)) {
        void this.load(key, loader, options).catch(() => undefined);
      } else {
        onEvent?.("deduplicated");
      }
      return cached.value;
    }

    const running = this.inFlight.get(key);
    if (running) {
      onEvent?.("deduplicated");
      return running;
    }

    onEvent?.("miss");
    return this.load(key, loader, options);
  }

  private load(
    key: string,
    loader: () => Promise<T>,
    options: RequestCacheOptions<T>
  ) {
    const request = loader()
      .then((value) => {
        const now = Date.now();
        const negative = options.isNegative?.(value) === true;
        const ttl = Math.max(
          1_000,
          negative
            ? options.negativeTtlMs ?? options.ttlMs
            : options.ttlMs
        );
        this.entries.set(key, {
          value,
          expiresAt: now + ttl,
          staleUntil:
            now + ttl + Math.max(0, options.staleWhileRevalidateMs || 0),
          touchedAt: now,
        });
        this.trim();
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, request);
    return request;
  }

  private trim() {
    if (this.entries.size <= this.maximumEntries) return;
    const removeCount = this.entries.size - this.maximumEntries;
    Array.from(this.entries.entries())
      .sort((left, right) => left[1].touchedAt - right[1].touchedAt)
      .slice(0, removeCount)
      .forEach(([key]) => this.entries.delete(key));
  }
}
