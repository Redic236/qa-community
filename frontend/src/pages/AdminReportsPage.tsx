import { useState } from 'react';
import {
  Card,
  Tabs,
  Table,
  Tag,
  Space,
  Button,
  Typography,
  Pagination,
  Alert,
  Popconfirm,
  message,
} from 'antd';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useListReportsQuery, useReviewReportMutation } from '@/store/apiSlice';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getApiErrorMessage } from '@/utils/errors';
import type { Report, ReportReason, ReportStatus } from '@/types/models';

const PAGE_SIZE = 20;

const STATUS_COLORS: Record<ReportStatus, string> = {
  pending: 'orange',
  reviewed_kept: 'blue',
  reviewed_removed: 'red',
};

export default function AdminReportsPage() {
  const { t } = useTranslation();
  usePageTitle(t('nav.admin'));
  const [status, setStatus] = useState<ReportStatus>('pending');
  const [page, setPage] = useState(1);

  const { data, isFetching, error } = useListReportsQuery({
    status,
    page,
    limit: PAGE_SIZE,
  });

  const [reviewReport, { isLoading: reviewing }] = useReviewReportMutation();

  const onReview = async (id: number, action: 'keep' | 'remove') => {
    try {
      await reviewReport({ id, action }).unwrap();
      message.success(action === 'remove' ? t('admin.removed') : t('admin.kept'));
    } catch (err) {
      message.error(getApiErrorMessage(err as never));
    }
  };

  return (
    <Card
      title={
        <Tabs
          activeKey={status}
          onChange={(k) => {
            setStatus(k as ReportStatus);
            setPage(1);
          }}
          items={[
            { key: 'pending', label: t('admin.tabsPending') },
            { key: 'reviewed_kept', label: t('admin.tabsKept') },
            { key: 'reviewed_removed', label: t('admin.tabsRemoved') },
          ]}
          style={{ marginBottom: -8 }}
        />
      }
    >
      {error && (
        <Alert type="error" message={getApiErrorMessage(error)} style={{ marginBottom: 12 }} />
      )}
      <Table<Report>
        rowKey="id"
        loading={isFetching}
        dataSource={data?.items ?? []}
        pagination={false}
        scroll={{ x: 'max-content' }}
        columns={[
          {
            title: t('admin.columns.time'),
            dataIndex: 'createdAt',
            width: 160,
            render: (v: string) => new Date(v).toLocaleString(),
          },
          {
            title: t('admin.columns.target'),
            width: 220,
            render: (_, r) => (
              <Space direction="vertical" size={0}>
                <Tag>
                  {r.targetType === 'question'
                    ? t('admin.targetQuestion')
                    : t('admin.targetAnswer')}
                </Tag>
                {r.targetType === 'question' ? (
                  <Link to={`/questions/${r.targetId}`}>
                    {t('admin.viewTarget', { id: r.targetId })}
                  </Link>
                ) : (
                  <Typography.Text type="secondary">
                    {t('admin.answerTarget', { id: r.targetId })}
                  </Typography.Text>
                )}
              </Space>
            ),
          },
          {
            title: t('admin.columns.reason'),
            dataIndex: 'reason',
            width: 140,
            render: (r: ReportReason) => t(`report.reasons.${r}`),
          },
          {
            title: t('admin.columns.details'),
            dataIndex: 'details',
            render: (d: string | null) =>
              d ? (
                <Typography.Paragraph
                  ellipsis={{ rows: 2, expandable: true, symbol: t('admin.expandSymbol') }}
                  style={{ marginBottom: 0 }}
                >
                  {d}
                </Typography.Paragraph>
              ) : (
                <Typography.Text type="secondary">-</Typography.Text>
              ),
          },
          {
            title: t('admin.columns.reporter'),
            dataIndex: 'reporterId',
            width: 100,
            render: (id: number) => `#${id}`,
          },
          {
            title: t('admin.columns.status'),
            dataIndex: 'status',
            width: 110,
            render: (s: ReportStatus) => (
              <Tag color={STATUS_COLORS[s]}>
                {s === 'pending'
                  ? t('admin.tabsPending')
                  : s === 'reviewed_kept'
                    ? t('admin.tabsKept')
                    : t('admin.tabsRemoved')}
              </Tag>
            ),
          },
          {
            title: t('admin.columns.actions'),
            width: 200,
            fixed: 'right',
            render: (_, r) =>
              r.status === 'pending' ? (
                <Space>
                  <Button size="small" loading={reviewing} onClick={() => onReview(r.id, 'keep')}>
                    {t('admin.actionKeep')}
                  </Button>
                  <Popconfirm
                    title={t('admin.removeConfirmTitle')}
                    description={t('admin.removeConfirmDesc')}
                    okText={t('common.delete')}
                    cancelText={t('common.cancel')}
                    okButtonProps={{ danger: true, loading: reviewing }}
                    onConfirm={() => onReview(r.id, 'remove')}
                  >
                    <Button size="small" danger>
                      {t('admin.actionRemove')}
                    </Button>
                  </Popconfirm>
                </Space>
              ) : (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {r.reviewedAt ? new Date(r.reviewedAt).toLocaleString() : '-'}
                </Typography.Text>
              ),
          },
        ]}
      />
      {data && data.total > PAGE_SIZE && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 16 }}>
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
  );
}
