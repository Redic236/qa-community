import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { SerializedError } from '@reduxjs/toolkit';
import i18n from '@/i18n';

interface ApiErrShape {
  success: false;
  error?: string;
  details?: Record<string, string[]>;
}

export function getApiErrorMessage(err: FetchBaseQueryError | SerializedError | undefined): string {
  if (!err) return 'Unexpected error';
  if ('status' in err) {
    const data = err.data as ApiErrShape | undefined;
    if (data?.details) {
      const first = Object.values(data.details)[0];
      if (Array.isArray(first) && first.length > 0) return first[0]!;
    }
    if (data?.error) return data.error;
    if (err.status === 'FETCH_ERROR') return i18n.t('errors.fetchFail');
    return `HTTP ${err.status}`;
  }
  return err.message ?? i18n.t('errors.unexpected');
}
