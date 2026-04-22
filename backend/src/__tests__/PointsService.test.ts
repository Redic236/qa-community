import { sequelize, User, Question, Answer, Vote, PointRecord } from '../models';
import { QuestionService } from '../services/QuestionService';
import { AnswerService } from '../services/AnswerService';
import { VoteService } from '../services/VoteService';
import { POINTS_RULES, POINT_TYPES } from '../utils/constants';
import { VOTE_TARGET_TYPE } from '../models/Vote';

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await PointRecord.destroy({ where: {}, truncate: true });
  await Vote.destroy({ where: {}, truncate: true });
  await Answer.destroy({ where: {}, truncate: true });
  await Question.destroy({ where: {}, truncate: true });
  await User.destroy({ where: {}, truncate: true });
});

async function createUser(username: string, startingPoints = 0): Promise<User> {
  return User.create({
    username,
    email: `${username}@test.com`,
    password: 'hashed',
    points: startingPoints,
  });
}

describe('PointsService - ask question', () => {
  test('deducts 5 points from asker', async () => {
    const asker = await createUser('alice', 50);
    await QuestionService.create({ authorId: asker.id, title: 'Hi', content: 'Q?' });

    await asker.reload();
    expect(asker.points).toBe(50 + POINTS_RULES.ASK_QUESTION);
  });

  test('writes an append-only point_record with correct type and sign', async () => {
    const asker = await createUser('alice', 50);
    const q = await QuestionService.create({ authorId: asker.id, title: 'Hi', content: 'Q?' });

    const records = await PointRecord.findAll({ where: { userId: asker.id } });
    expect(records).toHaveLength(1);
    expect(records[0].type).toBe(POINT_TYPES.ASK);
    expect(records[0].points).toBe(POINTS_RULES.ASK_QUESTION);
    expect(records[0].relatedId).toBe(q.id);
  });

  test('allows negative points for first-time users', async () => {
    const asker = await createUser('alice', 0);
    await QuestionService.create({ authorId: asker.id, title: 'Hi', content: 'Q?' });

    await asker.reload();
    expect(asker.points).toBe(-5);
  });
});

describe('PointsService - answer question', () => {
  test('grants +10 points to answerer', async () => {
    const asker = await createUser('alice', 50);
    const answerer = await createUser('bob', 10);
    const q = await QuestionService.create({ authorId: asker.id, title: 'Hi', content: 'Q?' });

    await AnswerService.create({ authorId: answerer.id, questionId: q.id, content: 'A' });

    await answerer.reload();
    expect(answerer.points).toBe(10 + POINTS_RULES.ANSWER_QUESTION);
  });

  test('increments question.answersCount', async () => {
    const asker = await createUser('alice', 50);
    const answerer = await createUser('bob', 10);
    const q = await QuestionService.create({ authorId: asker.id, title: 'Hi', content: 'Q?' });

    await AnswerService.create({ authorId: answerer.id, questionId: q.id, content: 'A' });

    await q.reload();
    expect(q.answersCount).toBe(1);
  });
});

describe('PointsService - accept answer', () => {
  test('grants +30 to answer author', async () => {
    const asker = await createUser('alice', 50);
    const answerer = await createUser('bob', 10);
    const q = await QuestionService.create({ authorId: asker.id, title: 'Hi', content: 'Q?' });
    const a = await AnswerService.create({ authorId: answerer.id, questionId: q.id, content: 'A' });

    await AnswerService.accept(a.id, asker.id);

    await answerer.reload();
    expect(answerer.points).toBe(10 + POINTS_RULES.ANSWER_QUESTION + POINTS_RULES.ANSWER_ACCEPTED);
  });

  test('marks question as solved', async () => {
    const asker = await createUser('alice', 50);
    const answerer = await createUser('bob', 10);
    const q = await QuestionService.create({ authorId: asker.id, title: 'Hi', content: 'Q?' });
    const a = await AnswerService.create({ authorId: answerer.id, questionId: q.id, content: 'A' });

    await AnswerService.accept(a.id, asker.id);

    await q.reload();
    expect(q.isSolved).toBe(true);
  });

  test('only question author can accept', async () => {
    const asker = await createUser('alice', 50);
    const answerer = await createUser('bob', 10);
    const randomUser = await createUser('eve', 0);
    const q = await QuestionService.create({ authorId: asker.id, title: 'Hi', content: 'Q?' });
    const a = await AnswerService.create({ authorId: answerer.id, questionId: q.id, content: 'A' });

    await expect(AnswerService.accept(a.id, randomUser.id)).rejects.toThrow(/only question author/i);
  });

  test('self-accepted answer (author answers their own question) does not grant points', async () => {
    const asker = await createUser('alice', 50);
    const q = await QuestionService.create({ authorId: asker.id, title: 'Hi', content: 'Q?' });
    const a = await AnswerService.create({ authorId: asker.id, questionId: q.id, content: 'Self-A' });

    const pointsBeforeAccept = (await User.findByPk(asker.id))!.points;
    await AnswerService.accept(a.id, asker.id);

    await asker.reload();
    expect(asker.points).toBe(pointsBeforeAccept);
  });

  test('switching accepted answer: new author gets +30, previous author keeps theirs', async () => {
    const asker = await createUser('alice', 50);
    const answerer1 = await createUser('bob', 0);
    const answerer2 = await createUser('carol', 0);

    const q = await QuestionService.create({ authorId: asker.id, title: 'Hi', content: 'Q?' });
    const a1 = await AnswerService.create({ authorId: answerer1.id, questionId: q.id, content: 'A1' });
    const a2 = await AnswerService.create({ authorId: answerer2.id, questionId: q.id, content: 'A2' });

    await AnswerService.accept(a1.id, asker.id);
    await answerer1.reload();
    const bonus = POINTS_RULES.ANSWER_QUESTION + POINTS_RULES.ANSWER_ACCEPTED;
    expect(answerer1.points).toBe(bonus);

    // Switching acceptance auto-unsets a1 but must NOT reverse a1's bonus.
    await AnswerService.accept(a2.id, asker.id);

    await answerer1.reload();
    await answerer2.reload();
    expect(answerer1.points).toBe(bonus);
    expect(answerer2.points).toBe(bonus);

    const a1Final = await Answer.findByPk(a1.id);
    const a2Final = await Answer.findByPk(a2.id);
    expect(a1Final!.isAccepted).toBe(false);
    expect(a2Final!.isAccepted).toBe(true);
  });
});

describe('PointsService - like question', () => {
  test('grants +5 to question author', async () => {
    const asker = await createUser('alice', 50);
    const liker = await createUser('bob', 0);
    const q = await QuestionService.create({ authorId: asker.id, title: 'Hi', content: 'Q?' });

    await VoteService.toggle({
      userId: liker.id,
      targetType: VOTE_TARGET_TYPE.QUESTION,
      targetId: q.id,
    });

    await asker.reload();
    expect(asker.points).toBe(50 + POINTS_RULES.ASK_QUESTION + POINTS_RULES.QUESTION_LIKED);
  });

  test('unliking reverses the +5 bonus', async () => {
    const asker = await createUser('alice', 50);
    const liker = await createUser('bob', 0);
    const q = await QuestionService.create({ authorId: asker.id, title: 'Hi', content: 'Q?' });

    await VoteService.toggle({
      userId: liker.id,
      targetType: VOTE_TARGET_TYPE.QUESTION,
      targetId: q.id,
    });
    await VoteService.toggle({
      userId: liker.id,
      targetType: VOTE_TARGET_TYPE.QUESTION,
      targetId: q.id,
    });

    await asker.reload();
    expect(asker.points).toBe(50 + POINTS_RULES.ASK_QUESTION);
  });

  test('self-like does not grant points', async () => {
    const asker = await createUser('alice', 50);
    const q = await QuestionService.create({ authorId: asker.id, title: 'Hi', content: 'Q?' });

    const before = (await User.findByPk(asker.id))!.points;
    await VoteService.toggle({
      userId: asker.id,
      targetType: VOTE_TARGET_TYPE.QUESTION,
      targetId: q.id,
    });

    await asker.reload();
    expect(asker.points).toBe(before);
  });
});

describe('PointsService - like answer', () => {
  test('grants +10 to answer author', async () => {
    const asker = await createUser('alice', 50);
    const answerer = await createUser('bob', 10);
    const liker = await createUser('carol', 0);
    const q = await QuestionService.create({ authorId: asker.id, title: 'Hi', content: 'Q?' });
    const a = await AnswerService.create({ authorId: answerer.id, questionId: q.id, content: 'A' });

    await VoteService.toggle({
      userId: liker.id,
      targetType: VOTE_TARGET_TYPE.ANSWER,
      targetId: a.id,
    });

    await answerer.reload();
    expect(answerer.points).toBe(10 + POINTS_RULES.ANSWER_QUESTION + POINTS_RULES.ANSWER_LIKED);
  });
});

describe('PointsService - ledger integrity', () => {
  test('user.points always equals sum of their point_records', async () => {
    const asker = await createUser('alice', 100);
    const answerer = await createUser('bob', 100);
    const liker = await createUser('carol', 100);

    const q = await QuestionService.create({ authorId: asker.id, title: 'Hi', content: 'Q?' });
    const a = await AnswerService.create({ authorId: answerer.id, questionId: q.id, content: 'A' });
    await AnswerService.accept(a.id, asker.id);
    await VoteService.toggle({
      userId: liker.id,
      targetType: VOTE_TARGET_TYPE.QUESTION,
      targetId: q.id,
    });
    await VoteService.toggle({
      userId: liker.id,
      targetType: VOTE_TARGET_TYPE.ANSWER,
      targetId: a.id,
    });

    for (const userId of [asker.id, answerer.id, liker.id]) {
      const user = await User.findByPk(userId);
      const records = await PointRecord.findAll({ where: { userId } });
      const delta = records.reduce((sum, r) => sum + r.points, 0);
      expect(user!.points).toBe(100 + delta);
    }
  });
});
