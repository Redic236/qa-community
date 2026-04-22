import crypto from 'crypto';

/**
 * One-shot SSE ticket store.
 *
 * The SSE endpoint accepts a ?ticket= query param instead of the raw JWT,
 * because query strings end up in nginx access logs, upstream proxies, and
 * browser Referer headers. A ticket is single-use, user-bound, 30s TTL —
 * even if logged, its attack value is near-zero (already consumed or
 * already expired).
 *
 * In-memory store: fine for single-instance; multi-instance deployments
 * should port this to Redis (SETEX + DEL).
 */

const TTL_MS = 30_000;

interface TicketEntry {
  userId: number;
  /** ms-epoch after which the ticket is dead regardless of consumption state. */
  expiresAt: number;
}

const store = new Map<string, TicketEntry>();

function sweepExpired(now: number): void {
  // Cheap occasional cleanup — no background timer needed. Called on each
  // issue/consume so the store never grows unbounded with unused tickets.
  for (const [ticket, entry] of store) {
    if (entry.expiresAt <= now) store.delete(ticket);
  }
}

export class SseTicketService {
  /** Issue a fresh ticket. Returns the opaque string and its TTL in seconds. */
  static issue(userId: number): { ticket: string; ttlSeconds: number } {
    const now = Date.now();
    sweepExpired(now);
    const ticket = crypto.randomBytes(24).toString('base64url');
    store.set(ticket, { userId, expiresAt: now + TTL_MS });
    return { ticket, ttlSeconds: Math.floor(TTL_MS / 1000) };
  }

  /**
   * Consume a ticket: atomically check-and-delete. Returns the owning userId
   * on success, null if the ticket is unknown, expired, or already used.
   */
  static consume(ticket: string): number | null {
    const now = Date.now();
    sweepExpired(now);
    const entry = store.get(ticket);
    if (!entry) return null;
    store.delete(ticket);
    if (entry.expiresAt <= now) return null;
    return entry.userId;
  }

  /** Test-only peek without consuming. */
  static _peekForTest(ticket: string): TicketEntry | undefined {
    return store.get(ticket);
  }

  /** Test-only drain. */
  static _resetForTest(): void {
    store.clear();
  }
}
