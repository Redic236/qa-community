import { useEffect } from 'react';
import { useAppDispatch } from '@/store';
import { apiSlice } from '@/store/apiSlice';

/**
 * Open an SSE connection to /api/notifications/stream and invalidate the
 * Notifications cache whenever the server pushes a new event. Pair with the
 * existing `useListNotificationsQuery` — invalidation triggers a refetch that
 * updates both the unread badge and the dropdown list in one round-trip.
 *
 * Fail-open: if EventSource is unsupported or the connection drops, the
 * existing list query keeps working; the bell just stops auto-updating.
 */
export function useNotificationStream(token: string | null): void {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!token) return;
    if (typeof EventSource === 'undefined') return;

    // Token in query is acceptable here: EventSource cannot send custom
    // headers, the connection is short-lived per session, and JWTs already
    // travel over HTTPS in production.
    const url = `/api/notifications/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    const onNotification = () => {
      // Achievement unlocks come in as notifications too — refresh both caches
      // so the badge wall lights up immediately without a manual reload.
      dispatch(apiSlice.util.invalidateTags(['Notifications', 'Achievements']));
    };

    es.addEventListener('notification', onNotification);
    // EventSource auto-reconnects with a backoff on transport errors; we don't
    // need our own retry loop. Just log so debugging is possible.
    es.addEventListener('error', () => {
      // readyState === 0 (CONNECTING) means it's already retrying; readyState
      // === 2 (CLOSED) is terminal and usually means auth/server rejection.
      if (es.readyState === EventSource.CLOSED) {
        // eslint-disable-next-line no-console
        console.warn('[notifications] SSE closed by server');
      }
    });

    return () => {
      es.removeEventListener('notification', onNotification);
      es.close();
    };
  }, [token, dispatch]);
}
