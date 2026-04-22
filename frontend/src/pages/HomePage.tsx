import { useMemo } from 'react';
import {
  Card,
  Tabs,
  Input,
  List,
  Tag,
  Space,
  Typography,
  Pagination,
  Alert,
  Button,
  Tooltip,
  message,
} from 'antd';
import {
  LikeOutlined,
  LikeFilled,
  MessageOutlined,
  CheckCircleTwoTone,
} from '@ant-design/icons';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useListQuestionsQuery, useToggleVoteMutation } from '@/store/apiSlice';
import { getApiErrorMessage } from '@/utils/errors';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import EmptyState from '@/components/EmptyState';
import { LoadingList } from '@/components/LoadingCard';
import type { Question, QuestionSort } from '@/types/models';

const PAGE_SIZE = 10;
const SORT_VALUES: QuestionSort[] = ['latest', 'popular', 'unsolved'];

function parseSort(raw: string | null): QuestionSort {
  return SORT_VALUES.includes(raw as QuestionSort) ? (raw as QuestionSort) : 'latest';
}

function parsePage(raw: string | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const me = useCurrentUser();
  const { t } = useTranslation();

  const sort = parseSort(searchParams.get('sort'));
  const page = parsePage(searchParams.get('page'));
  const tag = searchParams.get('tag') ?? '';
  const q = searchParams.get('q') ?? '';

  usePageTitle(t(`home.tabs.${sort}`));

  const queryArgs = useMemo(
    () => ({
      sort,
      page,
      limit: PAGE_SIZE,
      tag: tag || undefined,
      q: q || undefined,
    }),
    [sort, page, tag, q]
  );

  const { data, isFetching, error } = useListQuestionsQuery(queryArgs);
  const [toggleVote, { isLoading: voting }] = useToggleVoteMutation();

  const onToggleLike = async (question: Question) => {
    if (!me) {
      navigate('/login');
      return;
    }
    if (question.authorId === me.id) {
      message.info(t('vote.selfHint'));
      return;
    }
    try {
      await toggleVote({
        targetType: 'question',
        targetId: question.id,
        questionId: question.id,
      }).unwrap();
    } catch (err) {
      message.error(getApiErrorMessage(err as never));
    }
  };

  const updateParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    const filterChanged = 'sort' in patch || 'tag' in patch || 'q' in patch;
    if (filterChanged && !('page' in patch)) next.delete('page');
    setSearchParams(next, { replace: false });
  };

  const hasFilter = !!(q || tag);
  const isInitialLoading = isFetching && !data;

  const renderEmpty = () => {
    if (hasFilter) {
      return (
        <EmptyState
          description={t('home.emptyNoMatch')}
          hint={t('home.emptyNoMatchHint')}
          actionText={t('home.emptyClear')}
          onAction={() => updateParams({ q: null, tag: null })}
        />
      );
    }
    return me ? (
      <EmptyState
        description={t('home.emptyNoQuestions')}
        hint={t('home.emptyHintLoggedIn')}
        actionText={t('home.emptyActionFirstAsk')}
        onAction={() => navigate('/questions/new')}
      />
    ) : (
      <EmptyState
        description={t('home.emptyNoQuestions')}
        hint={t('home.emptyHintAnon')}
        actionText={t('home.emptyActionLogin')}
        onAction={() => navigate('/login')}
      />
    );
  };

  return (
    <Card
      styles={{ body: { padding: 0 } }}
      title={
        <Space size="middle" wrap style={{ width: '100%' }}>
          <Tabs
            activeKey={sort}
            onChange={(k) => updateParams({ sort: k })}
            items={[
              { key: 'latest', label: t('home.tabs.latest') },
              { key: 'popular', label: t('home.tabs.popular') },
              { key: 'unsolved', label: t('home.tabs.unsolved') },
            ]}
            style={{ marginBottom: -8 }}
          />
          <Input.Search
            placeholder={t('home.searchPlaceholder')}
            allowClear
            defaultValue={q}
            onSearch={(v) => updateParams({ q: v.trim() || null })}
            style={{ width: 360, maxWidth: '100%' }}
          />
        </Space>
      }
    >
      {hasFilter && (
        <div style={{ padding: '12px 24px 0' }}>
          <Space wrap>
            {q && (
              <Tag closable color="geekblue" onClose={() => updateParams({ q: null })}>
                {t('home.filterKeyword', { value: q })}
              </Tag>
            )}
            {tag && (
              <Tag closable color="blue" onClose={() => updateParams({ tag: null })}>
                {t('home.filterTag', { value: tag })}
              </Tag>
            )}
          </Space>
        </div>
      )}
      {error && (
        <Alert type="error" message={getApiErrorMessage(error)} style={{ margin: 16 }} />
      )}
      {isInitialLoading ? (
        <div style={{ padding: 16 }}>
          <LoadingList count={4} />
        </div>
      ) : data && data.items.length === 0 ? (
        renderEmpty()
      ) : (
        <>
          <List
            itemLayout="vertical"
            loading={isFetching && !!data}
            dataSource={data?.items ?? []}
            renderItem={(question) => (
              <List.Item
                key={question.id}
                actions={[
                  <Tooltip
                    key="votes"
                    title={
                      !me
                        ? t('home.likeLoginPrompt')
                        : question.authorId === me.id
                          ? t('vote.selfHint')
                          : question.liked
                            ? t('vote.unlikeQuestion')
                            : t('vote.likeQuestion')
                    }
                  >
                    <Button
                      type="text"
                      size="small"
                      loading={voting}
                      onClick={() => onToggleLike(question)}
                      // Filled red when this viewer has liked it; ghost grey otherwise.
                      icon={
                        question.liked ? (
                          <LikeFilled style={{ color: '#ff4d4f' }} />
                        ) : (
                          <LikeOutlined />
                        )
                      }
                      aria-pressed={question.liked === true}
                    >
                      {question.votes}
                    </Button>
                  </Tooltip>,
                  <Space key="answers">
                    <MessageOutlined /> {question.answersCount}
                  </Space>,
                  question.isSolved ? (
                    <Space key="solved">
                      <CheckCircleTwoTone twoToneColor="#52c41a" /> {t('home.stats.solved')}
                    </Space>
                  ) : null,
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  title={
                    <Link
                      to={`/questions/${question.id}`}
                      style={{ fontSize: 16, fontWeight: 500 }}
                    >
                      {question.title}
                    </Link>
                  }
                  description={
                    <Space wrap>
                      {question.tags.map((tg) => (
                        <Tag
                          key={tg}
                          color="blue"
                          style={{ cursor: 'pointer' }}
                          onClick={() => updateParams({ tag: tg })}
                        >
                          {tg}
                        </Tag>
                      ))}
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(question.createdAt).toLocaleString()}
                      </Typography.Text>
                    </Space>
                  }
                />
                <Typography.Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 0 }}>
                  {question.content}
                </Typography.Paragraph>
              </List.Item>
            )}
            style={{ padding: '0 24px' }}
          />
          {data && data.total > PAGE_SIZE && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 16 }}>
              <Pagination
                current={data.page}
                total={data.total}
                pageSize={data.limit}
                showSizeChanger={false}
                onChange={(p) => updateParams({ page: String(p) })}
                size="small"
              />
            </div>
          )}
        </>
      )}
    </Card>
  );
}
