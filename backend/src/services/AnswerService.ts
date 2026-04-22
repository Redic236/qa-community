import { sequelize, Answer, Question, Vote } from '../models';
import { VOTE_TARGET_TYPE } from '../models/Vote';
import { PointsService } from './PointsService';
import { ModerationService } from './ModerationService';
import { CacheService, cacheKeys } from './CacheService';
import { NotificationService, NOTIF } from './NotificationService';
import { FollowService } from './FollowService';
import { AchievementService } from './AchievementService';
import { FOLLOW_TARGET_TYPE } from '../models/Follow';
import { ROLES, type Role } from '../utils/constants';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/errors';

export interface Actor {
  id: number;
  role: Role;
}

function canModify(actor: Actor, authorId: number): boolean {
  return actor.id === authorId || actor.role === ROLES.ADMIN;
}

export interface UpdateAnswerInput {
  content: string;
}

export interface CreateAnswerInput {
  authorId: number;
  questionId: number;
  content: string;
}

export class AnswerService {
  static async create(input: CreateAnswerInput): Promise<Answer> {
    ModerationService.assertClean({ content: input.content });

    const result = await sequelize.transaction(async (t) => {
      const question = await Question.findByPk(input.questionId, { transaction: t });
      if (!question) throw new NotFoundError('Question not found', 'questionNotFound');

      const created = await Answer.create(
        {
          content: input.content,
          questionId: input.questionId,
          authorId: input.authorId,
        },
        { transaction: t }
      );

      await question.increment('answersCount', { transaction: t });
      await PointsService.forAnswer(input.authorId, created.id, t);

      return { answer: created, questionAuthorId: question.authorId };
    });

    await CacheService.del(cacheKeys.questionDetail(input.questionId));
    await NotificationService.notifyExceptSelf(
      result.questionAuthorId,
      input.authorId,
      NOTIF.QUESTION_ANSWERED,
      { questionId: input.questionId, answerId: result.answer.id, fromUserId: input.authorId }
    );

    // Achievement checks for the answerer (first_answer, prolific_answerer,
    // points ladder crossings). Fire-and-forget after commit.
    void AchievementService.checkAndGrant(input.authorId, 'answer.create');
    void AchievementService.checkAndGrant(input.authorId, 'points.award');

    // Fan-out to question followers (excluding the asker — they got the direct
    // question_answered notification already, and the answerer themselves).
    void (async () => {
      try {
        const followerIds = await FollowService.followerIdsOf(
          FOLLOW_TARGET_TYPE.QUESTION,
          input.questionId
        );
        for (const userId of followerIds) {
          if (userId === input.authorId) continue;
          if (userId === result.questionAuthorId) continue;
          await NotificationService.notify({
            userId,
            type: NOTIF.FOLLOWED_QUESTION_ANSWERED,
            payload: {
              questionId: input.questionId,
              answerId: result.answer.id,
              fromUserId: input.authorId,
            },
          });
        }
      } catch (err) {
        console.warn('[follow-fanout] answer create:', (err as Error).message);
      }
    })();

    return result.answer;
  }

  static async accept(answerId: number, actingUserId: number): Promise<Answer> {
    const answer = await sequelize.transaction(async (t) => {
      const found = await Answer.findByPk(answerId, { transaction: t });
      if (!found) throw new NotFoundError('Answer not found', 'answerNotFound');
      if (found.isAccepted) throw new ConflictError('Answer already accepted', 'answerAlreadyAccepted');

      const question = await Question.findByPk(found.questionId, { transaction: t });
      if (!question) throw new NotFoundError('Question not found', 'questionNotFound');
      if (question.authorId !== actingUserId) {
        throw new ForbiddenError('Only question author can accept', 'onlyQuestionAuthorAccept');
      }

      // Switching acceptance: unset previously accepted answers for this question,
      // but keep their +30 bonus — once awarded, acceptance points are permanent.
      await Answer.update(
        { isAccepted: false },
        { where: { questionId: question.id, isAccepted: true }, transaction: t }
      );

      found.isAccepted = true;
      await found.save({ transaction: t });

      question.isSolved = true;
      await question.save({ transaction: t });

      if (found.authorId !== question.authorId) {
        await PointsService.forAccepted(found.authorId, found.id, t);
      }

      return found;
    });

    await CacheService.del(cacheKeys.questionDetail(answer.questionId));
    await NotificationService.notifyExceptSelf(
      answer.authorId,
      actingUserId,
      NOTIF.ANSWER_ACCEPTED,
      { questionId: answer.questionId, answerId: answer.id }
    );

    // Answer author's acceptance count + point bonus may each unlock badges.
    void AchievementService.checkAndGrant(answer.authorId, 'answer.accept');
    void AchievementService.checkAndGrant(answer.authorId, 'points.award');

    return answer;
  }

  static async unaccept(answerId: number, actingUserId: number): Promise<Answer> {
    const answer = await sequelize.transaction(async (t) => {
      const found = await Answer.findByPk(answerId, { transaction: t });
      if (!found) throw new NotFoundError('Answer not found', 'answerNotFound');
      if (!found.isAccepted) throw new ConflictError('Answer is not accepted', 'answerNotAccepted');

      const question = await Question.findByPk(found.questionId, { transaction: t });
      if (!question) throw new NotFoundError('Question not found', 'questionNotFound');
      if (question.authorId !== actingUserId) {
        throw new ForbiddenError('Only question author can unaccept', 'onlyQuestionAuthorUnaccept');
      }

      // Per product decision: keep the +30 acceptance bonus permanently — same as
      // when the asker switches to a different accepted answer.
      found.isAccepted = false;
      await found.save({ transaction: t });

      // No accepted answer left for this question → mark unsolved.
      question.isSolved = false;
      await question.save({ transaction: t });

      return found;
    });

    await CacheService.del(cacheKeys.questionDetail(answer.questionId));
    return answer;
  }

  static async update(
    id: number,
    actingUserId: number,
    input: UpdateAnswerInput
  ): Promise<Answer> {
    ModerationService.assertClean({ content: input.content });

    const answer = await Answer.findByPk(id);
    if (!answer) throw new NotFoundError('Answer not found', 'answerNotFound');
    if (answer.authorId !== actingUserId) {
      throw new ForbiddenError('Only the answer author can edit', 'onlyAnswerAuthorEdit');
    }
    answer.content = input.content;
    await answer.save();
    await CacheService.del(cacheKeys.questionDetail(answer.questionId));
    return answer;
  }

  static async delete(id: number, actor: Actor): Promise<void> {
    const result = await sequelize.transaction(async (t) => {
      const answer = await Answer.findByPk(id, { transaction: t });
      if (!answer) throw new NotFoundError('Answer not found', 'answerNotFound');
      if (!canModify(actor, answer.authorId)) {
        throw new ForbiddenError(
          'Only the answer author or an admin can delete',
          'onlyAnswerAuthorOrAdminDelete'
        );
      }

      const wasAccepted = answer.isAccepted;
      const qId = answer.questionId;
      const authorId = answer.authorId;

      await Vote.destroy({
        where: { targetType: VOTE_TARGET_TYPE.ANSWER, targetId: id },
        transaction: t,
      });

      await answer.destroy({ transaction: t });

      await Question.decrement('answersCount', { where: { id: qId }, transaction: t });

      if (wasAccepted) {
        await Question.update(
          { isSolved: false },
          { where: { id: qId }, transaction: t }
        );
      }
      // Bonus points (+10 answer / +30 accept / +10 like) are intentionally
      // NOT reversed — consistent with the rest of the system's "bonuses are
      // permanent" rule.
      return { questionId: qId, authorId };
    });

    await CacheService.del(cacheKeys.questionDetail(result.questionId));
    // Admin-driven removal? Notify the original author so they know.
    if (actor.role === ROLES.ADMIN && actor.id !== result.authorId) {
      await NotificationService.notifyExceptSelf(
        result.authorId,
        actor.id,
        NOTIF.CONTENT_REMOVED,
        { targetType: 'answer', targetId: id, questionId: result.questionId }
      );
    }
  }
}
