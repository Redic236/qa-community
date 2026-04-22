import { Tag, Tooltip } from 'antd';
import { CrownOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { getLevel } from '@/utils/levels';

interface Props {
  points: number;
  showTooltip?: boolean;
}

const NAME_KEYS = [
  'level.names.novice',
  'level.names.active',
  'level.names.experienced',
  'level.names.expert',
  'level.names.master',
] as const;

/** Compact tier indicator next to a username or in a header. */
export default function LevelBadge({ points, showTooltip = true }: Props) {
  const { t } = useTranslation();
  const level = getLevel(points);
  const tag = (
    <Tag color={level.color} icon={<CrownOutlined />} style={{ marginInlineEnd: 0 }}>
      {t(NAME_KEYS[level.index])}
    </Tag>
  );
  if (!showTooltip) return tag;
  const tip =
    level.nextThreshold === null
      ? t('level.max')
      : t('level.currentVsNext', {
          points,
          threshold: level.nextThreshold,
          diff: Math.max(0, level.nextThreshold - points),
        });
  return <Tooltip title={tip}>{tag}</Tooltip>;
}
