import { useState } from 'react';
import {
  Alert,
  Avatar,
  Card,
  Radio,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import {
  CrownFilled,
  LikeOutlined,
  MessageOutlined,
  CheckCircleTwoTone,
  TrophyFilled,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  useGetUserLeaderboardQuery,
  useGetQuestionLeaderboardQuery,
} from '@/store/apiSlice';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getApiErrorMessage } from '@/utils/errors';
import EmptyState from '@/components/EmptyState';
import { LoadingList } from '@/components/LoadingCard';
import type {
  LeaderboardRange,
  LeaderboardScope,
  LeaderboardQuestion,
  LeaderboardUser,
} from '@/types/models';

const RANGES: LeaderboardRange[] = ['7d', '30d', 'all'];

// Gold / silver / bronze for the top 3 rank cells.
const MEDAL_COLORS = ['#d4a017', '#b0b0b0', '#cd7f32'];

function RankCell({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <CrownFilled style={{ color: MEDAL_COLORS[rank - 1], fontSize: 18 }} aria-label={`#${rank}`} />
    );
  }
  return <Typography.Text type="secondary">#{rank}</Typography.Text>;
}

export default function LeaderboardPage() {
  const { t } = useTranslation();
  usePageTitle(t('leaderboard.title'));
  const [scope, setScope] = useState<LeaderboardScope>('users');
  const [range, setRange] = useState<LeaderboardRange>('all');

  const {
    data: users,
    isFetching: loadingUsers,
    error: usersError,
  } = useGetUserLeaderboardQuery({ limit: 20 }, { skip: scope !== 'users' });
  const {
    data: questions,
    isFetching: loadingQuestions,
    error: questionsError,
  } = useGetQuestionLeaderboardQuery(
    { range, limit: 20 },
    { skip: scope !== 'questions' }
  );

  const activeError = scope === 'users' ? usersError : questionsError;
  const activeLoading = scope === 'users' ? loadingUsers : loadingQuestions;

  return (
    <Card
      title={
        <Space>
          <TrophyFilled style={{ color: '#d4a017' }} />
          {t('leaderboard.title')}
        </Space>
      }
      extra={
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('leaderboard.subtitle')}
        </Typography.Text>
      }
    >
      <Tabs
        activeKey={scope}
        onChange={(k) => setScope(k as LeaderboardScope)}
        items={[
          { key: 'users', label: t('leaderboard.tabs.users') },
          { key: 'questions', label: t('leaderboard.tabs.questions') },
        ]}
      />

      {scope === 'questions' && (
        <div style={{ marginBottom: 16 }}>
          <Radio.Group
            value={range}
            onChange={(e) => setRange(e.target.value as LeaderboardRange)}
            optionType="button"
            buttonStyle="solid"
            options={RANGES.map((r) => ({
              label: t(`leaderboard.range.${r}`),
              value: r,
            }))}
          />
        </div>
      )}

      {activeError && (
        <Alert
          type="error"
          message={getApiErrorMessage(activeError)}
          style={{ marginBottom: 12 }}
        />
      )}

      {activeLoading ? (
        <LoadingList count={6} />
      ) : scope === 'users' ? (
        !users || users.length === 0 ? (
          <EmptyState description={t('leaderboard.empty')} />
        ) : (
          <Table<LeaderboardUser>
            rowKey="id"
            pagination={false}
            dataSource={users}
            columns={[
              {
                title: t('leaderboard.userColumns.rank'),
                width: 72,
                align: 'center',
                render: (_, _r, idx) => <RankCell rank={idx + 1} />,
              },
              {
                title: t('leaderboard.userColumns.user'),
                render: (_, r) => (
                  <Space>
                    <Avatar
                      src={r.avatar ?? undefined}
                      size="small"
                      style={{ backgroundColor: '#1677ff' }}
                    >
                      {r.username.charAt(0).toUpperCase()}
                    </Avatar>
                    <Typography.Text strong>{r.username}</Typography.Text>
                  </Space>
                ),
              },
              {
                title: t('leaderboard.userColumns.points'),
                dataIndex: 'points',
                width: 120,
                align: 'right',
                render: (v: number) => (
                  <Typography.Text strong style={{ color: '#1677ff' }}>
                    {v}
                  </Typography.Text>
                ),
              },
            ]}
          />
        )
      ) : !questions || questions.length === 0 ? (
        <EmptyState description={t('leaderboard.empty')} />
      ) : (
        <Table<LeaderboardQuestion>
          rowKey="id"
          pagination={false}
          dataSource={questions}
          columns={[
            {
              title: t('leaderboard.questionColumns.rank'),
              width: 72,
              align: 'center',
              render: (_, _r, idx) => <RankCell rank={idx + 1} />,
            },
            {
              title: t('leaderboard.questionColumns.title'),
              render: (_, r) => (
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Link to={`/questions/${r.id}`} style={{ fontWeight: 500 }}>
                    {r.title}
                  </Link>
                  <Space wrap size={4}>
                    {r.tags.map((tg) => (
                      <Tag key={tg} color="blue">
                        {tg}
                      </Tag>
                    ))}
                    {r.isSolved && (
                      <Tag icon={<CheckCircleTwoTone twoToneColor="#52c41a" />} color="success">
                        {t('home.stats.solved')}
                      </Tag>
                    )}
                  </Space>
                </Space>
              ),
            },
            {
              title: t('leaderboard.questionColumns.votes'),
              dataIndex: 'votes',
              width: 90,
              align: 'right',
              render: (v: number) => (
                <Space>
                  <LikeOutlined /> {v}
                </Space>
              ),
            },
            {
              title: t('leaderboard.questionColumns.answers'),
              dataIndex: 'answersCount',
              width: 90,
              align: 'right',
              render: (v: number) => (
                <Space>
                  <MessageOutlined /> {v}
                </Space>
              ),
            },
          ]}
        />
      )}
    </Card>
  );
}
