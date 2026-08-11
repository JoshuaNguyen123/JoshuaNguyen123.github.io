interface CacheEntry<T> {
  expiresAt: number;
  value: Promise<T>;
}

const requestCache = new Map<string, CacheEntry<unknown>>();

export async function withActivityCache<T>(
  key: string,
  load: () => Promise<T>,
  ttlMs = 15 * 60 * 1000,
): Promise<T> {
  const cached = requestCache.get(key) as CacheEntry<T> | undefined;
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const value = load();
  requestCache.set(key, { expiresAt: Date.now() + ttlMs, value });
  try {
    return await value;
  } catch (error) {
    requestCache.delete(key);
    throw error;
  }
}
