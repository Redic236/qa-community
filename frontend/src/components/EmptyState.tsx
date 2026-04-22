import { Empty, Button, Space, Typography } from 'antd';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  description: ReactNode;
  hint?: ReactNode;
  actionText?: string;
  onAction?: () => void;
  image?: ReactNode;
}

/**
 * Consistent empty state wrapper. Use across pages for "no data" sections so
 * descriptions, paddings, and CTAs feel uniform.
 */
export default function EmptyState({
  description,
  hint,
  actionText,
  onAction,
  image,
}: EmptyStateProps) {
  return (
    <div style={{ padding: '64px 16px' }}>
      <Empty
        image={image ?? Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Space direction="vertical" align="center" size={4}>
            <Typography.Text>{description}</Typography.Text>
            {hint && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {hint}
              </Typography.Text>
            )}
          </Space>
        }
      >
        {actionText && onAction && (
          <Button type="primary" onClick={onAction} style={{ marginTop: 12 }}>
            {actionText}
          </Button>
        )}
      </Empty>
    </div>
  );
}
