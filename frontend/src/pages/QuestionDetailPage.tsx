import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  Typography,
  Tag,
  Space,
  Button,
  Alert,
  Result,
  Divider,
  List,
  Form,
  Input,
  message,
  Popconfirm,
  Skeleton,
  Grid,
} from 'antd';
import {
  LikeOutlined,
  LikeFilled,
  CheckCircleTwoTone,
  CheckOutlined,
  MessageOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import {
  useGetQuestionQuery,
  useToggleVoteMutation,
  useAcceptAnswerMutation,
  useUnacceptAnswerMutation,
  useCreateAnswerMutation,
  useDeleteQuestionMutation,
  useDeleteAnswerMutation,
} from '@/store/apiSlice';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getApiErrorMessage } from '@/utils/errors';
import { useTranslation } from 'react-i18next';
import EditQuestionModal from '@/components/EditQuestionModal';
import EditAnswerModal from '@/components/EditAnswerModal';
import EmptyState from '@/components/EmptyState';
import ReportButton from '@/components/ReportButton';
import FollowButton from '@/components/FollowButton';
import CommentSection from '@/components/CommentSection';
import type { Answer } from '@/types/models';

const answerSchema = z.object({
  content: z.string().min(5, 'answer.errors.contentMin'),
});
type AnswerValues = z.infer<typeof answerSchema>;

export default function QuestionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const numericId = Number(id);
  const validId = Number.isFinite(numericId) && numericId > 0;

  const me = useCurrentUser();
  const { data, isFetching, error } = useGetQuestionQuery(numericId, { skip: !validId });
  const [toggleVote, { isLoading: voting }] = useToggleVoteMutation();
  const [acceptAnswer, { isLoading: accepting }] = useAcceptAnswerMutation();
  const [unacceptAnswer, { isLoading: unaccepting }] = useUnacceptAnswerMutation();
  const [createAnswer, { isLoading: posting, error: postError }] = useCreateAnswerMutation();
  const [deleteQuestion, { isLoading: deletingQuestion }] = useDeleteQuestionMutation();
  const [deleteAnswer, { isLoading: deletingAnswer }] = useDeleteAnswerMutation();

  const [editingQuestion, setEditingQuestion] = useState(false);
  const [editingAnswer, setEditingAnswer] = useState<Answer | null>(null);

  const screens = Grid.useBreakpoint();
  const isMobile = !screens.sm;
  const { t } = useTranslation();

  const answerFormRef = useRef<HTMLDivElement>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AnswerValues>({
    resolver: zodResolver(answerSchema),
    defaultValues: { content: '' },
    mode: 'onTouched',
  });

  usePageTitle(data?.title ?? t('errors.invalidQuestionId'));

  if (!validId) return <Result status="404" title={t('errors.invalidQuestionId')} />;
  if (error) return <Alert type="error" message={getApiErrorMessage(error)} />;
  if (isFetching || !data) {
    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <Skeleton active title paragraph={{ rows: 4 }} />
        </Card>
        <Card>
          <Skeleton active title paragraph={{ rows: 3 }} />
        </Card>
      </Space>
    );
  }

  const isAuthor = me?.id === data.authorId;

  const onVoteQuestion = async () => {
    if (!me) return navigate('/login', { state: { from: `/questions/${data.id}` } });
    if (isAuthor) return;
    await toggleVote({
      targetType: 'question',
      targetId: data.id,
      questionId: data.id,
    }).unwrap();
  };

  const onVoteAnswer = async (answer: Answer) => {
    if (!me) return navigate('/login', { state: { from: `/questions/${data.id}` } });
    if (answer.authorId === me.id) return;
    await toggleVote({
      targetType: 'answer',
      targetId: answer.id,
      questionId: data.id,
    }).unwrap();
  };

  const onAccept = async (answer: Answer) => {
    try {
      await acceptAnswer({ answerId: answer.id, questionId: data.id }).unwrap();
      message.success(t('answer.acceptedSuccess'));
    } catch (err) {
      message.error(getApiErrorMessage(err as never));
    }
  };

  const onUnaccept = async (answer: Answer) => {
    try {
      await unacceptAnswer({ answerId: answer.id, questionId: data.id }).unwrap();
      message.success(t('answer.unacceptedSuccess'));
    } catch (err) {
      message.error(getApiErrorMessage(err as never));
    }
  };

  const onDeleteQuestion = async () => {
    try {
      await deleteQuestion(data.id).unwrap();
      message.success(t('question.deleted'));
      navigate('/', { replace: true });
    } catch (err) {
      message.error(getApiErrorMessage(err as never));
    }
  };

  const onDeleteAnswer = async (answer: Answer) => {
    try {
      await deleteAnswer({ answerId: answer.id, questionId: data.id }).unwrap();
      message.success(t('answer.deleted'));
    } catch (err) {
      message.error(getApiErrorMessage(err as never));
    }
  };

  const onSubmitAnswer = handleSubmit(async (values) => {
    try {
      await createAnswer({ questionId: data.id, content: values.content }).unwrap();
      reset();
      message.success(t('answer.publishedSuccess'));
    } catch {
      /* error shown via postError */
    }
  });

  const focusAnswerForm = () => {
    if (!me) {
      navigate('/login', { state: { from: `/questions/${data.id}` } });
      return;
    }
    answerFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    answerFormRef.current?.querySelector('textarea')?.focus();
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Space
          align="start"
          size={isMobile ? 'small' : 'large'}
          direction={isMobile ? 'vertical' : 'horizontal'}
          style={{ width: '100%' }}
        >
          <VoteButton
            liked={data.liked === true}
            count={data.votes}
            disabled={isAuthor || voting}
            onClick={onVoteQuestion}
            tooltip={isAuthor ? t('vote.selfHint') : undefined}
            ariaLabel={data.liked ? t('vote.unlikeQuestion') : t('vote.likeQuestion')}
            horizontal={isMobile}
          />
          <div style={{ flex: 1, width: '100%', minWidth: 0 }}>
            <Space align="center" style={{ marginBottom: 8, width: '100%' }} wrap>
              <Typography.Title level={3} style={{ margin: 0 }}>
                {data.title}
              </Typography.Title>
              {data.isSolved && (
                <Tag icon={<CheckCircleTwoTone twoToneColor="#52c41a" />} color="success">
                  {t('question.solved')}
                </Tag>
              )}
              <Space style={{ marginLeft: 'auto' }} wrap>
                {!isAuthor && (
                  <FollowButton
                    targetType="question"
                    targetId={data.id}
                    following={data.followingQuestion === true}
                    questionId={data.id}
                  />
                )}
                {!isAuthor && (
                  <FollowButton
                    targetType="user"
                    targetId={data.authorId}
                    following={data.followingAuthor === true}
                    questionId={data.id}
                  />
                )}
                {!isAuthor && (
                  <ReportButton
                    targetType="question"
                    targetId={data.id}
                    authorId={data.authorId}
                  />
                )}
                {isAuthor && (
                  <>
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => setEditingQuestion(true)}
                    >
                      {t('common.edit')}
                    </Button>
                    <Popconfirm
                      title={t('question.deleteConfirmTitle')}
                      description={t('question.deleteConfirmDesc')}
                      okText={t('common.delete')}
                      cancelText={t('common.cancel')}
                      okButtonProps={{ danger: true, loading: deletingQuestion }}
                      onConfirm={onDeleteQuestion}
                    >
                      <Button size="small" danger icon={<DeleteOutlined />}>
                        {t('common.delete')}
                      </Button>
                    </Popconfirm>
                  </>
                )}
              </Space>
            </Space>
            <Space wrap style={{ marginBottom: 12 }}>
              {data.tags.map((t) => (
                <Tag key={t} color="blue">
                  {t}
                </Tag>
              ))}
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('question.askedAt', { time: new Date(data.createdAt).toLocaleString() })}
              </Typography.Text>
            </Space>
            <Typography.Paragraph
              style={{ whiteSpace: 'pre-wrap', marginBottom: 0, wordBreak: 'break-word' }}
            >
              {data.content}
            </Typography.Paragraph>
            <CommentSection
              targetType="question"
              targetId={data.id}
              questionId={data.id}
              comments={data.comments ?? []}
            />
          </div>
        </Space>
      </Card>

      <Card
        title={
          <Space>
            <MessageOutlined />
            <span>{t('answer.countLabel', { count: data.answers.length })}</span>
          </Space>
        }
        styles={{ body: { padding: 0 } }}
      >
        {data.answers.length === 0 ? (
          <EmptyState
            description={t('answer.emptyTitle')}
            hint={t('answer.emptyHint')}
            actionText={t('answer.emptyAction')}
            onAction={focusAnswerForm}
          />
        ) : (
          <List
            dataSource={data.answers}
            renderItem={(a) => (
              <List.Item key={a.id} style={{ padding: 16, alignItems: 'flex-start' }}>
                <Space
                  align="start"
                  size={isMobile ? 'small' : 'large'}
                  direction={isMobile ? 'vertical' : 'horizontal'}
                  style={{ width: '100%' }}
                >
                  <VoteButton
                    liked={a.liked === true}
                    count={a.votes}
                    disabled={a.authorId === me?.id || voting}
                    onClick={() => onVoteAnswer(a)}
                    tooltip={a.authorId === me?.id ? t('vote.selfHint') : undefined}
                    ariaLabel={
                      a.liked
                        ? t('vote.unlikeAnswer', { id: a.id })
                        : t('vote.likeAnswer', { id: a.id })
                    }
                    horizontal={isMobile}
                  />
                  <div style={{ flex: 1, width: '100%', minWidth: 0 }}>
                    {a.isAccepted && (
                      <Space style={{ marginBottom: 8 }} wrap>
                        <Tag
                          icon={<CheckCircleTwoTone twoToneColor="#52c41a" />}
                          color="success"
                        >
                          {t('answer.accepted')}
                        </Tag>
                        {isAuthor && (
                          <Button
                            size="small"
                            danger
                            loading={unaccepting}
                            onClick={() => onUnaccept(a)}
                          >
                            {t('answer.unaccept')}
                          </Button>
                        )}
                      </Space>
                    )}
                    <Typography.Paragraph
                      style={{
                        whiteSpace: 'pre-wrap',
                        marginBottom: 8,
                        wordBreak: 'break-word',
                      }}
                    >
                      {a.content}
                    </Typography.Paragraph>
                    <Space wrap>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(a.createdAt).toLocaleString()}
                      </Typography.Text>
                      {isAuthor && !a.isAccepted && (
                        <Button
                          size="small"
                          icon={<CheckOutlined />}
                          loading={accepting}
                          onClick={() => onAccept(a)}
                        >
                          {t('answer.accept')}
                        </Button>
                      )}
                      {a.authorId === me?.id && (
                        <>
                          <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => setEditingAnswer(a)}
                          >
                            {t('common.edit')}
                          </Button>
                          <Popconfirm
                            title={t('answer.deleteConfirmTitle')}
                            okText={t('common.delete')}
                            cancelText={t('common.cancel')}
                            okButtonProps={{ danger: true, loading: deletingAnswer }}
                            onConfirm={() => onDeleteAnswer(a)}
                          >
                            <Button size="small" danger icon={<DeleteOutlined />}>
                              {t('common.delete')}
                            </Button>
                          </Popconfirm>
                        </>
                      )}
                      {a.authorId !== me?.id && (
                        <ReportButton
                          targetType="answer"
                          targetId={a.id}
                          authorId={a.authorId}
                        />
                      )}
                    </Space>
                    <CommentSection
                      targetType="answer"
                      targetId={a.id}
                      questionId={data.id}
                      comments={a.comments ?? []}
                    />
                  </div>
                </Space>
              </List.Item>
            )}
          />
        )}
      </Card>

      <Card title={t('answer.writeTitle')}>
        <div ref={answerFormRef}>
          {!me ? (
            <Alert
              type="info"
              message={
                <span>
                  {t('answer.loginPrompt', { login: '__LOGIN__' })
                    .split('__LOGIN__')
                    .reduce<React.ReactNode[]>((acc, part, idx, arr) => {
                      acc.push(part);
                      if (idx < arr.length - 1) {
                        acc.push(
                          <a
                            key="link"
                            onClick={() =>
                              navigate('/login', {
                                state: { from: `/questions/${data.id}` },
                              })
                            }
                          >
                            {t('nav.login')}
                          </a>
                        );
                      }
                      return acc;
                    }, [])}
                </span>
              }
            />
          ) : (
            <>
              {isAuthor && (
                <Alert
                  type="info"
                  showIcon
                  message={t('answer.selfAnswerHint')}
                  style={{ marginBottom: 16 }}
                />
              )}
              <Form layout="vertical" onFinish={onSubmitAnswer}>
                {postError && (
                  <Alert
                    type="error"
                    message={getApiErrorMessage(postError)}
                    style={{ marginBottom: 12 }}
                  />
                )}
                <Form.Item
                  validateStatus={errors.content ? 'error' : ''}
                  help={errors.content?.message ? t(errors.content.message) : undefined}
                >
                  <Controller
                    name="content"
                    control={control}
                    render={({ field }) => (
                      <Input.TextArea
                        {...field}
                        rows={5}
                        placeholder={t('answer.placeholder')}
                      />
                    )}
                  />
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={posting}>
                  {t('answer.publishButton')}
                </Button>
              </Form>
            </>
          )}
        </div>
      </Card>

      <Divider />

      <EditQuestionModal
        open={editingQuestion}
        question={data}
        onClose={() => setEditingQuestion(false)}
      />
      {editingAnswer && (
        <EditAnswerModal
          open={!!editingAnswer}
          answer={editingAnswer}
          questionId={data.id}
          onClose={() => setEditingAnswer(null)}
        />
      )}
    </Space>
  );
}

interface VoteButtonProps {
  liked: boolean;
  count: number;
  disabled?: boolean;
  onClick: () => void;
  tooltip?: string;
  ariaLabel?: string;
  /** Render the count next to the button instead of underneath. */
  horizontal?: boolean;
}

function VoteButton({
  liked,
  count,
  disabled,
  onClick,
  tooltip,
  ariaLabel,
  horizontal,
}: VoteButtonProps) {
  const button = (
    <Button
      shape="circle"
      size="large"
      type={liked ? 'primary' : 'default'}
      icon={liked ? <LikeFilled /> : <LikeOutlined />}
      disabled={disabled}
      onClick={onClick}
      title={tooltip}
      aria-label={ariaLabel ?? (liked ? '取消点赞' : '点赞')}
    />
  );
  return horizontal ? (
    <Space align="center" size={8}>
      {button}
      <Typography.Text strong>{count}</Typography.Text>
    </Space>
  ) : (
    <Space direction="vertical" align="center" size={4}>
      {button}
      <Typography.Text strong>{count}</Typography.Text>
    </Space>
  );
}
