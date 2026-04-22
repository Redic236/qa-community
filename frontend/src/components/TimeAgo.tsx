import { Tooltip, Typography } from 'antd';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { formatAbsoluteTime, formatRelativeTime } from '@/utils/time';

interface Props {
  iso: string;
  /** Pass through style props — most callers want secondary text small. */
  style?: CSSProperties;
  /** If true, render as secondary Typography.Text; else plain span. */
  secondary?: boolean;
}

/**
 * Shows a human-friendly relative time ("3 分钟前") with the full timestamp
 * in a hover tooltip. Centralizing this keeps every list row, comment, and
 * notification showing the same format — previously each page did its own
 * `new Date(...).toLocaleString()`, which gave an ugly dense timestamp.
 */
export default function TimeAgo({ iso, style, secondary = true }: Props) {
  const { i18n } = useTranslation();
  const text = formatRelativeTime(iso, i18n.language);
  const title = formatAbsoluteTime(iso);
  const content = secondary ? (
    <Typography.Text type="secondary" style={style}>
      {text}
    </Typography.Text>
  ) : (
    <span style={style}>{text}</span>
  );
  return <Tooltip title={title}>{content}</Tooltip>;
}
