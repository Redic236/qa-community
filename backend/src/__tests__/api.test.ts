import request from 'supertest';
import { app } from '../app';
import { sequelize, User, Question, Answer, Vote, PointRecord, Report, Comment, Notification } from '../models';
import { ROLES } from '../utils/constants';
import { POINTS_RULES } from '../utils/constants';
import { VOTE_TARGET_TYPE } from '../models/Vote';

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await Notification.destroy({ where: {}, truncate: true });
  await Comment.destroy({ where: {}, truncate: true });
  await Report.destroy({ where: {}, truncate: true });
  await PointRecord.destroy({ where: {}, truncate: true });
  await Vote.destroy({ where: {}, truncate: true });
  await Answer.destroy({ where: {}, truncate: true });
  await Question.destroy({ where: {}, truncate: true });
  await User.destroy({ where: {}, truncate: true });
});

async function registerUser(username: string): Promise<{ token: string; id: number }> {
  const res = await request(app).post('/api/auth/register').send({
    username,
    email: `${username}@test.com`,
    password: 'secret123',
  });
  expect(res.status).toBe(201);
  return { token: res.body.data.token, id: res.body.data.user.id };
}

async function registerAdmin(
  username: string
): Promise<{ token: string; id: number }> {
  const u = await registerUser(username);
  await User.update({ role: ROLES.ADMIN }, { where: { id: u.id } });
  // Re-login to mint a fresh JWT carrying the admin claim.
  const res = await request(app).post('/api/auth/login').send({
    email: `${username}@test.com`,
    password: 'secret123',
  });
  expect(res.status).toBe(200);
  return { token: res.body.data.token, id: u.id };
}

describe('POST /api/auth/register', () => {
  test('creates a user and returns token', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: 'alice',
      email: 'alice@test.com',
      password: 'secret123',
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('alice@test.com');
    expect(res.body.data.user).not.toHaveProperty('password');
    expect(typeof res.body.data.token).toBe('string');
  });

  test('rejects duplicate email', async () => {
    await registerUser('alice');
    const res = await request(app).post('/api/auth/register').send({
      username: 'alice2',
      email: 'alice@test.com',
      password: 'secret123',
    });
    expect(res.status).toBe(400);
  });

  test('rejects invalid payload', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: 'ab',
      email: 'not-an-email',
      password: '123',
    });
    expect(res.status).toBe(400);
    expect(res.body.details).toBeDefined();
  });
});

describe('POST /api/auth/login', () => {
  test('returns token on valid credentials', async () => {
    await registerUser('alice');
    const res = await request(app).post('/api/auth/login').send({
      email: 'alice@test.com',
      password: 'secret123',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
  });

  test('401 on wrong password', async () => {
    await registerUser('alice');
    const res = await request(app).post('/api/auth/login').send({
      email: 'alice@test.com',
      password: 'wrong-password',
    });
    expect(res.status).toBe(401);
  });
});

describe('auth middleware', () => {
  test('rejects request without bearer token', async () => {
    const res = await request(app)
      .post('/api/questions')
      .send({ title: 'Hello world title', content: 'Question content here' });
    expect(res.status).toBe(401);
  });

  test('rejects malformed token', async () => {
    const res = await request(app)
      .post('/api/questions')
      .set('Authorization', 'Bearer not-a-real-token')
      .send({ title: 'Hello world title', content: 'Question content here' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/questions — points integration', () => {
  test('creates question and deducts 5 points from author', async () => {
    const { token, id } = await registerUser('alice');
    const res = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'How do I cook rice?',
        content: 'I have tried many ways but none seem to work.',
        tags: ['cooking'],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();

    const user = await User.findByPk(id);
    expect(user!.points).toBe(POINTS_RULES.ASK_QUESTION); // -5
  });

  test('422-like validation error for short title', async () => {
    const { token } = await registerUser('alice');
    const res = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'hi', content: 'too short title above' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/questions/:id/answers — points integration', () => {
  test('creates answer and grants +10 to answerer', async () => {
    const asker = await registerUser('alice');
    const answerer = await registerUser('bob');

    const qRes = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ title: 'Some question title', content: 'Some question content here' });

    const aRes = await request(app)
      .post(`/api/questions/${qRes.body.data.id}/answers`)
      .set('Authorization', `Bearer ${answerer.token}`)
      .send({ content: 'This is my answer to the question.' });

    expect(aRes.status).toBe(201);
    const bob = await User.findByPk(answerer.id);
    expect(bob!.points).toBe(POINTS_RULES.ANSWER_QUESTION); // +10
  });
});

describe('POST /api/answers/:id/accept — points integration', () => {
  test('accepting grants +30 to answer author', async () => {
    const asker = await registerUser('alice');
    const answerer = await registerUser('bob');

    const qRes = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ title: 'Some question title', content: 'Some question content here' });

    const aRes = await request(app)
      .post(`/api/questions/${qRes.body.data.id}/answers`)
      .set('Authorization', `Bearer ${answerer.token}`)
      .send({ content: 'This is my answer to the question.' });

    const acceptRes = await request(app)
      .post(`/api/answers/${aRes.body.data.id}/accept`)
      .set('Authorization', `Bearer ${asker.token}`);

    expect(acceptRes.status).toBe(200);
    const bob = await User.findByPk(answerer.id);
    expect(bob!.points).toBe(POINTS_RULES.ANSWER_QUESTION + POINTS_RULES.ANSWER_ACCEPTED); // 40
  });

  test('403 when non-author tries to accept', async () => {
    const asker = await registerUser('alice');
    const answerer = await registerUser('bob');
    const intruder = await registerUser('eve');

    const qRes = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ title: 'Some question title', content: 'Some question content here' });

    const aRes = await request(app)
      .post(`/api/questions/${qRes.body.data.id}/answers`)
      .set('Authorization', `Bearer ${answerer.token}`)
      .send({ content: 'This is my answer to the question.' });

    const acceptRes = await request(app)
      .post(`/api/answers/${aRes.body.data.id}/accept`)
      .set('Authorization', `Bearer ${intruder.token}`);

    expect(acceptRes.status).toBe(403);
  });
});

describe('GET /api/questions — ETag / Cache-Control', () => {
  test('responds with Cache-Control + Vary + ETag', async () => {
    const { token } = await registerUser('etag_seed');
    await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Etag seed title', content: 'Etag seed content body.' });

    const res = await request(app).get('/api/questions');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('private, max-age=0, must-revalidate');
    expect(res.headers['vary']).toContain('Authorization');
    expect(res.headers['vary']).toContain('Accept-Language');
    expect(res.headers['etag']).toMatch(/^W\//);
  });

  test('matching If-None-Match returns 304 with empty body', async () => {
    const first = await request(app).get('/api/questions');
    expect(first.status).toBe(200);
    const etag = first.headers['etag'];
    expect(etag).toBeTruthy();

    const second = await request(app)
      .get('/api/questions')
      .set('If-None-Match', etag);
    expect(second.status).toBe(304);
    // Per HTTP spec a 304 has no body — supertest exposes that as empty.
    expect(second.text).toBeFalsy();
  });

  test('different viewers get different ETags (Vary on Authorization)', async () => {
    // Two viewers both seeing the same question; alice has liked it, bob has not.
    const asker = await registerUser('etag_asker');
    const alice = await registerUser('etag_alice');
    const bob = await registerUser('etag_bob');
    const q = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ title: 'Etag vary title', content: 'Etag vary content.' });
    await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ targetType: 'question', targetId: q.body.data.id });

    const aliceRes = await request(app)
      .get('/api/questions')
      .set('Authorization', `Bearer ${alice.token}`);
    const bobRes = await request(app)
      .get('/api/questions')
      .set('Authorization', `Bearer ${bob.token}`);
    expect(aliceRes.headers['etag']).toBeTruthy();
    expect(bobRes.headers['etag']).toBeTruthy();
    expect(aliceRes.headers['etag']).not.toBe(bobRes.headers['etag']);
  });

  test('ETag changes after a like toggles `liked`', async () => {
    const asker = await registerUser('etag_change_asker');
    const liker = await registerUser('etag_change_liker');
    const q = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ title: 'Etag change title', content: 'Etag change content.' });

    const before = await request(app)
      .get('/api/questions')
      .set('Authorization', `Bearer ${liker.token}`);
    const beforeEtag = before.headers['etag'];

    await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${liker.token}`)
      .send({ targetType: 'question', targetId: q.body.data.id });

    const after = await request(app)
      .get('/api/questions')
      .set('Authorization', `Bearer ${liker.token}`);
    expect(after.headers['etag']).not.toBe(beforeEtag);

    // The previously cached ETag must now miss → server sends 200 fresh body.
    const stale = await request(app)
      .get('/api/questions')
      .set('Authorization', `Bearer ${liker.token}`)
      .set('If-None-Match', beforeEtag);
    expect(stale.status).toBe(200);
  });
});

describe('GET /api/questions — liked field', () => {
  test('anonymous list: every row has liked=false', async () => {
    const { token } = await registerUser('seeder');
    await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'A safe title here', content: 'A safe content body.' });

    const res = await request(app).get('/api/questions');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const q of res.body.data) expect(q.liked).toBe(false);
  });

  test('authed list: liked=true only on questions the viewer has voted', async () => {
    const asker = await registerUser('asker_l');
    const viewer = await registerUser('viewer_l');

    const liked = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ title: 'Liked one title here', content: 'Liked one body content.' });
    const unliked = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ title: 'Unliked one title', content: 'Unliked one body content.' });

    await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ targetType: 'question', targetId: liked.body.data.id });

    const res = await request(app)
      .get('/api/questions')
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(res.status).toBe(200);
    const byId = new Map<number, boolean>(
      (res.body.data as { id: number; liked: boolean }[]).map((q) => [q.id, q.liked])
    );
    expect(byId.get(liked.body.data.id)).toBe(true);
    expect(byId.get(unliked.body.data.id)).toBe(false);
  });

  test('pagination + liked still correct on page 2', async () => {
    const asker = await registerUser('p2_asker');
    const viewer = await registerUser('p2_viewer');

    // Seed 3 questions; only the second one is liked.
    const created: number[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${asker.token}`)
        .send({ title: `Title number ${i + 1}xx`, content: `Body number ${i + 1}xx content.` });
      created.push(r.body.data.id);
    }
    await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ targetType: 'question', targetId: created[1] });

    // limit=2 → page 2 should have just 1 item, the very first (oldest) one.
    const page2 = await request(app)
      .get('/api/questions?limit=2&page=2')
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(page2.status).toBe(200);
    expect(page2.body.data.length).toBe(1);
    expect(page2.body.meta).toEqual({ total: 3, page: 2, limit: 2 });
    // Only liked item is `created[1]` — page 2 shouldn't include it under default
    // latest sort (newest first), so liked must be false here.
    expect(page2.body.data[0].liked).toBe(false);
  });
});

describe('POST /api/votes — points integration', () => {
  test('liking a question grants +5 to question author', async () => {
    const asker = await registerUser('alice');
    const liker = await registerUser('bob');

    const qRes = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ title: 'Some question title', content: 'Some question content here' });
    const questionId = qRes.body.data.id;

    const voteRes = await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${liker.token}`)
      .send({ targetType: VOTE_TARGET_TYPE.QUESTION, targetId: questionId });

    expect(voteRes.status).toBe(200);
    expect(voteRes.body.data.liked).toBe(true);

    const alice = await User.findByPk(asker.id);
    expect(alice!.points).toBe(POINTS_RULES.ASK_QUESTION + POINTS_RULES.QUESTION_LIKED); // 0
  });

  test('unliking reverses the bonus', async () => {
    const asker = await registerUser('alice');
    const liker = await registerUser('bob');

    const qRes = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ title: 'Some question title', content: 'Some question content here' });
    const questionId = qRes.body.data.id;

    await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${liker.token}`)
      .send({ targetType: 'question', targetId: questionId });
    await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${liker.token}`)
      .send({ targetType: 'question', targetId: questionId });

    const alice = await User.findByPk(asker.id);
    expect(alice!.points).toBe(POINTS_RULES.ASK_QUESTION); // back to -5
  });
});

describe('GET /api/users/me/points — point history', () => {
  test('401 without token', async () => {
    const res = await request(app).get('/api/users/me/points');
    expect(res.status).toBe(401);
  });

  test('returns the authenticated user point records (newest first)', async () => {
    const asker = await registerUser('alice');
    const answerer = await registerUser('bob');

    const qRes = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ title: 'Some question title', content: 'Some question content here' });

    const aRes = await request(app)
      .post(`/api/questions/${qRes.body.data.id}/answers`)
      .set('Authorization', `Bearer ${answerer.token}`)
      .send({ content: 'Reasonable answer with enough length.' });

    await request(app)
      .post(`/api/answers/${aRes.body.data.id}/accept`)
      .set('Authorization', `Bearer ${asker.token}`);

    const bobHistory = await request(app)
      .get('/api/users/me/points')
      .set('Authorization', `Bearer ${answerer.token}`);

    expect(bobHistory.status).toBe(200);
    expect(bobHistory.body.meta.total).toBe(2); // +10 answer, +30 accepted
    const types = bobHistory.body.data.map((r: { type: string }) => r.type);
    // Newest first: accept, then answer
    expect(types).toEqual(['accept', 'answer']);
    const points = bobHistory.body.data.map((r: { points: number }) => r.points);
    expect(points).toEqual([30, 10]);
  });

  test('respects pagination', async () => {
    const { token } = await registerUser('alice');
    // Generate several point records by posting questions
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: `Question number ${i}`, content: 'Some question content here' });
    }
    const res = await request(app)
      .get('/api/users/me/points?limit=2&page=1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toEqual({ total: 3, page: 1, limit: 2 });
  });
});

describe('Content moderation', () => {
  test('400 when question content contains banned word', async () => {
    const { token } = await registerUser('alice');
    const res = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Spam pitch incoming',
        content: '请大家联系微信 abc 加入项目领取奖励。',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/联系微信/);
  });

  test('400 when answer content contains banned word', async () => {
    const asker = await registerUser('alice');
    const answerer = await registerUser('bob');
    const q = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ title: 'Some question title', content: 'Some question content here' });
    const res = await request(app)
      .post(`/api/questions/${q.body.data.id}/answers`)
      .set('Authorization', `Bearer ${answerer.token}`)
      .send({ content: '加我QQ 12345 详谈方案' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/加我QQ/i);
  });

  test('moderation also gates updates', async () => {
    const { token } = await registerUser('alice');
    const created = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Original safe title here', content: 'Original safe content body.' });
    const res = await request(app)
      .patch(`/api/questions/${created.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '免费送 limited offer click here' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/免费送/);
  });
});

describe('Daily passive points cap', () => {
  test('positive passive earnings stop accruing once cap is reached', async () => {
    process.env.DAILY_PASSIVE_POINTS_CAP = '20';
    try {
      const author = await registerUser('alice');
      // Pre-fill today's ledger to put author at the cap
      await PointRecord.create({
        userId: author.id,
        type: 'like_question',
        points: 20,
        relatedId: null,
      });
      await User.increment({ points: 20 }, { where: { id: author.id } });
      const before = (await User.findByPk(author.id))!.points;

      // Another user likes a fresh question — should be a no-op for points
      const q = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${author.token}`)
        .send({ title: 'Capped earnings probe', content: 'Will get liked but no points.' });
      const liker = await registerUser('liker');
      const voteRes = await request(app)
        .post('/api/votes')
        .set('Authorization', `Bearer ${liker.token}`)
        .send({ targetType: 'question', targetId: q.body.data.id });
      expect(voteRes.status).toBe(200);

      // votes counter still incremented on the question
      expect(voteRes.body.data.votes).toBe(1);

      // But author.points only changed by the -5 ask penalty — no like bonus
      const after = (await User.findByPk(author.id))!.points;
      expect(after).toBe(before - 5);
    } finally {
      delete process.env.DAILY_PASSIVE_POINTS_CAP;
    }
  });

  test('cap does NOT block active types (ask/answer)', async () => {
    process.env.DAILY_PASSIVE_POINTS_CAP = '0';
    // Cap=0 disables enforcement; this test mostly asserts active flows still work.
    try {
      const { id, token } = await registerUser('worker');
      await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Active flow probe', content: 'Should still take the -5 hit.' });
      const u = await User.findByPk(id);
      expect(u!.points).toBe(-5);
    } finally {
      delete process.env.DAILY_PASSIVE_POINTS_CAP;
    }
  });
});

describe('PATCH /api/auth/me — update profile', () => {
  test('changes username', async () => {
    const { token, id } = await registerUser('alice');
    const res = await request(app)
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'alice2' });
    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe('alice2');
    const dbUser = await User.findByPk(id);
    expect(dbUser!.username).toBe('alice2');
  });

  test('rejects username taken by another user', async () => {
    await registerUser('alice');
    const bob = await registerUser('bob');
    const res = await request(app)
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ username: 'alice' });
    expect(res.status).toBe(400);
  });

  test('sets avatar URL', async () => {
    const { token } = await registerUser('alice');
    const res = await request(app)
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ avatar: 'https://example.com/a.png' });
    expect(res.status).toBe(200);
    expect(res.body.data.avatar).toBe('https://example.com/a.png');
  });

  test('changes password when current matches', async () => {
    const { token } = await registerUser('alice');
    const res = await request(app)
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'secret123', newPassword: 'newpass456' });
    expect(res.status).toBe(200);

    // Old password should now fail to login
    const loginOld = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@test.com', password: 'secret123' });
    expect(loginOld.status).toBe(401);

    // New password works
    const loginNew = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@test.com', password: 'newpass456' });
    expect(loginNew.status).toBe(200);
  });

  test('rejects password change with wrong current password', async () => {
    const { token } = await registerUser('alice');
    const res = await request(app)
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'wrong', newPassword: 'newpass456' });
    // 400 (bad payload) rather than 401 — the user IS authenticated, just
    // their "current password" input is wrong. Using 401 would cause the
    // frontend's auto-logout to evict the session.
    expect(res.status).toBe(400);
  });

  test('400 when newPassword without currentPassword', async () => {
    const { token } = await registerUser('alice');
    const res = await request(app)
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: 'newpass456' });
    expect(res.status).toBe(400);
  });

  test('401 without token', async () => {
    const res = await request(app).patch('/api/auth/me').send({ username: 'whatever' });
    expect(res.status).toBe(401);
  });
});

describe('PATCH/DELETE /api/questions/:id', () => {
  async function setupQuestion(): Promise<{ token: string; otherToken: string; id: number }> {
    const owner = await registerUser('alice');
    const other = await registerUser('bob');
    const res = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Original title here', content: 'Original content body.', tags: ['x'] });
    return { token: owner.token, otherToken: other.token, id: res.body.data.id };
  }

  test('PATCH: author can update title/content/tags; tags lowercased', async () => {
    const { token, id } = await setupQuestion();
    const res = await request(app)
      .patch(`/api/questions/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated title here', content: 'Updated content body.', tags: ['JS', 'Node'] });
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated title here');
    expect(res.body.data.tags).toEqual(['js', 'node']);
  });

  test('PATCH: 403 for non-author', async () => {
    const { otherToken, id } = await setupQuestion();
    const res = await request(app)
      .patch(`/api/questions/${id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ title: 'Hijacked title' });
    expect(res.status).toBe(403);
  });

  test('PATCH: 400 for empty body', async () => {
    const { token, id } = await setupQuestion();
    const res = await request(app)
      .patch(`/api/questions/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('DELETE: cascades answers and cleans votes', async () => {
    const owner = await registerUser('alice');
    const answerer = await registerUser('bob');
    const liker = await registerUser('carol');

    const qRes = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Doomed question title', content: 'Will be deleted soon.' });
    const qId = qRes.body.data.id;

    const aRes = await request(app)
      .post(`/api/questions/${qId}/answers`)
      .set('Authorization', `Bearer ${answerer.token}`)
      .send({ content: 'Doomed answer content here.' });
    const aId = aRes.body.data.id;

    await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${liker.token}`)
      .send({ targetType: 'question', targetId: qId });
    await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${liker.token}`)
      .send({ targetType: 'answer', targetId: aId });

    const delRes = await request(app)
      .delete(`/api/questions/${qId}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(delRes.status).toBe(200);

    expect(await Question.findByPk(qId)).toBeNull();
    expect(await Answer.findByPk(aId)).toBeNull();
    expect(await Vote.count({ where: { targetType: 'question', targetId: qId } })).toBe(0);
    expect(await Vote.count({ where: { targetType: 'answer', targetId: aId } })).toBe(0);
  });

  test('DELETE: 403 for non-author', async () => {
    const { otherToken, id } = await setupQuestion();
    const res = await request(app)
      .delete(`/api/questions/${id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });
});

describe('PATCH/DELETE /api/answers/:id', () => {
  async function setupAnswer(): Promise<{
    answererToken: string;
    askerToken: string;
    questionId: number;
    answerId: number;
  }> {
    const asker = await registerUser('alice');
    const answerer = await registerUser('bob');
    const q = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ title: 'Some question title', content: 'Some question content here' });
    const a = await request(app)
      .post(`/api/questions/${q.body.data.id}/answers`)
      .set('Authorization', `Bearer ${answerer.token}`)
      .send({ content: 'Original answer content here.' });
    return {
      answererToken: answerer.token,
      askerToken: asker.token,
      questionId: q.body.data.id,
      answerId: a.body.data.id,
    };
  }

  test('PATCH: author updates content', async () => {
    const { answererToken, answerId } = await setupAnswer();
    const res = await request(app)
      .patch(`/api/answers/${answerId}`)
      .set('Authorization', `Bearer ${answererToken}`)
      .send({ content: 'Updated answer content here.' });
    expect(res.status).toBe(200);
    expect(res.body.data.content).toBe('Updated answer content here.');
  });

  test('PATCH: 403 for non-author (even question author)', async () => {
    const { askerToken, answerId } = await setupAnswer();
    const res = await request(app)
      .patch(`/api/answers/${answerId}`)
      .set('Authorization', `Bearer ${askerToken}`)
      .send({ content: 'Hijacked content here.' });
    expect(res.status).toBe(403);
  });

  test('DELETE: decrements answersCount', async () => {
    const { answererToken, answerId, questionId } = await setupAnswer();
    const before = (await Question.findByPk(questionId))!.answersCount;
    const res = await request(app)
      .delete(`/api/answers/${answerId}`)
      .set('Authorization', `Bearer ${answererToken}`);
    expect(res.status).toBe(200);
    const after = (await Question.findByPk(questionId))!.answersCount;
    expect(after).toBe(before - 1);
  });

  test('DELETE: when accepted answer is deleted, question becomes unsolved', async () => {
    const { answererToken, askerToken, answerId, questionId } = await setupAnswer();
    await request(app)
      .post(`/api/answers/${answerId}/accept`)
      .set('Authorization', `Bearer ${askerToken}`);
    expect((await Question.findByPk(questionId))!.isSolved).toBe(true);

    await request(app)
      .delete(`/api/answers/${answerId}`)
      .set('Authorization', `Bearer ${answererToken}`);

    expect((await Question.findByPk(questionId))!.isSolved).toBe(false);
  });
});

describe('Reports + admin', () => {
  async function seedQuestionByOther(
    askerToken: string,
    answererToken?: string
  ): Promise<{ qId: number; aId?: number }> {
    const q = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${askerToken}`)
      .send({ title: 'Reportable question title', content: 'Some content here for reporting tests.' });
    let aId: number | undefined;
    if (answererToken) {
      const a = await request(app)
        .post(`/api/questions/${q.body.data.id}/answers`)
        .set('Authorization', `Bearer ${answererToken}`)
        .send({ content: 'A reportable answer body.' });
      aId = a.body.data.id;
    }
    return { qId: q.body.data.id, aId };
  }

  test('POST /api/reports requires auth (401)', async () => {
    const res = await request(app)
      .post('/api/reports')
      .send({ targetType: 'question', targetId: 1, reason: 'spam' });
    expect(res.status).toBe(401);
  });

  test('user can submit a report (201)', async () => {
    const asker = await registerUser('asker');
    const reporter = await registerUser('reporter');
    const { qId } = await seedQuestionByOther(asker.token);

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${reporter.token}`)
      .send({ targetType: 'question', targetId: qId, reason: 'spam', details: '广告' });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.reason).toBe('spam');
  });

  test('cannot report your own content (400)', async () => {
    const asker = await registerUser('asker');
    const { qId } = await seedQuestionByOther(asker.token);
    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ targetType: 'question', targetId: qId, reason: 'spam' });
    expect(res.status).toBe(400);
  });

  test('duplicate pending report → 409', async () => {
    const asker = await registerUser('asker');
    const reporter = await registerUser('reporter');
    const { qId } = await seedQuestionByOther(asker.token);
    await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${reporter.token}`)
      .send({ targetType: 'question', targetId: qId, reason: 'spam' });
    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${reporter.token}`)
      .send({ targetType: 'question', targetId: qId, reason: 'offensive' });
    expect(res.status).toBe(409);
  });

  test('GET /api/reports requires admin (403 for plain user)', async () => {
    const u = await registerUser('alice');
    const res = await request(app).get('/api/reports').set('Authorization', `Bearer ${u.token}`);
    expect(res.status).toBe(403);
  });

  test('admin can list pending reports', async () => {
    const admin = await registerAdmin('admin1');
    const asker = await registerUser('asker');
    const reporter = await registerUser('reporter');
    const { qId } = await seedQuestionByOther(asker.token);
    await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${reporter.token}`)
      .send({ targetType: 'question', targetId: qId, reason: 'spam' });

    const res = await request(app)
      .get('/api/reports?status=pending')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].targetId).toBe(qId);
  });

  test('admin reviews "keep" → status reviewed_kept, target intact', async () => {
    const admin = await registerAdmin('admin2');
    const asker = await registerUser('asker');
    const reporter = await registerUser('reporter');
    const { qId } = await seedQuestionByOther(asker.token);
    const reportRes = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${reporter.token}`)
      .send({ targetType: 'question', targetId: qId, reason: 'spam' });

    const res = await request(app)
      .post(`/api/reports/${reportRes.body.data.id}/review`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'keep' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('reviewed_kept');
    expect(await Question.count({ where: { id: qId } })).toBe(1);
  });

  test('admin reviews "remove" → target deleted, all sibling pending reports closed', async () => {
    const admin = await registerAdmin('admin3');
    const asker = await registerUser('asker');
    const reporter1 = await registerUser('reporter1');
    const reporter2 = await registerUser('reporter2');
    const { qId } = await seedQuestionByOther(asker.token);
    const r1 = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${reporter1.token}`)
      .send({ targetType: 'question', targetId: qId, reason: 'spam' });
    await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${reporter2.token}`)
      .send({ targetType: 'question', targetId: qId, reason: 'offensive' });

    const res = await request(app)
      .post(`/api/reports/${r1.body.data.id}/review`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'remove' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('reviewed_removed');
    expect(await Question.count({ where: { id: qId } })).toBe(0);
    // Both pending reports on this target should now be closed.
    expect(await Report.count({ where: { status: 'pending' } })).toBe(0);
    expect(await Report.count({ where: { status: 'reviewed_removed' } })).toBe(2);
  });

  test('admin can DELETE any user\'s question via the standard endpoint', async () => {
    const admin = await registerAdmin('admin4');
    const asker = await registerUser('asker');
    const { qId } = await seedQuestionByOther(asker.token);

    const res = await request(app)
      .delete(`/api/questions/${qId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(await Question.count({ where: { id: qId } })).toBe(0);
  });

  test('reviewing the same report twice → 409', async () => {
    const admin = await registerAdmin('admin5');
    const asker = await registerUser('asker');
    const reporter = await registerUser('reporter');
    const { qId } = await seedQuestionByOther(asker.token);
    const r = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${reporter.token}`)
      .send({ targetType: 'question', targetId: qId, reason: 'spam' });
    await request(app)
      .post(`/api/reports/${r.body.data.id}/review`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'keep' });
    const second = await request(app)
      .post(`/api/reports/${r.body.data.id}/review`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ action: 'remove' });
    expect(second.status).toBe(409);
  });
});

describe('Comments', () => {
  test('post comment on a question (auth required)', async () => {
    const asker = await registerUser('asker');
    const commenter = await registerUser('commenter');
    const q = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ title: 'A question to comment on', content: 'Some question content body.' });

    const res = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${commenter.token}`)
      .send({ targetType: 'question', targetId: q.body.data.id, content: '说得很对！' });
    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe('说得很对！');
  });

  test('comments appear nested under question detail', async () => {
    const asker = await registerUser('asker');
    const c1 = await registerUser('comc1');
    const c2 = await registerUser('comc2');
    const q = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ title: 'Q with comments', content: 'Some question content body.' });
    const a = await request(app)
      .post(`/api/questions/${q.body.data.id}/answers`)
      .set('Authorization', `Bearer ${c1.token}`)
      .send({ content: 'An answer with eventual comments.' });

    await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${c1.token}`)
      .send({ targetType: 'question', targetId: q.body.data.id, content: '问题评论 A' });
    await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${c2.token}`)
      .send({ targetType: 'answer', targetId: a.body.data.id, content: '回答评论 B' });

    const detail = await request(app).get(`/api/questions/${q.body.data.id}`);
    expect(detail.body.data.comments).toHaveLength(1);
    expect(detail.body.data.comments[0].content).toBe('问题评论 A');
    expect(detail.body.data.answers[0].comments).toHaveLength(1);
    expect(detail.body.data.answers[0].comments[0].content).toBe('回答评论 B');
  });

  test('moderation gates comment content', async () => {
    const asker = await registerUser('asker');
    const commenter = await registerUser('comm1');
    const q = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ title: 'A question', content: 'Some question content body.' });
    const res = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${commenter.token}`)
      .send({ targetType: 'question', targetId: q.body.data.id, content: '联系微信 lol123' });
    expect(res.status).toBe(400);
  });

  test('author can delete own comment, others cannot (403)', async () => {
    const asker = await registerUser('asker');
    const commenter = await registerUser('comm2');
    const other = await registerUser('other');
    const q = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ title: 'Q for delete', content: 'Some question content body.' });
    const created = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${commenter.token}`)
      .send({ targetType: 'question', targetId: q.body.data.id, content: '我的评论' });

    const denied = await request(app)
      .delete(`/api/comments/${created.body.data.id}`)
      .set('Authorization', `Bearer ${other.token}`);
    expect(denied.status).toBe(403);

    const ok = await request(app)
      .delete(`/api/comments/${created.body.data.id}`)
      .set('Authorization', `Bearer ${commenter.token}`);
    expect(ok.status).toBe(200);
  });
});

describe('Notifications', () => {
  test('answering generates a question_answered notification for the asker', async () => {
    const asker = await registerUser('asker');
    const answerer = await registerUser('bob');
    const q = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ title: 'Question for notif', content: 'Some question content body.' });
    await request(app)
      .post(`/api/questions/${q.body.data.id}/answers`)
      .set('Authorization', `Bearer ${answerer.token}`)
      .send({ content: 'An answer body here.' });

    const list = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${asker.token}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].type).toBe('question_answered');
    expect(list.body.meta.unread).toBe(1);
  });

  test('accepting an answer notifies the answer author', async () => {
    const asker = await registerUser('asker');
    const bob = await registerUser('bob');
    const q = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ title: 'Q for accept notif', content: 'Some question content body.' });
    const a = await request(app)
      .post(`/api/questions/${q.body.data.id}/answers`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ content: 'An answer body here.' });
    await request(app)
      .post(`/api/answers/${a.body.data.id}/accept`)
      .set('Authorization', `Bearer ${asker.token}`);

    const bobNotifs = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${bob.token}`);
    const types = bobNotifs.body.data.map((n: { type: string }) => n.type).sort();
    // bob should see both: their answer was accepted, and (no — bob is the answerer
    // not the asker, so question_answered goes to alice). bob only gets accept.
    expect(types).toContain('answer_accepted');
  });

  test('liking only emits one notification (unlike does NOT)', async () => {
    const asker = await registerUser('asker');
    const liker = await registerUser('liker');
    const q = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ title: 'Q for like notif', content: 'Some question content body.' });
    await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${liker.token}`)
      .send({ targetType: 'question', targetId: q.body.data.id });
    await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${liker.token}`)
      .send({ targetType: 'question', targetId: q.body.data.id }); // unlike

    const askerNotifs = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${asker.token}`);
    const likes = askerNotifs.body.data.filter(
      (n: { type: string }) => n.type === 'question_liked'
    );
    expect(likes).toHaveLength(1);
  });

  test('self-actions do not generate notifications', async () => {
    const asker = await registerUser('alice');
    const q = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ title: 'Self action probe', content: 'Some question content body.' });
    // alice answers + accepts her own question
    const a = await request(app)
      .post(`/api/questions/${q.body.data.id}/answers`)
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ content: 'Self answer body here.' });
    await request(app)
      .post(`/api/answers/${a.body.data.id}/accept`)
      .set('Authorization', `Bearer ${asker.token}`);

    const list = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${asker.token}`);
    expect(list.body.data).toHaveLength(0);
  });

  test('mark-read with all=true clears unread count', async () => {
    const asker = await registerUser('asker');
    const bob = await registerUser('bob');
    const q = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ title: 'For read test', content: 'Some question content body.' });
    await request(app)
      .post(`/api/questions/${q.body.data.id}/answers`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ content: 'Some answer body.' });

    const before = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${asker.token}`);
    expect(before.body.meta.unread).toBe(1);

    const mark = await request(app)
      .post('/api/notifications/mark-read')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ all: true });
    expect(mark.body.data.affected).toBe(1);

    const after = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${asker.token}`);
    expect(after.body.meta.unread).toBe(0);
  });

  test('admin removing content notifies the original author', async () => {
    const admin = await registerAdmin('admin1');
    const asker = await registerUser('asker');
    const q = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ title: 'Doomed question', content: 'Will be removed by admin.' });

    await request(app)
      .delete(`/api/questions/${q.body.data.id}`)
      .set('Authorization', `Bearer ${admin.token}`);

    const list = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${asker.token}`);
    const types = list.body.data.map((n: { type: string }) => n.type);
    expect(types).toContain('content_removed');
  });
});

describe('GET /api/auth/me', () => {
  test('returns the authenticated user profile', async () => {
    const { token, id } = await registerUser('alice');
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
    expect(res.body.data).not.toHaveProperty('password');
  });
});

describe('GET /api/questions — list + sort + filter', () => {
  async function seedQuestion(
    token: string,
    title: string,
    tags: string[] = []
  ): Promise<number> {
    const res = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${token}`)
      .send({ title, content: 'Some question content here', tags });
    expect(res.status).toBe(201);
    return res.body.data.id;
  }

  test('default sort is latest (created_at DESC)', async () => {
    const { token } = await registerUser('alice');
    const q1 = await seedQuestion(token, 'First question title');
    const q2 = await seedQuestion(token, 'Second question title');
    // Stagger timestamps deterministically.
    await Question.update(
      { createdAt: new Date('2026-01-01T00:00:00Z') },
      { where: { id: q1 }, silent: true }
    );
    await Question.update(
      { createdAt: new Date('2026-02-01T00:00:00Z') },
      { where: { id: q2 }, silent: true }
    );

    const res = await request(app).get('/api/questions');
    expect(res.status).toBe(200);
    expect(res.body.data.map((q: { id: number }) => q.id)).toEqual([q2, q1]);
    expect(res.body.meta).toEqual({ total: 2, page: 1, limit: 20 });
  });

  test('sort=popular orders by votes DESC', async () => {
    const alice = await registerUser('alice');
    const liker1 = await registerUser('liker1');
    const liker2 = await registerUser('liker2');

    const qLow = await seedQuestion(alice.token, 'Low votes question');
    const qHigh = await seedQuestion(alice.token, 'High votes question');

    // two likers upvote qHigh, only liker1 upvotes qLow
    await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${liker1.token}`)
      .send({ targetType: VOTE_TARGET_TYPE.QUESTION, targetId: qHigh });
    await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${liker2.token}`)
      .send({ targetType: VOTE_TARGET_TYPE.QUESTION, targetId: qHigh });
    await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${liker1.token}`)
      .send({ targetType: VOTE_TARGET_TYPE.QUESTION, targetId: qLow });

    const res = await request(app).get('/api/questions?sort=popular');
    expect(res.body.data.map((q: { id: number }) => q.id)).toEqual([qHigh, qLow]);
  });

  test('sort=unsolved filters is_solved=false', async () => {
    const asker = await registerUser('alice');
    const answerer = await registerUser('bob');

    const qSolved = await seedQuestion(asker.token, 'This will be solved');
    const qOpen = await seedQuestion(asker.token, 'This stays open');

    const aRes = await request(app)
      .post(`/api/questions/${qSolved}/answers`)
      .set('Authorization', `Bearer ${answerer.token}`)
      .send({ content: 'An answer to the solved one.' });
    await request(app)
      .post(`/api/answers/${aRes.body.data.id}/accept`)
      .set('Authorization', `Bearer ${asker.token}`);

    const res = await request(app).get('/api/questions?sort=unsolved');
    const ids = res.body.data.map((q: { id: number }) => q.id);
    expect(ids).toContain(qOpen);
    expect(ids).not.toContain(qSolved);
    expect(res.body.meta.total).toBe(1);
  });

  test('tag filter returns only matching questions', async () => {
    const { token } = await registerUser('alice');
    const qJs = await seedQuestion(token, 'JavaScript question 1', ['javascript']);
    const qJsNode = await seedQuestion(token, 'JavaScript with node', ['javascript', 'node']);
    await seedQuestion(token, 'Python question', ['python']);

    const res = await request(app).get('/api/questions?tag=javascript');
    const ids = res.body.data.map((q: { id: number }) => q.id).sort();
    expect(ids).toEqual([qJs, qJsNode].sort());
    expect(res.body.meta.total).toBe(2);
  });

  test('tag filter does not cause prefix collisions (java vs javascript)', async () => {
    const { token } = await registerUser('alice');
    const qJava = await seedQuestion(token, 'Java language question', ['java']);
    await seedQuestion(token, 'JavaScript question', ['javascript']);

    const res = await request(app).get('/api/questions?tag=java');
    const ids = res.body.data.map((q: { id: number }) => q.id);
    expect(ids).toEqual([qJava]);
  });

  test('combines sort + tag filter', async () => {
    const alice = await registerUser('alice');
    const liker = await registerUser('liker');

    const qTs1 = await seedQuestion(alice.token, 'TS question low', ['typescript']);
    const qTs2 = await seedQuestion(alice.token, 'TS question high', ['typescript']);
    await seedQuestion(alice.token, 'Go question', ['golang']);

    await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${liker.token}`)
      .send({ targetType: VOTE_TARGET_TYPE.QUESTION, targetId: qTs2 });

    const res = await request(app).get('/api/questions?sort=popular&tag=typescript');
    expect(res.body.data.map((q: { id: number }) => q.id)).toEqual([qTs2, qTs1]);
    expect(res.body.meta.total).toBe(2);
  });

  test('pagination returns correct slice and meta', async () => {
    const { token } = await registerUser('alice');
    const ids: number[] = [];
    const baseTime = Date.now() - 10_000_000;
    for (let i = 0; i < 5; i++) {
      const id = await seedQuestion(token, `Question number ${i}`);
      // Stagger createdAt directly; avoids real-time sleeps that blow the Jest timeout.
      await Question.update(
        { createdAt: new Date(baseTime + i * 1000) },
        { where: { id }, silent: true }
      );
      ids.push(id);
    }

    const page1 = await request(app).get('/api/questions?limit=2&page=1');
    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.meta).toEqual({ total: 5, page: 1, limit: 2 });
    expect(page1.body.data.map((q: { id: number }) => q.id)).toEqual([ids[4], ids[3]]);

    const page3 = await request(app).get('/api/questions?limit=2&page=3');
    expect(page3.body.data).toHaveLength(1);
    expect(page3.body.data[0].id).toBe(ids[0]);
  });

  test('400 on invalid sort value', async () => {
    const res = await request(app).get('/api/questions?sort=bogus');
    expect(res.status).toBe(400);
  });

  test('400 on invalid limit', async () => {
    const res = await request(app).get('/api/questions?limit=999');
    expect(res.status).toBe(400);
  });

  test('tag filter is case-insensitive', async () => {
    const { token } = await registerUser('alice');
    const qId = await seedQuestion(token, 'JavaScript question', ['javascript']);

    for (const tagParam of ['javascript', 'JavaScript', 'JAVASCRIPT']) {
      const res = await request(app).get(`/api/questions?tag=${tagParam}`);
      expect(res.body.data.map((q: { id: number }) => q.id)).toEqual([qId]);
    }
  });

  test('q keyword filter matches title (case-insensitive)', async () => {
    const { token } = await registerUser('alice');
    const target = await seedQuestion(token, 'How to debug websockets in production');
    await seedQuestion(token, 'Some unrelated question title');

    const res = await request(app).get('/api/questions?q=WEBSOCKETS');
    expect(res.body.data.map((q: { id: number }) => q.id)).toEqual([target]);
  });

  test('q keyword filter also matches content', async () => {
    const asker = await registerUser('alice');
    const a = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({
        title: 'A generic title here',
        content: 'This body mentions kubernetes deployment specifics.',
      });

    await seedQuestion(asker.token, 'Some other question title');

    const res = await request(app).get('/api/questions?q=kubernetes');
    expect(res.body.data.map((q: { id: number }) => q.id)).toEqual([a.body.data.id]);
  });

  test('q + tag combine with AND', async () => {
    const { token } = await registerUser('alice');
    const target = await seedQuestion(token, 'JS performance tuning tricks', ['javascript']);
    await seedQuestion(token, 'JS basics for beginners', ['javascript']);
    await seedQuestion(token, 'Python performance tuning tricks', ['python']);

    const res = await request(app).get('/api/questions?q=performance&tag=javascript');
    expect(res.body.data.map((q: { id: number }) => q.id)).toEqual([target]);
  });
});

describe('DELETE /api/answers/:id/accept — unaccept', () => {
  async function setupAcceptedAnswer(): Promise<{
    askerToken: string;
    answererToken: string;
    answererId: number;
    answerId: number;
    questionId: number;
  }> {
    const asker = await registerUser('alice');
    const answerer = await registerUser('bob');
    const qRes = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ title: 'Some question title', content: 'Some question content here' });
    const aRes = await request(app)
      .post(`/api/questions/${qRes.body.data.id}/answers`)
      .set('Authorization', `Bearer ${answerer.token}`)
      .send({ content: 'A reasonable answer here.' });
    await request(app)
      .post(`/api/answers/${aRes.body.data.id}/accept`)
      .set('Authorization', `Bearer ${asker.token}`);
    return {
      askerToken: asker.token,
      answererToken: answerer.token,
      answererId: answerer.id,
      answerId: aRes.body.data.id,
      questionId: qRes.body.data.id,
    };
  }

  test('question author can unaccept; question becomes unsolved; bonus stays', async () => {
    const { askerToken, answererId, answerId, questionId } = await setupAcceptedAnswer();
    const before = (await User.findByPk(answererId))!.points;

    const res = await request(app)
      .delete(`/api/answers/${answerId}/accept`)
      .set('Authorization', `Bearer ${askerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.isAccepted).toBe(false);

    const q = await Question.findByPk(questionId);
    expect(q!.isSolved).toBe(false);

    const after = (await User.findByPk(answererId))!.points;
    expect(after).toBe(before); // bonus preserved
  });

  test('non-author gets 403', async () => {
    const { answererToken, answerId } = await setupAcceptedAnswer();
    const res = await request(app)
      .delete(`/api/answers/${answerId}/accept`)
      .set('Authorization', `Bearer ${answererToken}`);
    expect(res.status).toBe(403);
  });

  test('unauthenticated gets 401', async () => {
    const { answerId } = await setupAcceptedAnswer();
    const res = await request(app).delete(`/api/answers/${answerId}/accept`);
    expect(res.status).toBe(401);
  });

  test('unaccepting an answer that is not accepted returns 409', async () => {
    const asker = await registerUser('alice');
    const answerer = await registerUser('bob');
    const qRes = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ title: 'Some question title', content: 'Some question content here' });
    const aRes = await request(app)
      .post(`/api/questions/${qRes.body.data.id}/answers`)
      .set('Authorization', `Bearer ${answerer.token}`)
      .send({ content: 'A reasonable answer here.' });

    const res = await request(app)
      .delete(`/api/answers/${aRes.body.data.id}/accept`)
      .set('Authorization', `Bearer ${asker.token}`);
    expect(res.status).toBe(409);
  });
});

describe('GET /api/questions/:id — liked state', () => {
  async function seedQuestionWithAnswers(): Promise<{
    questionId: number;
    answerA: number;
    answerB: number;
    askerToken: string;
    answererToken: string;
  }> {
    const asker = await registerUser('alice');
    const answerer = await registerUser('bob');

    const qRes = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ title: 'Why is the sky blue?', content: 'Been wondering for a while now.' });

    const a1 = await request(app)
      .post(`/api/questions/${qRes.body.data.id}/answers`)
      .set('Authorization', `Bearer ${answerer.token}`)
      .send({ content: 'Rayleigh scattering makes the sky blue.' });

    const a2 = await request(app)
      .post(`/api/questions/${qRes.body.data.id}/answers`)
      .set('Authorization', `Bearer ${answerer.token}`)
      .send({ content: 'Blue light scatters more than red light.' });

    return {
      questionId: qRes.body.data.id,
      answerA: a1.body.data.id,
      answerB: a2.body.data.id,
      askerToken: asker.token,
      answererToken: answerer.token,
    };
  }

  test('anonymous request: returns question + answers, no liked field', async () => {
    const { questionId } = await seedQuestionWithAnswers();
    const res = await request(app).get(`/api/questions/${questionId}`);

    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('liked');
    expect(res.body.data.answers).toHaveLength(2);
    for (const a of res.body.data.answers) {
      expect(a).not.toHaveProperty('liked');
    }
  });

  test('authenticated but hasn\'t liked anything: liked=false everywhere', async () => {
    const { questionId } = await seedQuestionWithAnswers();
    const { token } = await registerUser('reader');
    const res = await request(app)
      .get(`/api/questions/${questionId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.liked).toBe(false);
    for (const a of res.body.data.answers) {
      expect(a.liked).toBe(false);
    }
  });

  test('returns true only for targets the user has liked', async () => {
    const { questionId, answerA, answerB } = await seedQuestionWithAnswers();
    const reader = await registerUser('reader');

    await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${reader.token}`)
      .send({ targetType: VOTE_TARGET_TYPE.QUESTION, targetId: questionId });
    await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${reader.token}`)
      .send({ targetType: VOTE_TARGET_TYPE.ANSWER, targetId: answerA });

    const res = await request(app)
      .get(`/api/questions/${questionId}`)
      .set('Authorization', `Bearer ${reader.token}`);

    expect(res.body.data.liked).toBe(true);
    const byId = new Map<number, { liked: boolean }>(
      res.body.data.answers.map((a: { id: number; liked: boolean }) => [a.id, a])
    );
    expect(byId.get(answerA)!.liked).toBe(true);
    expect(byId.get(answerB)!.liked).toBe(false);
  });

  test('invalid/expired token: treated as anonymous, no 401', async () => {
    const { questionId } = await seedQuestionWithAnswers();
    const res = await request(app)
      .get(`/api/questions/${questionId}`)
      .set('Authorization', 'Bearer garbage-token');

    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('liked');
  });

  test('answer ordering: accepted first, then by votes desc', async () => {
    const { questionId, answerA, answerB, askerToken } = await seedQuestionWithAnswers();
    const liker = await registerUser('liker');

    // liker upvotes answerB so it has 1 vote vs answerA's 0
    await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${liker.token}`)
      .send({ targetType: VOTE_TARGET_TYPE.ANSWER, targetId: answerB });

    // asker accepts answerA
    await request(app)
      .post(`/api/answers/${answerA}/accept`)
      .set('Authorization', `Bearer ${askerToken}`);

    const res = await request(app).get(`/api/questions/${questionId}`);
    expect(res.body.data.answers[0].id).toBe(answerA); // accepted first
    expect(res.body.data.answers[1].id).toBe(answerB);
  });

  test('404 when question does not exist', async () => {
    const res = await request(app).get('/api/questions/99999');
    expect(res.status).toBe(404);
  });
});

describe('i18n error messages', () => {
  test('Accept-Language: zh-CN returns Chinese error', async () => {
    const res = await request(app)
      .get('/api/questions/99999')
      .set('Accept-Language', 'zh-CN');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('问题不存在');
  });

  test('Accept-Language: en-US returns English error', async () => {
    const res = await request(app)
      .get('/api/questions/99999')
      .set('Accept-Language', 'en-US');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Question not found');
  });

  test('falls back to zh-CN when no Accept-Language sent', async () => {
    const res = await request(app).get('/api/questions/99999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('问题不存在');
  });

  test('interpolates params (banned word) in chosen language', async () => {
    const { token } = await registerUser('lana');
    const res = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${token}`)
      .set('Accept-Language', 'en-US')
      .send({ title: 'Some safe title here', content: '大家请联系微信 abcdefg 加群' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Content contains banned word "联系微信"/);
  });

  test('unknown 404 route also localizes', async () => {
    const res = await request(app)
      .get('/api/this-route-does-not-exist')
      .set('Accept-Language', 'en-US');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Route not found');
  });
});

describe('GET /api/admin/stats', () => {
  test('non-admin gets 403', async () => {
    const { token } = await registerUser('mortal');
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('unauthenticated gets 401', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
  });

  test('admin gets KPIs, daily series, top users, top tags', async () => {
    const admin = await registerAdmin('boss');
    const asker = await registerUser('asker');
    const answerer = await registerUser('answerer');

    // Seed: 2 questions (one with tags), 1 answer, 1 comment
    const q1 = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({
        title: 'How do I use React hooks',
        content: 'I cannot figure out useEffect cleanup.',
        tags: ['react', 'hooks'],
      });
    expect(q1.status).toBe(201);
    await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ title: 'Another safe title', content: 'Another safe body content', tags: ['react'] });

    await request(app)
      .post(`/api/questions/${q1.body.data.id}/answers`)
      .set('Authorization', `Bearer ${answerer.token}`)
      .send({ content: 'Use the cleanup return.' });

    await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${answerer.token}`)
      .send({ targetType: 'question', targetId: q1.body.data.id, content: 'good question' });

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    const { kpis, daily, topUsers, topTags } = res.body.data;

    expect(kpis.users).toBeGreaterThanOrEqual(3);
    expect(kpis.questions).toBe(2);
    expect(kpis.answers).toBe(1);
    expect(kpis.comments).toBe(1);
    expect(kpis.pendingReports).toBe(0);

    expect(Array.isArray(daily)).toBe(true);
    expect(daily.length).toBe(30);
    const today = daily[daily.length - 1];
    expect(today.questions).toBe(2);
    expect(today.answers).toBe(1);
    expect(today.comments).toBe(1);

    expect(Array.isArray(topUsers)).toBe(true);
    expect(topUsers.length).toBeGreaterThan(0);
    expect(topUsers[0]).toHaveProperty('username');
    expect(topUsers[0]).toHaveProperty('points');

    expect(Array.isArray(topTags)).toBe(true);
    const reactTag = topTags.find((t: { tag: string; count: number }) => t.tag === 'react');
    expect(reactTag?.count).toBe(2);
    const hooksTag = topTags.find((t: { tag: string; count: number }) => t.tag === 'hooks');
    expect(hooksTag?.count).toBe(1);
  });

  test.each([
    [7, 7],
    [30, 30],
    [90, 90],
  ])('?days=%i returns %i daily buckets', async (days, expected) => {
    const admin = await registerAdmin(`stats_${days}`);
    const res = await request(app)
      .get(`/api/admin/stats?days=${days}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.daily.length).toBe(expected);
  });

  test('rejects non-canonical days values', async () => {
    const admin = await registerAdmin('stats_bad');
    const res = await request(app)
      .get('/api/admin/stats?days=42')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(400);
  });

  test('default (no days param) gives 30 buckets', async () => {
    const admin = await registerAdmin('stats_def');
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.daily.length).toBe(30);
  });
});

describe('GET /api/leaderboard', () => {
  test('defaults to users scope, returns lifetime top by points', async () => {
    const alice = await registerUser('lb_alice');
    const bob = await registerUser('lb_bob');
    const asker = await registerUser('lb_asker');

    const q = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ title: 'Leaderboard seed title', content: 'Leaderboard seed content body.' });
    await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ targetType: 'question', targetId: q.body.data.id });

    const res = await request(app).get('/api/leaderboard');
    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ scope: 'users', range: 'all' });
    expect(Array.isArray(res.body.data)).toBe(true);
    for (const u of res.body.data) {
      expect(u).not.toHaveProperty('email');
      expect(u).not.toHaveProperty('password');
      expect(u).toHaveProperty('id');
      expect(u).toHaveProperty('username');
      expect(u).toHaveProperty('points');
    }
    const pts = res.body.data.map((u: { points: number }) => u.points);
    for (let i = 1; i < pts.length; i++) expect(pts[i - 1]).toBeGreaterThanOrEqual(pts[i]);
    void bob;
  });

  test('scope=questions sorts by votes desc', async () => {
    const asker = await registerUser('lbq_asker');
    const liker = await registerUser('lbq_liker');

    const low = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ title: 'Low votes title here', content: 'Low votes content body.' });
    const high = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ title: 'High votes title here', content: 'High votes content body.' });
    await request(app)
      .post('/api/votes')
      .set('Authorization', `Bearer ${liker.token}`)
      .send({ targetType: 'question', targetId: high.body.data.id });

    const res = await request(app).get('/api/leaderboard?scope=questions&range=all');
    expect(res.status).toBe(200);
    expect(res.body.meta.scope).toBe('questions');
    const ids = (res.body.data as { id: number; votes: number }[]).map((r) => r.id);
    expect(ids.indexOf(high.body.data.id)).toBeLessThan(ids.indexOf(low.body.data.id));
    expect(res.body.data[0]).toHaveProperty('tags');
    expect(Array.isArray(res.body.data[0].tags)).toBe(true);
  });

  test('range=7d excludes older questions', async () => {
    const asker = await registerUser('lb_range_asker');
    const q = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${asker.token}`)
      .send({ title: 'Recent range title', content: 'Recent range content body.' });

    await Question.update(
      { createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
      { where: { id: q.body.data.id }, silent: true }
    );

    const res7d = await request(app).get('/api/leaderboard?scope=questions&range=7d');
    const ids7d = (res7d.body.data as { id: number }[]).map((r) => r.id);
    expect(ids7d).not.toContain(q.body.data.id);

    const resAll = await request(app).get('/api/leaderboard?scope=questions&range=all');
    const idsAll = (resAll.body.data as { id: number }[]).map((r) => r.id);
    expect(idsAll).toContain(q.body.data.id);
  });

  test('rejects invalid scope / range / limit', async () => {
    const a = await request(app).get('/api/leaderboard?scope=bogus');
    expect(a.status).toBe(400);
    const b = await request(app).get('/api/leaderboard?range=365d');
    expect(b.status).toBe(400);
    const c = await request(app).get('/api/leaderboard?limit=9999');
    expect(c.status).toBe(400);
  });

  test('emits ETag + Cache-Control (cacheable middleware)', async () => {
    const res = await request(app).get('/api/leaderboard');
    expect(res.status).toBe(200);
    expect(res.headers['etag']).toMatch(/^W\//);
    expect(res.headers['cache-control']).toContain('must-revalidate');
  });
});
