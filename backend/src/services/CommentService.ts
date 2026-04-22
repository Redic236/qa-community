import { Comment, Question, Answer } from '../models';
import { VOTE_TARGET_TYPE, type VoteTargetType } from '../models/Vote';
import { ModerationService } from './ModerationService';
import { CacheService, cacheKeys } from './CacheService';
import { ROLES, type Role } from '../utils/constants';
import { ForbiddenError, NotFoundError } from '../utils/errors';

export interface CreateCommentInput {
  authorId: number;
  targetType: VoteTargetType;
  targetId: number;
  content: string;
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

    const comment = await Comment.create({
      content: input.content,
      targetType: input.targetType,
      targetId: input.targetId,
      authorId: input.authorId,
    });

    // Comments live inside the cached question detail payload — drop the cache.
    await CacheService.del(cacheKeys.questionDetail(questionId));
    return comment;
  }

  static async delete(id: number, actor: Actor): Promise<void> {
    const comment = await Comment.findByPk(id);
    if (!comment) throw new NotFoundError('Comment not found', 'commentNotFound');
    if (comment.authorId !== actor.id && actor.role !== ROLES.ADMIN) {
      throw new ForbiddenError(
        'Only the comment author or an admin can delete',
        'onlyCommentAuthorOrAdminDelete'
      );
    }
    const questionId = await resolveQuestionId(comment.targetType, comment.targetId);
    await comment.destroy();
    if (questionId !== null) {
      await CacheService.del(cacheKeys.questionDetail(questionId));
    }
  }
}
