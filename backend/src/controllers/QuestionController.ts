import { Op, type WhereOptions } from 'sequelize';
import { QuestionService } from '../services/QuestionService';
import { Question, Answer, Vote, Comment } from '../models';
import { VOTE_TARGET_TYPE } from '../models/Vote';
import { ROLES } from '../utils/constants';
import { NotFoundError, UnauthorizedError } from '../utils/errors';
import { asyncHandler } from '../middleware/asyncHandler';
import { listQuestionsSchema, updateQuestionSchema } from '../schemas/question';
import { CacheService, cacheKeys } from '../services/CacheService';

const QUESTION_DETAIL_TTL_SECONDS = 60;

export const create = asyncHandler(async (req, res) => {
  if (!req.userId) throw new UnauthorizedError();
  const question = await QuestionService.create({
    authorId: req.userId,
    title: req.body.title,
    content: req.body.content,
    tags: req.body.tags,
  });
  res.status(201).json({ success: true, data: question });
});

export const list = asyncHandler(async (req, res) => {
  const opts = listQuestionsSchema.parse(req.query);
  const { rows, total } = await QuestionService.list({
    sort: opts.sort,
    tag: opts.tag,
    q: opts.q,
    page: opts.page,
    limit: opts.limit,
    viewerId: req.userId,
  });
  res.json({
    success: true,
    data: rows,
    meta: { total, page: opts.page, limit: opts.limit },
  });
});

export const update = asyncHandler(async (req, res) => {
  if (!req.userId) throw new UnauthorizedError();
  const id = Number(req.params.id);
  const body = updateQuestionSchema.parse(req.body);
  const question = await QuestionService.update(id, req.userId, body);
  res.json({ success: true, data: question });
});

export const remove = asyncHandler(async (req, res) => {
  if (!req.userId) throw new UnauthorizedError();
  const id = Number(req.params.id);
  await QuestionService.delete(id, { id: req.userId, role: req.userRole ?? ROLES.USER });
  res.json({ success: true, data: { id } });
});

interface CommentJson {
  id: number;
  [k: string]: unknown;
}
interface AnswerJson {
  id: number;
  comments?: CommentJson[];
  [k: string]: unknown;
}
interface QuestionDetailBase {
  id: number;
  answers: AnswerJson[];
  comments?: CommentJson[];
  [k: string]: unknown;
}

/**
 * Build the user-agnostic detail shape (question + sorted answers + nested
 * comments, no `liked`). On cache hit this avoids hitting MySQL entirely;
 * per-user `liked` is layered on after.
 */
async function loadBaseDetail(id: number): Promise<QuestionDetailBase | null> {
  const cacheKey = cacheKeys.questionDetail(id);
  const cached = await CacheService.get<QuestionDetailBase>(cacheKey);
  if (cached) return cached;

  const question = await Question.findByPk(id);
  if (!question) return null;
  const answers = await Answer.findAll({
    where: { questionId: id },
    order: [
      ['isAccepted', 'DESC'],
      ['votes', 'DESC'],
      ['createdAt', 'ASC'],
    ],
  });

  // One round-trip for ALL comments on this question + its answers, then
  // bucket them in memory.
  const answerIds = answers.map((a) => a.id);
  const commentRows = await Comment.findAll({
    where: {
      [Op.or]: [
        { targetType: VOTE_TARGET_TYPE.QUESTION, targetId: id },
        ...(answerIds.length > 0
          ? [{ targetType: VOTE_TARGET_TYPE.ANSWER, targetId: { [Op.in]: answerIds } }]
          : []),
      ],
    },
    order: [['createdAt', 'ASC']],
  });

  const questionComments: CommentJson[] = [];
  const answerComments = new Map<number, CommentJson[]>();
  for (const c of commentRows) {
    const json = c.toJSON() as CommentJson;
    if (c.targetType === VOTE_TARGET_TYPE.QUESTION) {
      questionComments.push(json);
    } else {
      const arr = answerComments.get(c.targetId) ?? [];
      arr.push(json);
      answerComments.set(c.targetId, arr);
    }
  }

  const base: QuestionDetailBase = {
    ...question.toJSON(),
    id: question.id,
    comments: questionComments,
    answers: answers.map((a) => ({
      ...(a.toJSON() as AnswerJson),
      comments: answerComments.get(a.id) ?? [],
    })),
  };
  await CacheService.set(cacheKey, base, QUESTION_DETAIL_TTL_SECONDS);
  return base;
}

export const getById = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const base = await loadBaseDetail(id);
  if (!base) throw new NotFoundError('Question not found', 'questionNotFound');

  if (!req.userId) {
    res.json({ success: true, data: base });
    return;
  }

  const answerIds = base.answers.map((a) => a.id);
  const orConditions: WhereOptions[] = [
    { targetType: VOTE_TARGET_TYPE.QUESTION, targetId: id },
  ];
  if (answerIds.length > 0) {
    orConditions.push({
      targetType: VOTE_TARGET_TYPE.ANSWER,
      targetId: { [Op.in]: answerIds },
    });
  }
  const votes = await Vote.findAll({
    where: { userId: req.userId, [Op.or]: orConditions },
  });

  let likedQuestion = false;
  const likedAnswerIds = new Set<number>();
  for (const v of votes) {
    if (v.targetType === VOTE_TARGET_TYPE.QUESTION) likedQuestion = true;
    else likedAnswerIds.add(v.targetId);
  }

  res.json({
    success: true,
    data: {
      ...base,
      liked: likedQuestion,
      answers: base.answers.map((a) => ({ ...a, liked: likedAnswerIds.has(a.id) })),
    },
  });
});
