import {
  Alert,
  Card,
  Col,
  Progress,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import {
  QuestionCircleOutlined,
  FireOutlined,
  MessageOutlined,
  CommentOutlined,
  CheckCircleOutlined,
  CheckCircleFilled,
  LikeOutlined,
  LikeFilled,
  StarOutlined,
  TrophyOutlined,
  TrophyFilled,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ComponentType } from 'react';
import { useListMyAchievementsQuery } from '@/store/apiSlice';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getApiErrorMessage } from '@/utils/errors';
import EmptyState from '@/components/EmptyState';
import type { AchievementStatus, AchievementTier } from '@/types/models';

// String-keyed icon map — the backend ships icon names as config, frontend
// maps them to actual React components. Unknown codes fall back to TrophyOutlined.
const ICON_MAP: Record<string, ComponentType<{ style?: React.CSSProperties }>> = {
  QuestionCircleOutlined,
  FireOutlined,
  MessageOutlined,
  CommentOutlined,
  CheckCircleOutlined,
  CheckCircleFilled,
  LikeOutlined,
  LikeFilled,
  StarOutlined,
  TrophyOutlined,
};

const TIER_COLORS: Record<AchievementTier, string> = {
  bronze: '#cd7f32',
  silver: '#c0c0c0',
  gold: '#faad14',
};

function AchievementCard({ status }: { status: AchievementStatus }): JSX.Element {
  const { t } = useTranslation();
  const Icon = ICON_MAP[status.icon] ?? TrophyOutlined;
  const locked = !status.unlocked;
  const progressPct =
    status.progress !== null
      ? Math.min(100, Math.round((status.progress / status.threshold) * 100))
      : 0;

  return (
    <Card
      size="small"
      style={{
        // Greyscale + fade when locked so the wall reads as "4 of 10 earned"
        // at a glance.
        filter: locked ? 'grayscale(0.9)' : undefined,
        opacity: locked ? 0.55 : 1,
        borderColor: locked ? undefined : TIER_COLORS[status.tier],
      }}
    >
      <Space align="start" style={{ width: '100%' }}>
        <Icon style={{ fontSize: 32, color: TIER_COLORS[status.tier] }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Space wrap size={4} style={{ marginBottom: 4 }}>
            <Typography.Text strong>{t(`achievements.names.${status.code}`)}</Typography.Text>
            <Tag color={status.tier === 'gold' ? 'gold' : status.tier === 'silver' ? 'default' : 'orange'}>
              {t(`achievements.tiers.${status.tier}`)}
            </Tag>
          </Space>
          <Typography.Paragraph
            type="secondary"
            style={{ fontSize: 12, marginBottom: 8 }}
          >
            {t(`achievements.descriptions.${status.code}`, { threshold: status.threshold })}
          </Typography.Paragraph>
          {locked ? (
            <Progress
              percent={progressPct}
              size="small"
              showInfo
              format={() => `${status.progress ?? 0} / ${status.threshold}`}
            />
          ) : (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('achievements.unlockedAt', {
                time: status.unlockedAt
                  ? new Date(status.unlockedAt).toLocaleDateString()
                  : '',
              })}
            </Typography.Text>
          )}
        </div>
      </Space>
    </Card>
  );
}

export default function AchievementsPage(): JSX.Element {
  const { t } = useTranslation();
  const me = useCurrentUser();
  usePageTitle(t('achievements.title'));
  const { data, isFetching, error } = useListMyAchievementsQuery(undefined, { skip: !me });

  if (!me) {
    return <EmptyState description={t('achievements.loginRequired')} />;
  }

  const items = data ?? [];
  const unlockedCount = items.filter((a) => a.unlocked).length;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Space align="center" wrap>
          <TrophyFilled style={{ fontSize: 28, color: '#faad14' }} />
          <div>
            <Typography.Title level={3} style={{ margin: 0 }}>
              {t('achievements.title')}
            </Typography.Title>
            <Typography.Text type="secondary">
              {t('achievements.subtitle')}
            </Typography.Text>
          </div>
          <Statistic
            title={t('achievements.unlockedCount')}
            value={`${unlockedCount} / ${items.length}`}
            style={{ marginLeft: 'auto' }}
          />
        </Space>
      </Card>

      {error && <Alert type="error" message={getApiErrorMessage(error)} />}

      {isFetching && !data ? (
        <Card>
          <Typography.Text type="secondary">{t('common.loading')}</Typography.Text>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState description={t('achievements.empty')} />
      ) : (
        <Row gutter={[16, 16]}>
          {items.map((a) => (
            <Col key={a.code} xs={24} sm={12} md={12} lg={8}>
              <AchievementCard status={a} />
            </Col>
          ))}
        </Row>
      )}
    </Space>
  );
}
