import rateLimit, { type Options, type Store } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import type { Request } from 'express';
import { redis } from '../config/redis';

/**
 * Only enforce rate limits in production. Dev iteration would hit limits
 * during normal manual testing; E2E (which runs against the dev MySQL backend)
 * would burst through any reasonable threshold for legit reasons. Set
 * NODE_ENV=production to turn enforcement on.
 *
 * If you need to validate the limiter behavior locally, set
 * RATE_LIMIT_FORCE=1 to override the skip.
 */
const skipRateLimit = (): boolean => {
  if (process.env.RATE_LIMIT_FORCE === '1') return false;
  return process.env.NODE_ENV !== 'production';
};

const standardErrorBody = {
  success: false,
  error: '请求过于频繁，请稍后再试',
};

/**
 * Use a shared RedisStore when REDIS_URL is configured so multiple API
 * instances see the same counter. Without Redis, fall back to the in-memory
 * MemoryStore (per-process) — fine for single-instance dev.
 */
// Match rate-limit-redis v4's SingleOptions.sendCommand shape exactly so the
// SingleOptions/ClusterOptions union resolves to the single-server branch.
type RedisReply = boolean | number | string | Array<boolean | number | string>;
type SendCommandFn = (...args: string[]) => Promise<RedisReply>;

function makeStore(prefix: string): Store | undefined {
  const client = redis;
  if (!client) return undefined;
  const sendCommand: SendCommandFn = async (...args) => {
    const [command, ...rest] = args;
    return (await client.call(command, ...rest)) as RedisReply;
  };
  return new RedisStore({ sendCommand, prefix: `rl:${prefix}:` });
}

function build(opts: {
  name: string;
  windowMs: number;
  max: number;
  byUserId?: boolean;
  message?: string;
}): ReturnType<typeof rateLimit> {
  const partial: Partial<Options> = {
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipRateLimit,
    store: makeStore(opts.name),
    message: opts.message
      ? { success: false, error: opts.message }
      : standardErrorBody,
  };
  if (opts.byUserId) {
    // Authenticated routes: key by req.userId so one chatty IP can't share-lock
    // a whole NAT block. Falls back to IP if requireAuth somehow didn't run.
    partial.keyGenerator = (req: Request) => {
      const id = req.userId;
      return id ? `u:${id}` : `ip:${req.ip ?? 'unknown'}`;
    };
  }
  return rateLimit(partial as Options);
}

/** Anti-brute-force on auth endpoints (per IP). */
export const authLimiter = build({
  name: 'auth',
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: '尝试次数过多，请 15 分钟后再试',
});

/** Anti-spam for question/answer creation (per user). */
export const writeLimiter = build({
  name: 'write',
  windowMs: 60 * 60 * 1000,
  max: 30,
  byUserId: true,
});

/** Voting is a frequent action; cap per-minute to thwart bots. */
export const voteLimiter = build({
  name: 'vote',
  windowMs: 60 * 1000,
  max: 60,
  byUserId: true,
});
