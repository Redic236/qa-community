import Redis from 'ioredis';

/**
 * Optional Redis client. Activated only when:
 *   - REDIS_URL env var is set, AND
 *   - NODE_ENV is not 'test' (tests stay deterministic on in-memory fallbacks)
 *
 * Callers (rate limiter, CacheService) MUST handle the `null` case gracefully
 * — that's the dev-without-Redis path.
 */
function createClient(): Redis | null {
  if (process.env.NODE_ENV === 'test') return null;
  const url = process.env.REDIS_URL;
  if (!url) return null;

  const client = new Redis(url, {
    // Don't queue commands forever if Redis is down — fail fast so callers
    // can fall back to in-memory behavior (cache miss / rate limit pass-through).
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    retryStrategy(times) {
      return Math.min(times * 100, 2000);
    },
    lazyConnect: false,
  });

  client.on('error', (err) => {
    // Single-shot warning to avoid log floods if Redis stays down.
    if (!loggedError) {
      console.warn('[redis] connection error:', err.message);
      loggedError = true;
    }
  });
  client.on('ready', () => {
    if (loggedError) {
      console.info('[redis] reconnected');
      loggedError = false;
    }
  });

  return client;
}

let loggedError = false;
export const redis: Redis | null = createClient();
export const isRedisEnabled: boolean = redis !== null;
