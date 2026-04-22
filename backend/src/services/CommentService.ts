import { sequelize, Comment, Question, Answer } from '../models';
import { VOTE_TARGET_TYPE, type VoteTargetType } from '../models/Vote';
import { ModerationService } from './ModerationService';
import { CacheService, cacheKeys } from './CacheService';
import { ROLES, type Role } from '../utils/constants';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';

export interface CreateCommentInput {
  authorId: number;
  targetType: VoteTargetType;
  targetId: number;
  content: string;
  /** When set, creates a 1-deep reply. Must point at a root comment on the same target. */
  parentId?: number;
}

export interface Actor {
  id: number;
  role: Role;
}

async function resolveQuestionId(
  targetType: VoteTargetType,
  targetId: number
): Promise<number | null> {
  if (targetType === VOTE_TARGET_TYPE.QUESTION) {
    const q = await Question.findByPk(targetId, { attributes: ['id'] });
    return q ? q.id : null;
  }
  const a = await Answer.findByPk(targetId, { attributes: ['questionId'] });
  return a ? a.questionId : null;
}

export class CommentService {
  static async create(input: CreateCommentInput): Promise<Comment> {
    ModerationService.assertClean({ content: input.content });

    const questionId = await resolveQuestionId(input.targetType, input.targetId);
    if (questionId === null) {
      throw new NotFoundError(`${input.targetType} not found`, 'targetNotFound', {
        targetType: input.targetType,
      });
    }

    // Reply validation: parent must exist, live on the same target, AND be a
    // root (2-level cap — keeps renderer simple, prevents nesting spiraling
    // into unreadable threads).
    if (input.parentId !== undefined) {
      const parent = await Comment.findByPk(input.parentId);
      if (!parent) {
        throw new NotFoundError('Comment not found', 'commentNotFound');
      }
      if (parent.targetType !== input.targetType || parent.targetId !== input.targetId) {
        throw new BadRequestError(
          'Reply must target the same comment thread',
          'commentReplyTargetMismatch'
        );
      }
      if (parent.parentId !== null) {
        throw new BadRequestError(
          'Nested replies are limited to one level deep',
          'commentReplyTooDeep'
        );
      }
    }

    const comment = await Comment.create({
      content: input.content,
      targetType: input.targetType,
      targetId: input.targetId,
      authorId: input.authorId,
      parentId: input.parentId ?? null,
    });

    // Comments live inside the cached question detail payload — drop the cache.
    await CacheService.del(cacheKeys.questionDetail(questionId));
    return comment;
  }

  static async delete(id: number, actor: Actor): Promise<void> {
    // Wrap load → authz → cascade → delete in one transaction so a concurrent
    // edit / delete / reparent can't shear the flow. Previous version loaded
    // the comment + resolved questionId outside the tx, which left a window
    // where the row could be mutated between the check and the destroy.
    const questionId = await sequelize.transaction(async (t) => {
      const comment = await Comment.findByPk(id, { transaction: t });
      if (!comment) throw new NotFoundError('Comment not found', 'commentNotFound');
      if (comment.authorId !== actor.id && actor.role !== ROLES.ADMIN) {
        throw new ForbiddenError(
          'Only the comment author or an admin can delete',
          'onlyCommentAuthorOrAdminDelete'
        );
      }
      const qId = await resolveQuestionId(comment.targetType, comment.targetId);
      // Explicit cascade at the service layer rather than relying on FK
      // behavior — keeps SQLite tests and MySQL prod consistent regardless
      // of foreign_keys pragmas. Only root deletions fan out.
      if (comment.parentId === null) {
        await Comment.destroy({ where: { parentId: id }, transaction: t });
      }
      await comment.destroy({ transaction: t });
      return qId;
    });
    if (questionId !== null) {
      await CacheService.del(cacheKeys.questionDetail(questionId));
    }
  }
}
