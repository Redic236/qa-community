import { redis } from '../config/redis';

/**
 * Tiny JSON cache wrapper over Redis. All operations fail-open: if Redis is
 * unavailable (or never configured), cache becomes a no-op rather than
 * propagating errors to the API layer.
 *
 * Conventions:
 *   - Keys are namespaced with a colon-separated prefix, e.g. `q:detail:42`.
 *   - Values are JSON-serialized; only data Sequelize would surface (POJOs,
 *     dates as ISO strings via .toJSON()) is supported.
 */
export class CacheService {
  static async get<T>(key: string): Promise<T | null> {
    if (!redis) return null;
    try {
      const raw = await redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (err) {
      console.warn('[cache] get failed for', key, (err as Error).message);
      return null;
    }
  }

  static async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (!redis) return;
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      console.warn('[cache] set failed for', key, (err as Error).message);
    }
  }

  static async del(key: string): Promise<void> {
    if (!redis) return;
    try {
      await redis.del(key);
    } catch (err) {
      console.warn('[cache] del failed for', key, (err as Error).message);
    }
  }
}

/** Conventional key builders so callers don't sprinkle ad-hoc strings. */
export const cacheKeys = {
  questionDetail: (id: number): string => `q:detail:${id}`,
};
