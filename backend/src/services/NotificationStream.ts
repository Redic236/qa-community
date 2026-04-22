import type { Response } from 'express';
import type { Notification } from '../models';

interface Subscriber {
  res: Response;
  heartbeat: NodeJS.Timeout;
}

/**
 * Minimal pub/sub contract so the SSE layer doesn't depend on ioredis directly.
 * Real implementations are wired at app boot via `initPubSub()`.
 */
export interface PubSubAdapter {
  publish(channel: string, message: string): Promise<void> | void;
  /** Called once at startup. The handler receives raw message strings. */
  subscribe(channel: string, handler: (message: string) => void): Promise<void> | void;
}

const CHANNEL = 'qa:notifications';
const HEARTBEAT_MS = 25_000;
/**
 * Cap concurrent SSE streams per user. Each connection holds a 25s-interval
 * timer + an Express res reference, so an unbounded stream of EventSource
 * instances from a malicious page could exhaust memory quickly. 5 is more
 * than any legitimate browser tab pattern needs (one tab per device).
 */
const MAX_STREAMS_PER_USER = 5;

const subscribers = new Map<number, Set<Subscriber>>();
let pubsub: PubSubAdapter | null = null;
let pubsubReady: Promise<void> | null = null;

interface ChannelMessage {
  userId: number;
  notification: Record<string, unknown>;
}

function writeEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function fanoutLocal(userId: number, payload: Record<string, unknown>): void {
  const set = subscribers.get(userId);
  if (!set || set.size === 0) return;
  for (const sub of set) {
    try {
      writeEvent(sub.res, 'notification', payload);
    } catch (err) {
      console.warn('[NotificationStream] write failed:', (err as Error).message);
    }
  }
}

export class NotificationStream {
  /**
   * Attach a pub/sub adapter (Redis in production, in-memory in tests). Without
   * one, `publish()` falls back to local-only fanout — fine for single-instance
   * deployments. Call exactly once at app start, BEFORE the first publish.
   */
  static initPubSub(adapter: PubSubAdapter | null): void {
    if (pubsub) {
      console.warn('[NotificationStream] pubsub adapter already initialized; ignoring');
      return;
    }
    pubsub = adapter;
    if (!adapter) return;
    pubsubReady = Promise.resolve(
      adapter.subscribe(CHANNEL, (msg) => {
        try {
          const parsed = JSON.parse(msg) as ChannelMessage;
          fanoutLocal(parsed.userId, parsed.notification);
        } catch (err) {
          console.warn('[NotificationStream] bad pubsub message:', (err as Error).message);
        }
      })
    ).then(() => undefined);
  }

  /** Test helper — drop the adapter and reset to single-instance mode. */
  static resetPubSub(): void {
    pubsub = null;
    pubsubReady = null;
  }

  static subscribe(userId: number, res: Response): () => void {
    // Enforce per-user connection cap BEFORE flushing headers — rejected
    // clients get a plain 429 they can handle, not a half-open SSE stream.
    const existing = subscribers.get(userId);
    if (existing && existing.size >= MAX_STREAMS_PER_USER) {
      res.status(429).end();
      return () => undefined;
    }

    res.status(200);
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();

    writeEvent(res, 'ready', { now: Date.now() });

    const heartbeat = setInterval(() => {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    }, HEARTBEAT_MS);
    // Don't keep the event loop alive on this timer alone — tests may register
    // subscribers without an HTTP socket holding the process open.
    heartbeat.unref?.();

    const sub: Subscriber = { res, heartbeat };
    let bucket = subscribers.get(userId);
    if (!bucket) {
      bucket = new Set();
      subscribers.set(userId, bucket);
    }
    bucket.add(sub);

    return () => {
      clearInterval(heartbeat);
      const set = subscribers.get(userId);
      if (set) {
        set.delete(sub);
        if (set.size === 0) subscribers.delete(userId);
      }
      try {
        res.end();
      } catch {
        /* connection already torn down */
      }
    };
  }

  /**
   * Fan out a notification to every active stream for the recipient.
   *
   * - With a pub/sub adapter wired, we ONLY publish to the channel. The local
   *   subscriber callback receives the same message back and runs `fanoutLocal`
   *   — keeping a single code path for cross-instance and same-instance delivery
   *   and avoiding double-sends.
   * - Without an adapter, fanout runs synchronously on this process.
   */
  static publish(userId: number, notification: Notification): void {
    const payload = notification.toJSON() as Record<string, unknown>;
    if (pubsub) {
      const send = pubsub.publish(
        CHANNEL,
        JSON.stringify({ userId, notification: payload } satisfies ChannelMessage)
      );
      if (send && typeof (send as Promise<unknown>).catch === 'function') {
        (send as Promise<unknown>).catch((err: Error) => {
          // Do NOT fan out locally as a fallback here: a "publish failed"
          // response from Redis often means the ACK was dropped while the
          // message was already delivered, so falling back would produce a
          // duplicate event for every connected client on this instance.
          // Logging is enough; the next publish will either succeed or the
          // operator can restart the stream.
          console.warn('[NotificationStream] publish failed:', err.message);
        });
      }
      return;
    }
    fanoutLocal(userId, payload);
  }

  /** Test-only: count active local subscribers for a user. */
  static subscriberCount(userId: number): number {
    return subscribers.get(userId)?.size ?? 0;
  }

  /** Test helper to await initial subscription handshake. */
  static async waitForPubSubReady(): Promise<void> {
    if (pubsubReady) await pubsubReady;
  }
}
