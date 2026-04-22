import type { Transaction } from 'sequelize';
import { sequelize, Vote, Question, Answer } from '../models';
import { VOTE_TARGET_TYPE, type VoteTargetType } from '../models/Vote';
import { PointsService } from './PointsService';
import { CacheService, cacheKeys } from './CacheService';
import { NotificationService, NOTIF } from './NotificationService';
import { AchievementService } from './AchievementService';
import { NotFoundError } from '../utils/errors';

export interface ToggleVoteInput {
  userId: number;
  targetType: VoteTargetType;
  targetId: number;
}

export interface ToggleVoteResult {
  liked: boolean;
  votes: number;
}

interface Target {
  authorId: number;
  votes: number;
  /** For an Answer target, the parent question — needed for cache invalidation. */
  questionId?: number;
}

async function loadTarget(
  targetType: VoteTargetType,
  targetId: number,
  transaction: Transaction
): Promise<Target | null> {
  if (targetType === VOTE_TARGET_TYPE.QUESTION) {
    const q = await Question.findByPk(targetId, { transaction });
    return q ? { authorId: q.authorId, votes: q.votes, questionId: q.id } : null;
  }
  const a = await Answer.findByPk(targetId, { transaction });
  return a ? { authorId: a.authorId, votes: a.votes, questionId: a.questionId } : null;
}

async function adjustVotes(
  targetType: VoteTargetType,
  targetId: number,
  delta: 1 | -1,
  transaction: Transaction
): Promise<void> {
  const where = { id: targetId };
  if (targetType === VOTE_TARGET_TYPE.QUESTION) {
    if (delta > 0) {
      await Question.increment('votes', { where, transaction });
    } else {
      await Question.decrement('votes', { where, transaction });
    }
  } else {
    if (delta > 0) {
      await Answer.increment('votes', { where, transaction });
    } else {
      await Answer.decrement('votes', { where, transaction });
    }
  }
}

export class VoteService {
  static async toggle(input: ToggleVoteInput): Promise<ToggleVoteResult> {
    const result = await sequelize.transaction(async (t) => {
      const target = await loadTarget(input.targetType, input.targetId, t);
      if (!target) {
        throw new NotFoundError(`${input.targetType} not found`, 'targetNotFound', {
          targetType: input.targetType,
        });
      }

      const { authorId } = target;
      const isSelf = authorId === input.userId;
      const isQuestion = input.targetType === VOTE_TARGET_TYPE.QUESTION;

      const existing = await Vote.findOne({
        where: {
          userId: input.userId,
          targetType: input.targetType,
          targetId: input.targetId,
        },
        transaction: t,
      });

      if (existing) {
        await existing.destroy({ transaction: t });
        await adjustVotes(input.targetType, input.targetId, -1, t);
        if (!isSelf) {
          await (isQuestion
            ? PointsService.forQuestionUnliked(authorId, input.targetId, t)
            : PointsService.forAnswerUnliked(authorId, input.targetId, t));
        }
      } else {
        await Vote.create(
          {
            userId: input.userId,
            targetType: input.targetType,
            targetId: input.targetId,
          },
          { transaction: t }
        );
        await adjustVotes(input.targetType, input.targetId, 1, t);
        if (!isSelf) {
          await (isQuestion
            ? PointsService.forQuestionLiked(authorId, input.targetId, t)
            : PointsService.forAnswerLiked(authorId, input.targetId, t));
        }
      }

      const updated = await loadTarget(input.targetType, input.targetId, t);
      return {
        liked: !existing,
        votes: updated?.votes ?? 0,
        // Carry data out of the tx so we can fan-out side effects post-commit.
        questionId: target.questionId ?? null,
        authorId,
        wasNewLike: !existing,
      };
    });

    if (result.questionId !== null) {
      await CacheService.del(cacheKeys.questionDetail(result.questionId));
    }

    // Notify on new likes only — un-likes shouldn't generate noise.
    if (result.wasNewLike && result.authorId !== input.userId) {
      const isQ = input.targetType === VOTE_TARGET_TYPE.QUESTION;
      await NotificationService.notifyExceptSelf(
        result.authorId,
        input.userId,
        isQ ? NOTIF.QUESTION_LIKED : NOTIF.ANSWER_LIKED,
        isQ
          ? { questionId: input.targetId, fromUserId: input.userId }
          : {
              answerId: input.targetId,
              questionId: result.questionId,
              fromUserId: input.userId,
            }
      );

      // Content author may have just crossed a likes-received threshold. Also
      // check points ladder since liking grants +5 to the author.
      void AchievementService.checkAndGrant(result.authorId, 'vote.like');
      void AchievementService.checkAndGrant(result.authorId, 'points.award');
    }

    return { liked: result.liked, votes: result.votes };
  }
}
