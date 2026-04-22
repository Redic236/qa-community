import { useMemo, useState } from 'react';
import { Space, Button, Input, Typography, Popconfirm, message } from 'antd';
import { DeleteOutlined, EnterOutlined } from '@ant-design/icons';
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

interface ThreadedComment extends Comment {
  replies: Comment[];
}

/**
 * Build a 2-level tree out of the flat list. The server caps depth at 1 reply
 * so anything with `parentId` lives directly under its root.
 */
function buildThread(comments: Comment[]): ThreadedComment[] {
  const roots: ThreadedComment[] = [];
  const byId = new Map<number, ThreadedComment>();
  // Preserve server-side chronological ordering of roots; replies keep the
  // same relative order within each root.
  for (const c of comments) {
    if (c.parentId === null) {
      const t: ThreadedComment = { ...c, replies: [] };
      roots.push(t);
      byId.set(c.id, t);
    }
  }
  for (const c of comments) {
    if (c.parentId !== null) {
      const root = byId.get(c.parentId);
      if (root) root.replies.push(c);
      // Orphan replies (parent deleted mid-race) are just dropped — the
      // cascade should usually have removed them already.
    }
  }
  return roots;
}

/**
 * Compact inline comment thread under a question or answer.
 *
 * UX:
 *   - Flat list of roots + indented replies (max 1 level deep).
 *   - Each root has a "reply" button that opens an inline composer.
 *   - Replies inherit the root's position — no cross-root moving.
 */
export default function CommentSection({ targetType, targetId, questionId, comments }: Props) {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [addingRoot, setAddingRoot] = useState(false);
  const [rootDraft, setRootDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyDraft, setReplyDraft] = useState('');

  const [createComment, { isLoading: posting }] = useCreateCommentMutation();
  const [deleteComment, { isLoading: deleting }] = useDeleteCommentMutation();

  const threaded = useMemo(() => buildThread(comments), [comments]);

  const submit = async (content: string, parentId?: number): Promise<boolean> => {
    const trimmed = content.trim();
    if (trimmed.length < 2) {
      message.warning(t('comment.minWarning'));
      return false;
    }
    try {
      await createComment({
        targetType,
        targetId,
        content: trimmed,
        questionId,
        parentId,
      }).unwrap();
      return true;
    } catch (err) {
      message.error(getApiErrorMessage(err as never));
      return false;
    }
  };

  const onDelete = async (id: number): Promise<void> => {
    try {
      await deleteComment({ id, questionId }).unwrap();
    } catch (err) {
      message.error(getApiErrorMessage(err as never));
    }
  };

  const openReply = (rootId: number): void => {
    if (!me) {
      navigate('/login');
      return;
    }
    setReplyingTo(rootId);
    setReplyDraft('');
  };

  const renderCommentBody = (c: Comment): JSX.Element => (
    <>
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
    </>
  );

  return (
    <div
      style={{
        marginTop: 12,
        paddingTop: 8,
        borderTop: '1px dashed #e5e7eb',
      }}
    >
      {threaded.length > 0 && (
        <Space direction="vertical" size={6} style={{ width: '100%', marginBottom: 8 }}>
          {threaded.map((root) => (
            <div key={root.id} style={{ fontSize: 13, color: '#3f3f46' }}>
              <div>
                {renderCommentBody(root)}
                <Button
                  type="link"
                  size="small"
                  style={{ padding: '0 4px', marginLeft: 4, fontSize: 12 }}
                  onClick={() => openReply(root.id)}
                >
                  {t('comment.reply')}
                </Button>
              </div>

              {root.replies.length > 0 && (
                <div
                  style={{
                    marginLeft: 16,
                    marginTop: 4,
                    paddingLeft: 8,
                    borderLeft: '2px solid #f0f0f0',
                  }}
                >
                  {root.replies.map((reply) => (
                    <div
                      key={reply.id}
                      style={{ fontSize: 12.5, color: '#52525b', padding: '2px 0' }}
                    >
                      <EnterOutlined
                        rotate={90}
                        style={{ color: '#a0a0a0', marginRight: 4 }}
                      />
                      {renderCommentBody(reply)}
                    </div>
                  ))}
                </div>
              )}

              {replyingTo === root.id && (
                <div style={{ marginLeft: 16, marginTop: 6 }}>
                  <Input.TextArea
                    rows={2}
                    value={replyDraft}
                    onChange={(e) => setReplyDraft(e.target.value)}
                    maxLength={500}
                    placeholder={t('comment.replyPlaceholder')}
                    autoFocus
                  />
                  <Space style={{ marginTop: 6 }}>
                    <Button
                      type="primary"
                      size="small"
                      loading={posting}
                      onClick={async () => {
                        const ok = await submit(replyDraft, root.id);
                        if (ok) {
                          setReplyingTo(null);
                          setReplyDraft('');
                        }
                      }}
                    >
                      {t('comment.publishButton')}
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        setReplyingTo(null);
                        setReplyDraft('');
                      }}
                    >
                      {t('common.cancel')}
                    </Button>
                  </Space>
                </div>
              )}
            </div>
          ))}
        </Space>
      )}

      {addingRoot ? (
        <div>
          <Input.TextArea
            rows={2}
            value={rootDraft}
            onChange={(e) => setRootDraft(e.target.value)}
            maxLength={500}
            placeholder={t('comment.placeholder')}
            autoFocus
          />
          <Space style={{ marginTop: 8 }}>
            <Button
              type="primary"
              size="small"
              loading={posting}
              onClick={async () => {
                const ok = await submit(rootDraft);
                if (ok) {
                  setAddingRoot(false);
                  setRootDraft('');
                }
              }}
            >
              {t('comment.publishButton')}
            </Button>
            <Button
              size="small"
              onClick={() => {
                setAddingRoot(false);
                setRootDraft('');
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
            setAddingRoot(true);
          }}
        >
          {t('comment.addComment')}
        </Button>
      )}
    </div>
  );
}
