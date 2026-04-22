import { useState } from 'react';
import { Space, Button, Input, Typography, Popconfirm, message } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  useCreateCommentMutation,
  useDeleteCommentMutation,
} from '@/store/apiSlice';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getApiErrorMessage } from '@/utils/errors';
import type { Comment, VoteTargetType } from '@/types/models';

interface Props {
  targetType: VoteTargetType;
  targetId: number;
  questionId: number;
  comments: Comment[];
}

/**
 * Compact inline comment thread under a question or answer. Comments are
 * lighter than answers — short text, no votes, no editing.
 */
export default function CommentSection({ targetType, targetId, questionId, comments }: Props) {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const [createComment, { isLoading: posting }] = useCreateCommentMutation();
  const [deleteComment, { isLoading: deleting }] = useDeleteCommentMutation();

  const onSubmit = async () => {
    const trimmed = draft.trim();
    if (trimmed.length < 2) {
      message.warning(t('comment.minWarning'));
      return;
    }
    try {
      await createComment({ targetType, targetId, content: trimmed, questionId }).unwrap();
      setDraft('');
      setAdding(false);
    } catch (err) {
      message.error(getApiErrorMessage(err as never));
    }
  };

  const onDelete = async (id: number) => {
    try {
      await deleteComment({ id, questionId }).unwrap();
    } catch (err) {
      message.error(getApiErrorMessage(err as never));
    }
  };

  return (
    <div
      style={{
        marginTop: 12,
        paddingTop: 8,
        borderTop: '1px dashed #e5e7eb',
      }}
    >
      {comments.length > 0 && (
        <Space direction="vertical" size={4} style={{ width: '100%', marginBottom: 8 }}>
          {comments.map((c) => (
            <div key={c.id} style={{ fontSize: 13, color: '#3f3f46' }}>
              <Typography.Text style={{ whiteSpace: 'pre-wrap' }}>{c.content}</Typography.Text>{' '}
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                · {t('comment.userPrefix', { id: c.authorId })} ·{' '}
                {new Date(c.createdAt).toLocaleString()}
              </Typography.Text>
              {(me?.id === c.authorId || me?.role === 'admin') && (
                <Popconfirm
                  title={t('comment.deleteConfirm')}
                  okText={t('common.delete')}
                  cancelText={t('common.cancel')}
                  okButtonProps={{ danger: true, loading: deleting }}
                  onConfirm={() => onDelete(c.id)}
                >
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label={t('comment.deleteAria')}
                    style={{ marginLeft: 4 }}
                  />
                </Popconfirm>
              )}
            </div>
          ))}
        </Space>
      )}

      {adding ? (
        <div>
          <Input.TextArea
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={500}
            placeholder={t('comment.placeholder')}
          />
          <Space style={{ marginTop: 8 }}>
            <Button type="primary" size="small" loading={posting} onClick={onSubmit}>
              {t('comment.publishButton')}
            </Button>
            <Button
              size="small"
              onClick={() => {
                setAdding(false);
                setDraft('');
              }}
            >
              {t('common.cancel')}
            </Button>
          </Space>
        </div>
      ) : (
        <Button
          type="link"
          size="small"
          style={{ padding: 0 }}
          onClick={() => {
            if (!me) return navigate('/login');
            setAdding(true);
          }}
        >
          {comments.length === 0 ? t('comment.addComment') : t('comment.reply')}
        </Button>
      )}
    </div>
  );
}
