const TOKEN_KEY = 'qa.token';
const USER_KEY = 'qa.user';

import type { User } from '@/types/models';

export const tokenStorage = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* noop — private mode / full storage */
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* noop */
    }
  },
};

export const userStorage = {
  get(): User | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  },
  set(user: User): void {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      /* noop */
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(USER_KEY);
    } catch {
      /* noop */
    }
  },
};
