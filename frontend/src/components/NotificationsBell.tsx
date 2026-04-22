import { useState } from 'react';
import { Badge, Button, Dropdown, List, Typography, Space, message, theme } from 'antd';
import { BellOutlined, BellFilled } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  useListNotificationsQuery,
  useMarkNotificationsReadMutation,
} from '@/store/apiSlice';
import { useAppSelector } from '@/store';
import { useNotificationStream } from '@/hooks/useNotificationStream';
import type { AppNotification } from '@/types/models';

function targetUrlOf(n: AppNotification): string | null {
  if (n.type === 'achievement_unlocked') return '/achievements';
  const p = n.payload as { questionId?: number };
  if (typeof p.questionId === 'number') return `/questions/${p.questionId}`;
  return null;
}

export default function NotificationsBell() {
  const token = useAppSelector((s) => s.auth.token);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  // Pull theme tokens so the dropdown follows light/dark instead of forcing
  // a white card on a black layout (which flattens every text child into an
  // invisible white-on-white mess).
  const { token: tk } = theme.useToken();

  // Live updates via SSE invalidate the cache the moment the server fires a
  // notification. The 5-minute poll is a safety net for stream restarts /
  // sleep / proxy edge cases — far less aggressive than the original 60s loop.
  useNotificationStream(token);
  const { data } = useListNotificationsQuery(
    { page: 1, limit: 10 },
    { skip: !token, pollingInterval: 5 * 60_000 }
  );
  const [markRead] = useMarkNotificationsReadMutation();

  if (!token) return null;

  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  const onItemClick = async (n: AppNotification) => {
    if (!n.read) {
      try {
        await markRead({ ids: [n.id] }).unwrap();
      } catch {
        /* fail silently — UX recovery via next refresh */
      }
    }
    const url = targetUrlOf(n);
    if (url) {
      setOpen(false);
      navigate(url);
    }
  };

  const onMarkAll = async () => {
    try {
      const res = await markRead({ all: true }).unwrap();
      if (res.affected > 0) message.success(t('notification.markedSuccess', { count: res.affected }));
    } catch {
      message.error(t('errors.unexpected'));
    }
  };

  const dropdown = (
    <div
      style={{
        // Theme-aware surface: AntD's algorithm derives a dark grey for
        // colorBgElevated under darkAlgorithm and white under defaultAlgorithm.
        background: tk.colorBgElevated,
        boxShadow: tk.boxShadowSecondary,
        borderRadius: tk.borderRadiusLG,
        width: 360,
        maxHeight: 480,
        overflow: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: `1px solid ${tk.colorBorderSecondary}`,
        }}
      >
        <Typography.Text strong>{t('notification.title')}</Typography.Text>
        <Button type="link" size="small" disabled={unread === 0} onClick={onMarkAll}>
          {t('notification.markAll')}
        </Button>
      </div>
      {items.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <Typography.Text type="secondary">{t('notification.empty')}</Typography.Text>
        </div>
      ) : (
        <List
          dataSource={items}
          renderItem={(n) => (
            <List.Item
              key={n.id}
              onClick={() => onItemClick(n)}
              style={{
                cursor: 'pointer',
                // Unread rows get a primary-tinted surface; colorPrimaryBg is
                // light blue in light mode and a muted dark-blue under dark.
                background: n.read ? tk.colorBgElevated : tk.colorPrimaryBg,
                padding: '10px 12px',
              }}
            >
              <Space direction="vertical" size={0} style={{ width: '100%' }}>
                <Typography.Text strong={!n.read} style={{ fontSize: 13 }}>
                  {t(`notification.types.${n.type}`)}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {new Date(n.createdAt).toLocaleString()}
                </Typography.Text>
              </Space>
            </List.Item>
          )}
        />
      )}
    </div>
  );

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      trigger={['click']}
      popupRender={() => dropdown}
    >
      <Badge count={unread} size="small" overflowCount={99}>
        <Button
          type="text"
          shape="circle"
          icon={unread > 0 ? <BellFilled /> : <BellOutlined />}
          aria-label={t('notification.ariaLabel')}
        />
      </Badge>
    </Dropdown>
  );
}
