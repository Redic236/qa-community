import { Card, Skeleton, Space, theme } from 'antd';

interface LoadingCardProps {
  rows?: number;
  paragraph?: boolean;
}

/** Card-shaped skeleton placeholder for content-page loading states. */
export function LoadingCard({ rows = 4, paragraph = true }: LoadingCardProps) {
  return (
    <Card>
      <Skeleton active title paragraph={paragraph ? { rows } : false} />
    </Card>
  );
}

/**
 * Mirrors the real HomePage list row geometry: title, two tag chips, and a
 * 2-line preview sit inside a 16px-vertical-padded row. Layout-matched
 * skeletons reduce the jump when real data arrives.
 */
function LoadingRow() {
  const { token: tk } = theme.useToken();
  return (
    <div
      style={{
        padding: '16px 24px',
        borderBottom: `1px solid ${tk.colorBorderSecondary}`,
      }}
    >
      <Skeleton.Input active size="small" style={{ width: '60%', height: 20, marginBottom: 8 }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <Skeleton.Button active size="small" style={{ width: 50, height: 20 }} />
        <Skeleton.Button active size="small" style={{ width: 50, height: 20 }} />
      </div>
      <Skeleton active title={false} paragraph={{ rows: 2, width: ['100%', '60%'] }} />
    </div>
  );
}

/**
 * HomePage list shimmer. Uses row-shaped skeletons (not card-shaped) so the
 * outline of what's loading matches the actual row layout — less jank when
 * the real list replaces it.
 */
export function LoadingList({ count = 4 }: { count?: number }) {
  return (
    <Space direction="vertical" size={0} style={{ width: '100%' }}>
      {Array.from({ length: count }).map((_, i) => (
        <LoadingRow key={i} />
      ))}
    </Space>
  );
}
