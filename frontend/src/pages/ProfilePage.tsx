import { useState } from 'react';
import {
  Card,
  Descriptions,
  Statistic,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  Alert,
  Pagination,
  Avatar,
  Button,
  Skeleton,
  Grid,
  ConfigProvider,
  Progress,
  List,
} from 'antd';
import {
  UserOutlined,
  EditOutlined,
  CheckCircleTwoTone,
  LikeOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  useListMyPointsQuery,
  useListMyFollowedQuestionsQuery,
  useListMyFollowedUsersQuery,
} from '@/store/apiSlice';
import { getApiErrorMessage } from '@/utils/errors';
import EditProfileModal from '@/components/EditProfileModal';
import EmptyState from '@/components/EmptyState';
import LevelBadge from '@/components/LevelBadge';
import { getLevel, levelProgress } from '@/utils/levels';
import type { PointRecord, PointType } from '@/types/models';

const PAGE_SIZE = 10;

const TYPE_COLORS: Record<PointType, string> = {
  ask: 'orange',
  answer: 'blue',
  accept: 'green',
  like_question: 'purple',
  like_answer: 'purple',
};

// Reuse the labels we defined in profile.history.types.* — keep mapping local.
const TYPE_I18N_KEY: Record<PointType, string> = {
  ask: 'profile.history.types.ask',
  answer: 'profile.history.types.answer',
  accept: 'profile.history.types.accept',
  like_question: 'profile.history.types.like_question',
  like_answer: 'profile.history.types.like_answer',
};

export default function ProfilePage() {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(false);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.sm;
  const { t } = useTranslation();

  const { data, isFetching, error } = useListMyPointsQuery(
    { page, limit: PAGE_SIZE },
    { skip: !me }
  );

  usePageTitle(me?.username ?? t('nav.profile'));

  if (!me) {
    return (
      <Card>
        <Skeleton avatar active title paragraph={{ rows: 3 }} />
      </Card>
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card
        extra={
          <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
            {t('profile.editProfile')}
          </Button>
        }
      >
        <Space
          size={isMobile ? 'middle' : 'large'}
          align={isMobile ? 'start' : 'center'}
          direction={isMobile ? 'vertical' : 'horizontal'}
          style={{ width: '100%' }}
        >
          <Avatar size={isMobile ? 56 : 72} src={me.avatar ?? undefined} icon={<UserOutlined />} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <Space align="center" wrap>
              <Typography.Title level={3} style={{ margin: 0 }}>
                {me.username}
              </Typography.Title>
              <LevelBadge points={me.points} />
            </Space>
            <div>
              <Typography.Text type="secondary">{me.email}</Typography.Text>
            </div>
            {(() => {
              const level = getLevel(me.points);
              if (level.nextThreshold === null) {
                return (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {t('level.max')}
                  </Typography.Text>
                );
              }
              const diff = Math.max(0, level.nextThreshold - me.points);
              return (
                <div style={{ marginTop: 8, maxWidth: 320 }}>
                  <Progress
                    percent={Math.round(levelProgress(me.points, level) * 100)}
                    size="small"
                    showInfo={false}
                  />
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {t('level.next', { threshold: level.nextThreshold, diff })}
                  </Typography.Text>
                </div>
              );
            })()}
          </div>
          <Statistic title={t('profile.currentPoints')} value={me.points} />
        </Space>
        <Descriptions
          column={isMobile ? 1 : 2}
          size="small"
          style={{ marginTop: 24 }}
        >
          <Descriptions.Item label={t('profile.userId')}>{me.id}</Descriptions.Item>
          <Descriptions.Item label={t('profile.registeredAt')}>
            {new Date(me.createdAt).toLocaleString()}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <FollowedPanel />

      <Card title={t('profile.history.title')} styles={{ body: { padding: 0 } }}>
        {error && (
          <Alert type="error" message={getApiErrorMessage(error)} style={{ margin: 16 }} />
        )}
        <ConfigProvider
          renderEmpty={() => (
            <EmptyState
              description={t('profile.history.empty')}
              hint={t('profile.history.emptyHint')}
              actionText={t('profile.history.emptyAction')}
              onAction={() => navigate('/questions/new')}
            />
          )}
        >
          <Table<PointRecord>
            rowKey="id"
            loading={isFetching}
            dataSource={data?.items ?? []}
            pagination={false}
            scroll={{ x: 'max-content' }}
            columns={[
              {
                title: t('common.createdAt'),
                dataIndex: 'createdAt',
                width: 180,
                render: (v: string) => new Date(v).toLocaleString(),
              },
              {
                title: t('profile.history.type'),
                dataIndex: 'type',
                width: 140,
                render: (typ: PointType) => {
                  const color = TYPE_COLORS[typ] ?? 'default';
                  const key = TYPE_I18N_KEY[typ];
                  // Falls back to raw value when key isn't found in resources.
                  return <Tag color={color}>{key ? t(key) : typ}</Tag>;
                },
              },
              {
                title: t('profile.history.delta'),
                dataIndex: 'points',
                width: 100,
                align: 'right',
                render: (p: number) => (
                  <Typography.Text strong type={p > 0 ? 'success' : 'danger'}>
                    {p > 0 ? `+${p}` : p}
                  </Typography.Text>
                ),
              },
              {
                title: t('profile.history.relatedId'),
                dataIndex: 'relatedId',
                render: (v: number | null) => v ?? '-',
              },
            ]}
          />
        </ConfigProvider>
        {data && data.total > PAGE_SIZE && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 16 }}>
            <Pagination
              current={data.page}
              total={data.total}
              pageSize={data.limit}
              onChange={(p) => setPage(p)}
              showSizeChanger={false}
              size="small"
            />
          </div>
        )}
      </Card>

      <EditProfileModal open={editing} user={me} onClose={() => setEditing(false)} />
    </Space>
  );
}

function FollowedPanel() {
  const { t } = useTranslation();
  const { data: qs, isFetching: loadingQs } = useListMyFollowedQuestionsQuery();
  const { data: us, isFetching: loadingUs } = useListMyFollowedUsersQuery();

  return (
    <Card title={t('profile.followed.title')}>
      <Tabs
        items={[
          {
            key: 'questions',
            label: t('profile.followed.tabs.questions'),
            children: loadingQs ? (
              <Skeleton active paragraph={{ rows: 3 }} />
            ) : !qs || qs.length === 0 ? (
              <EmptyState description={t('profile.followed.emptyQuestions')} />
            ) : (
              <List
                itemLayout="horizontal"
                dataSource={qs}
                renderItem={(q) => (
                  <List.Item
                    key={q.id}
                    actions={[
                      <Space key="v">
                        <LikeOutlined /> {q.votes}
                      </Space>,
                      <Space key="a">
                        <MessageOutlined /> {q.answersCount}
                      </Space>,
                      q.isSolved ? (
                        <Space key="s">
                          <CheckCircleTwoTone twoToneColor="#52c41a" />{' '}
                          {t('home.stats.solved')}
                        </Space>
                      ) : null,
                    ].filter(Boolean)}
                  >
                    <List.Item.Meta
                      title={<Link to={`/questions/${q.id}`}>{q.title}</Link>}
                      description={
                        <Space wrap size={4}>
                          {q.tags.map((tg) => (
                            <Tag key={tg} color="blue">
                              {tg}
                            </Tag>
                          ))}
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {new Date(q.createdAt).toLocaleString()}
                          </Typography.Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            ),
          },
          {
            key: 'users',
            label: t('profile.followed.tabs.users'),
            children: loadingUs ? (
              <Skeleton active paragraph={{ rows: 3 }} />
            ) : !us || us.length === 0 ? (
              <EmptyState description={t('profile.followed.emptyUsers')} />
            ) : (
              <List
                itemLayout="horizontal"
                dataSource={us}
                renderItem={(u) => (
                  <List.Item key={u.id}>
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          src={u.avatar ?? undefined}
                          icon={<UserOutlined />}
                          style={{ backgroundColor: '#1677ff' }}
                        >
                          {u.username.charAt(0).toUpperCase()}
                        </Avatar>
                      }
                      title={u.username}
                      description={
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {t('profile.currentPoints')}: {u.points}
                        </Typography.Text>
                      }
                    />
                  </List.Item>
                )}
              />
            ),
          },
        ]}
      />
    </Card>
  );
}
