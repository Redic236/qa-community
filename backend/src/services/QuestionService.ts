import { Op, type Order, type WhereOptions } from 'sequelize';
import { sequelize, Question, Answer, Vote } from '../models';
import { VOTE_TARGET_TYPE } from '../models/Vote';
import { PointsService } from './PointsService';
import { ModerationService } from './ModerationService';
import { CacheService, cacheKeys } from './CacheService';
import { NotificationService, NOTIF } from './NotificationService';
import { ROLES, type Role } from '../utils/constants';
import { ForbiddenError, NotFoundError } from '../utils/errors';

export interface Actor {
  id: number;
  role: Role;
}

function canModify(actor: Actor, authorId: number): boolean {
  return actor.id === authorId || actor.role === ROLES.ADMIN;
}

export interface CreateQuestionInput {
  authorId: number;
  title: string;
  content: string;
  tags?: string[];
}

export type QuestionSort = 'latest' | 'popular' | 'unsolved';

export interface ListQuestionsInput {
  sort: QuestionSort;
  tag?: string;
  q?: string;
  page: number;
  limit: number;
  /** Logged-in viewer; when present each row carries `liked: boolean`. */
  viewerId?: number;
}

export interface QuestionListItem {
  /** Plain JSON shape of the Question row. */
  [k: string]: unknown;
  id: number;
  liked?: boolean;
}

export interface ListQuestionsResult {
  rows: QuestionListItem[];
  total: number;
}

export interface UpdateQuestionInput {
  title?: string;
  content?: string;
  tags?: string[];
}

export class QuestionService {
  static async create(input: CreateQuestionInput): Promise<Question> {
    ModerationService.assertClean({ title: input.title, content: input.content });

    return sequelize.transaction(async (t) => {
      const question = await Question.create(
        {
          title: input.title,
          content: input.content,
          tags: input.tags ?? [],
          authorId: input.authorId,
        },
        { transaction: t }
      );

      await PointsService.forAskQuestion(input.authorId, question.id, t);

      return question;
    });
  }

  static async list(input: ListQuestionsInput): Promise<ListQuestionsResult> {
    const conditions: WhereOptions[] = [];
    const order: Order = [];

    if (input.sort === 'unsolved') {
      conditions.push({ isSolved: false });
      order.push(['createdAt', 'DESC']);
    } else if (input.sort === 'popular') {
      order.push(['votes', 'DESC'], ['createdAt', 'DESC']);
    } else {
      order.push(['createdAt', 'DESC']);
    }

    if (input.tag) {
      // Tags are normalized to lowercase on creation; lowercase the query too so
      // ?tag=Cooking matches stored "cooking". Quoted substring prevents prefix
      // collisions ("java" won't match "javascript").
      conditions.push({
        tags: { [Op.substring]: `"${input.tag.toLowerCase()}"` },
      });
    }

    const needle = input.q?.trim();
    if (needle) {
      // Keyword search over title + content. LIKE is case-insensitive under
      // MySQL utf8mb4_unicode_ci and SQLite ASCII LIKE.
      conditions.push({
        [Op.or]: [
          { title: { [Op.substring]: needle } },
          { content: { [Op.substring]: needle } },
        ],
      });
    }

    const where: WhereOptions =
      conditions.length === 0 ? {} : { [Op.and]: conditions };

    const { rows, count } = await Question.findAndCountAll({
      where,
      order,
      limit: input.limit,
      offset: (input.page - 1) * input.limit,
    });

    // Layer per-viewer `liked` onto each row so the list UI can render the
    // correct icon state without a follow-up round trip per card. One Vote
    // query batches all current-page IDs.
    const items: QuestionListItem[] = rows.map((r) => r.toJSON() as QuestionListItem);
    if (input.viewerId && items.length > 0) {
      const ids = items.map((r) => r.id);
      const liked = await Vote.findAll({
        where: {
          userId: input.viewerId,
          targetType: VOTE_TARGET_TYPE.QUESTION,
          targetId: { [Op.in]: ids },
        },
        attributes: ['targetId'],
      });
      const likedSet = new Set(liked.map((v) => v.targetId));
      for (const item of items) item.liked = likedSet.has(item.id);
    } else {
      // Anonymous viewers always get `liked: false` so the field's presence is
      // stable and the frontend doesn't need optional chaining everywhere.
      for (const item of items) item.liked = false;
    }

    return { rows: items, total: count };
  }

  static async update(
    id: number,
    actingUserId: number,
    input: UpdateQuestionInput
  ): Promise<Question> {
    ModerationService.assertClean({ title: input.title, content: input.content });

    const question = await Question.findByPk(id);
    if (!question) throw new NotFoundError('Question not found', 'questionNotFound');
    if (question.authorId !== actingUserId) {
      throw new ForbiddenError('Only the question author can edit', 'onlyQuestionAuthorEdit');
    }

    if (input.title !== undefined) question.title = input.title;
    if (input.content !== undefined) question.content = input.content;
    if (input.tags !== undefined) {
      question.tags = input.tags.map((t) => t.toLowerCase());
    }

    await question.save();
    await CacheService.del(cacheKeys.questionDetail(id));
    return question;
  }

  static async delete(id: number, actor: Actor): Promise<void> {
    let originalAuthorId: number | null = null;
    await sequelize.transaction(async (t) => {
      const question = await Question.findByPk(id, { transaction: t });
      if (!question) throw new NotFoundError('Question not found', 'questionNotFound');
      if (!canModify(actor, question.authorId)) {
        throw new ForbiddenError(
          'Only the question author or an admin can delete',
          'onlyQuestionAuthorOrAdminDelete'
        );
      }
      originalAuthorId = question.authorId;

      // Votes have FK on user_id only — target_id won't cascade. Clean up
      // explicitly, including votes on answers (which themselves cascade via FK).
      const answers = await Answer.findAll({
        where: { questionId: id },
        attributes: ['id'],
        transaction: t,
      });
      const answerIds = answers.map((a) => a.id);
      const orConditions: WhereOptions[] = [
        { targetType: VOTE_TARGET_TYPE.QUESTION, targetId: id },
      ];
      if (answerIds.length > 0) {
        orConditions.push({
          targetType: VOTE_TARGET_TYPE.ANSWER,
          targetId: { [Op.in]: answerIds },
        });
      }
      await Vote.destroy({ where: { [Op.or]: orConditions }, transaction: t });

      // Question delete cascades to answers via FK CASCADE.
      // point_records are intentionally preserved as an audit trail —
      // deletion is not a points-changing event (consistent with not reversing
      // ask penalty / answer / accept / like bonuses elsewhere).
      await question.destroy({ transaction: t });
    });
    await CacheService.del(cacheKeys.questionDetail(id));
    if (actor.role === ROLES.ADMIN && originalAuthorId !== null && originalAuthorId !== actor.id) {
      await NotificationService.notifyExceptSelf(
        originalAuthorId,
        actor.id,
        NOTIF.CONTENT_REMOVED,
        { targetType: 'question', targetId: id }
      );
    }
  }
}
