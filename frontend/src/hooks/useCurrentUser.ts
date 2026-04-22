import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import { useMeQuery } from '@/store/apiSlice';
import { updateUser } from '@/store/authSlice';
import type { User } from '@/types/models';

/**
 * Single source of truth for the current authenticated user.
 *
 * - When token exists, fetches /api/auth/me through RTK Query (cached + invalidated
 *   by mutations that change `user.points`).
 * - Falls back to `auth.user` from local storage while the network request is in
 *   flight (avoids the header flickering on hard refresh).
 * - Syncs the latest server-side user back into authSlice so any consumer reading
 *   directly from state stays current.
 */
export function useCurrentUser(): User | null {
  const token = useAppSelector((s) => s.auth.token);
  const fallback = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const { data } = useMeQuery(undefined, { skip: !token });

  useEffect(() => {
    if (data) dispatch(updateUser(data));
  }, [data, dispatch]);

  if (!token) return null;
  return data ?? fallback;
}
