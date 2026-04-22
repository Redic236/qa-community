import { Button, Tooltip, message } from 'antd';
import { StarOutlined, StarFilled, UserAddOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToggleFollowMutation } from '@/store/apiSlice';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getApiErrorMessage } from '@/utils/errors';
import type { FollowTargetType } from '@/types/models';

interface Props {
  targetType: FollowTargetType;
  targetId: number;
  following: boolean;
  /** For question detail invalidation — pass the question id when in that scope. */
  questionId?: number;
  /** Hide if viewer is the target itself (e.g. don't show on own user card). */
  hideIfSelf?: boolean;
  size?: 'small' | 'middle' | 'large';
}

/**
 * Unified follow/unfollow button for both question-follow (★) and
 * user-follow (👤+). Self-follow is hidden, anonymous viewers bounce to login.
 */
export default function FollowButton({
  targetType,
  targetId,
  following,
  questionId,
  hideIfSelf = true,
  size = 'small',
}: Props) {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [toggle, { isLoading }] = useToggleFollowMutation();

  if (hideIfSelf && me && targetType === 'user' && me.id === targetId) return null;

  const onClick = async (): Promise<void> => {
    if (!me) {
      navigate('/login');
      return;
    }
    try {
      await toggle({ targetType, targetId, questionId }).unwrap();
    } catch (err) {
      message.error(getApiErrorMessage(err as never));
    }
  };

  const isQuestion = targetType === 'question';
  const icon = isQuestion ? (
    following ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />
  ) : (
    <UserAddOutlined />
  );
  const labelKey = isQuestion
    ? following
      ? 'follow.unfollowQuestion'
      : 'follow.followQuestion'
    : following
      ? 'follow.unfollowUser'
      : 'follow.followUser';

  return (
    <Tooltip title={t(labelKey)}>
      <Button
        size={size}
        icon={icon}
        type={following ? 'default' : 'primary'}
        ghost={!following && !isQuestion}
        loading={isLoading}
        onClick={onClick}
        aria-pressed={following}
      >
        {t(labelKey)}
      </Button>
    </Tooltip>
  );
}
