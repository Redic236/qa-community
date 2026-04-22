import { useEffect } from 'react';
import { useAppDispatch } from '@/store';
import { apiSlice } from '@/store/apiSlice';

/**
 * Open an SSE connection to /api/notifications/stream and invalidate the
 * Notifications cache whenever the server pushes a new event.
 *
 * Auth handshake (two steps, so raw JWTs never hit a URL):
 *   1. POST /api/notifications/stream/ticket with the usual Bearer header
 *      → server returns a one-shot base64 ticket, 30s TTL.
 *   2. new EventSource('/api/notifications/stream?ticket=<...>') — the
 *      ticket is consumed server-side on the first consume; even if a proxy
 *      logs the URL, replaying it fails.
 *
 * Fail-open: if ticket exchange or EventSource fails, the existing list
 * query keeps working; the bell just stops auto-updating.
 */

interface TicketResponse {
  success: true;
  data: { ticket: string; ttlSeconds: number };
}

async function fetchTicket(token: string): Promise<string | null> {
  try {
    const res = await fetch('/api/notifications/stream/ticket', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as TicketResponse;
    return body.data.ticket;
  } catch {
    return null;
  }
}

export function useNotificationStream(token: string | null): void {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!token) return;
    if (typeof EventSource === 'undefined') return;

    let cancelled = false;
    let es: EventSource | null = null;

    const onNotification = (): void => {
      // Achievement unlocks come in as notifications too — refresh both caches
      // so the badge wall lights up immediately without a manual reload.
      dispatch(apiSlice.util.invalidateTags(['Notifications', 'Achievements']));
    };

    void (async () => {
      const ticket = await fetchTicket(token);
      if (cancelled || !ticket) return;
      es = new EventSource(`/api/notifications/stream?ticket=${encodeURIComponent(ticket)}`);
      es.addEventListener('notification', onNotification);
      es.addEventListener('error', () => {
        // readyState === 0 (CONNECTING) means it's already retrying; readyState
        // === 2 (CLOSED) is terminal — the ticket already consumed or expired.
        // Don't spin-retry; the next useEffect run (e.g. auth change) will
        // fetch a new ticket cleanly.
        if (es?.readyState === EventSource.CLOSED) {
          // eslint-disable-next-line no-console
          console.warn('[notifications] SSE closed by server');
        }
      });
    })();

    return () => {
      cancelled = true;
      if (es) {
        es.removeEventListener('notification', onNotification);
        es.close();
      }
    };
  }, [token, dispatch]);
}
