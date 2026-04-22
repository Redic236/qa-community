import { Card, Skeleton, Space } from 'antd';

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

/** A list of N LoadingCards stacked vertically — for HomePage list shimmer. */
export function LoadingList({ count = 4 }: { count?: number }) {
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {Array.from({ length: count }).map((_, i) => (
        <LoadingCard key={i} rows={2} />
      ))}
    </Space>
  );
}
