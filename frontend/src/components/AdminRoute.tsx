import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Result } from 'antd';
import { useTranslation } from 'react-i18next';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAppSelector } from '@/store';

export default function AdminRoute({ children }: { children: ReactNode }) {
  const token = useAppSelector((s) => s.auth.token);
  const me = useCurrentUser();
  const { t } = useTranslation();

  if (!token) return <Navigate to="/login" replace />;
  // While `useMeQuery` is in flight on hard refresh, render nothing rather
  // than briefly flashing the 403 page.
  if (!me) return null;
  if (me.role !== 'admin') {
    return <Result status="403" title="403" subTitle={t('admin.noPermission')} />;
  }
  return <>{children}</>;
}
