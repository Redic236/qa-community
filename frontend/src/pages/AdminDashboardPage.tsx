import { useState } from 'react';
import {
  Alert,
  Card,
  Col,
  Radio,
  Row,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from 'recharts';
import { useGetAdminStatsQuery } from '@/store/apiSlice';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getApiErrorMessage } from '@/utils/errors';
import EmptyState from '@/components/EmptyState';
import type { AdminTopUser, AdminTopTag } from '@/types/models';

const SERIES_COLORS = {
  questions: '#1677ff',
  answers: '#52c41a',
  comments: '#faad14',
  newUsers: '#eb2f96',
};

function shortDay(iso: string): string {
  // "2026-04-15" → "04-15" so the 30-day x-axis stays readable
  return iso.slice(5);
}

type RangeDays = 7 | 30 | 90;
const RANGE_OPTIONS: RangeDays[] = [7, 30, 90];

export default function AdminDashboardPage() {
  const { t } = useTranslation();
  usePageTitle(t('dashboard.title'));
  const [days, setDays] = useState<RangeDays>(30);
  const { data, isFetching, error } = useGetAdminStatsQuery({ days });

  if (isFetching && !data) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 10 }} />
      </Card>
    );
  }

  if (error) {
    return <Alert type="error" message={getApiErrorMessage(error)} />;
  }

  if (!data) {
    return <EmptyState description={t('dashboard.empty')} />;
  }

  const { kpis, daily, topUsers, topTags } = data;

  const chartData = daily.map((d) => ({
    date: shortDay(d.date),
    questions: d.questions,
    answers: d.answers,
    comments: d.comments,
    newUsers: d.newUsers,
  }));

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Typography.Title level={3} style={{ marginBottom: 4 }}>
            {t('dashboard.title')}
          </Typography.Title>
          <Typography.Text type="secondary">
            {t('dashboard.subtitleDays', { days })}
          </Typography.Text>
        </div>
        <Radio.Group
          value={days}
          onChange={(e) => setDays(e.target.value as RangeDays)}
          optionType="button"
          buttonStyle="solid"
          options={RANGE_OPTIONS.map((d) => ({
            label: t('dashboard.range', { days: d }),
            value: d,
          }))}
        />
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} md={6} lg={6} xl={3}>
          <Card>
            <Statistic title={t('dashboard.kpis.users')} value={kpis.users} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={6} xl={3}>
          <Card>
            <Statistic title={t('dashboard.kpis.questions')} value={kpis.questions} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={6} xl={3}>
          <Card>
            <Statistic title={t('dashboard.kpis.answers')} value={kpis.answers} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={6} xl={3}>
          <Card>
            <Statistic title={t('dashboard.kpis.comments')} value={kpis.comments} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={6} xl={4}>
          <Card>
            <Statistic
              title={t('dashboard.kpis.pendingReports')}
              value={kpis.pendingReports}
              valueStyle={kpis.pendingReports > 0 ? { color: '#cf1322' } : undefined}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={6} xl={4}>
          <Card>
            <Statistic title={t('dashboard.kpis.newUsers7d')} value={kpis.newUsers7d} />
          </Card>
        </Col>
        <Col xs={24} sm={8} md={6} lg={6} xl={4}>
          <Card>
            <Statistic title={t('dashboard.kpis.newQuestions7d')} value={kpis.newQuestions7d} />
          </Card>
        </Col>
      </Row>

      <Card title={t('dashboard.trendsTitleDays', { days })}>
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="questions"
                name={t('dashboard.trends.questions')}
                stroke={SERIES_COLORS.questions}
                dot={false}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="answers"
                name={t('dashboard.trends.answers')}
                stroke={SERIES_COLORS.answers}
                dot={false}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="comments"
                name={t('dashboard.trends.comments')}
                stroke={SERIES_COLORS.comments}
                dot={false}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="newUsers"
                name={t('dashboard.trends.newUsers')}
                stroke={SERIES_COLORS.newUsers}
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title={t('dashboard.topUsersTitle')}>
            {topUsers.length === 0 ? (
              <EmptyState description={t("dashboard.empty")} />
            ) : (
              <Table<AdminTopUser>
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={topUsers}
                columns={[
                  {
                    title: t('dashboard.topUsersColumns.rank'),
                    width: 60,
                    render: (_, _r, idx) => (
                      <Tag color={idx < 3 ? 'gold' : undefined}>{idx + 1}</Tag>
                    ),
                  },
                  {
                    title: t('dashboard.topUsersColumns.user'),
                    dataIndex: 'username',
                    render: (name: string, r) => (
                      <Link to={`/profile?u=${r.id}`}>{name}</Link>
                    ),
                  },
                  {
                    title: t('dashboard.topUsersColumns.points'),
                    dataIndex: 'points',
                    width: 100,
                    align: 'right',
                  },
                ]}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={t('dashboard.topTagsTitle')}>
            {topTags.length === 0 ? (
              <EmptyState description={t("dashboard.empty")} />
            ) : (
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <BarChart
                    data={topTags as AdminTopTag[]}
                    layout="vertical"
                    margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="tag" tick={{ fontSize: 12 }} width={80} />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      name={t('dashboard.topTagsColumns.count')}
                      fill={SERIES_COLORS.questions}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
