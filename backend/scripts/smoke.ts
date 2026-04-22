/* eslint-disable no-console */
// Dual-mode smoke test:
//   - NODE_ENV=test         → SQLite in-memory, sync({force:true}) for fresh schema
//   - NODE_ENV=development  → real MySQL (from .env); TRUNCATES feature tables first
//   - NODE_ENV=production   → refuses to run (would wipe live data)
if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run: smoke wipes data and must never hit production.');
  process.exit(1);
}

import request, { type Response } from 'supertest';
import { app } from '../src/app';
import { sequelize, User, Question, Answer, Vote, PointRecord } from '../src/models';

interface Step {
  label: string;
  method: 'GET' | 'POST';
  path: string;
  token?: string;
  body?: unknown;
  expectStatus: number;
}

async function call(step: Step): Promise<Response> {
  const agent = request(app);
  const builder =
    step.method === 'GET' ? agent.get(step.path) : agent.post(step.path);
  if (step.token) builder.set('Authorization', `Bearer ${step.token}`);
  if (step.body !== undefined) builder.send(step.body);
  const res = await builder;
  const tag = res.status === step.expectStatus ? 'OK ' : 'FAIL';
  const line = `[${tag}] ${step.method} ${step.path} -> ${res.status} (expected ${step.expectStatus})`;
  console.log(`\n── ${step.label} ──`);
  console.log(line);
  console.log(JSON.stringify(res.body, null, 2));
  if (res.status !== step.expectStatus) {
    throw new Error(`Smoke step failed: ${step.label}`);
  }
  return res;
}

async function resetSchema(): Promise<void> {
  if (process.env.NODE_ENV === 'test') {
    await sequelize.sync({ force: true });
    console.log('[smoke] SQLite schema synced (force:true).');
    return;
  }
  // MySQL dev: DELETE in FK-safe order so CASCADE isn't required.
  await PointRecord.destroy({ where: {} });
  await Vote.destroy({ where: {} });
  await Answer.destroy({ where: {} });
  await Question.destroy({ where: {} });
  await User.destroy({ where: {} });
  console.log('[smoke] Cleared feature tables on ' + (process.env.DB_NAME ?? 'configured DB') + '.');
}

async function main(): Promise<void> {
  await sequelize.authenticate();
  await resetSchema();

  // Auth
  const reg1 = await call({
    label: '1. 注册 alice',
    method: 'POST',
    path: '/api/auth/register',
    body: { username: 'alice', email: 'alice@demo.com', password: 'secret123' },
    expectStatus: 201,
  });
  const aliceToken: string = reg1.body.data.token;
  const aliceId: number = reg1.body.data.user.id;

  const reg2 = await call({
    label: '2. 注册 bob',
    method: 'POST',
    path: '/api/auth/register',
    body: { username: 'bob', email: 'bob@demo.com', password: 'secret123' },
    expectStatus: 201,
  });
  const bobToken: string = reg2.body.data.token;
  const bobId: number = reg2.body.data.user.id;

  await call({
    label: '3. 重复邮箱注册 → 400',
    method: 'POST',
    path: '/api/auth/register',
    body: { username: 'alice2', email: 'alice@demo.com', password: 'secret123' },
    expectStatus: 400,
  });

  await call({
    label: '4. 错误密码登录 → 401',
    method: 'POST',
    path: '/api/auth/login',
    body: { email: 'alice@demo.com', password: 'wrong' },
    expectStatus: 401,
  });

  await call({
    label: '5. 正确登录 alice',
    method: 'POST',
    path: '/api/auth/login',
    body: { email: 'alice@demo.com', password: 'secret123' },
    expectStatus: 200,
  });

  await call({
    label: '6. GET /api/auth/me (alice)',
    method: 'GET',
    path: '/api/auth/me',
    token: aliceToken,
    expectStatus: 200,
  });

  // Question
  const q1 = await call({
    label: '7. alice 发布问题 (应 -5 积分)',
    method: 'POST',
    path: '/api/questions',
    token: aliceToken,
    body: {
      title: 'How do I cook rice well',
      content: 'I have tried various methods but rice keeps getting mushy.',
      tags: ['cooking', 'rice'],
    },
    expectStatus: 201,
  });
  const questionId: number = q1.body.data.id;

  await call({
    label: '8. 无 token 发问 → 401',
    method: 'POST',
    path: '/api/questions',
    body: { title: 'x'.repeat(10), content: 'y'.repeat(20) },
    expectStatus: 401,
  });

  await call({
    label: '9. 校验失败 (title too short) → 400',
    method: 'POST',
    path: '/api/questions',
    token: aliceToken,
    body: { title: 'hi', content: 'too short title above' },
    expectStatus: 400,
  });

  // Answer
  const a1 = await call({
    label: '10. bob 回答 (应 +10 积分)',
    method: 'POST',
    path: `/api/questions/${questionId}/answers`,
    token: bobToken,
    body: { content: 'Use 1 cup rice to 1.5 cups water, cover, low heat 18 minutes.' },
    expectStatus: 201,
  });
  const answerId: number = a1.body.data.id;

  // Vote
  await call({
    label: '11. bob 点赞问题 (应给 alice +5)',
    method: 'POST',
    path: '/api/votes',
    token: bobToken,
    body: { targetType: 'question', targetId: questionId },
    expectStatus: 200,
  });

  await call({
    label: '12. alice 点赞 bob 的回答 (应给 bob +10)',
    method: 'POST',
    path: '/api/votes',
    token: aliceToken,
    body: { targetType: 'answer', targetId: answerId },
    expectStatus: 200,
  });

  // Accept
  await call({
    label: '13. alice 采纳 bob 的答案 (应给 bob +30，问题转 solved)',
    method: 'POST',
    path: `/api/answers/${answerId}/accept`,
    token: aliceToken,
    expectStatus: 200,
  });

  await call({
    label: '14. 重复采纳同一答案 → 409 (isAccepted 守卫)',
    method: 'POST',
    path: `/api/answers/${answerId}/accept`,
    token: aliceToken,
    expectStatus: 409,
  });

  // Detail view
  await call({
    label: '15. 详情页匿名 (无 liked 字段)',
    method: 'GET',
    path: `/api/questions/${questionId}`,
    expectStatus: 200,
  });

  await call({
    label: '16. 详情页 bob (liked.question=true)',
    method: 'GET',
    path: `/api/questions/${questionId}`,
    token: bobToken,
    expectStatus: 200,
  });

  // List
  await call({
    label: '17. 列表 sort=latest (默认)',
    method: 'GET',
    path: '/api/questions',
    expectStatus: 200,
  });

  await call({
    label: '18. 列表 sort=popular',
    method: 'GET',
    path: '/api/questions?sort=popular',
    expectStatus: 200,
  });

  await call({
    label: '19. 列表 sort=unsolved (应为空，因为刚采纳)',
    method: 'GET',
    path: '/api/questions?sort=unsolved',
    expectStatus: 200,
  });

  await call({
    label: '20. 列表 tag=cooking',
    method: 'GET',
    path: '/api/questions?tag=cooking',
    expectStatus: 200,
  });

  await call({
    label: '21. 非法 sort=bogus → 400',
    method: 'GET',
    path: '/api/questions?sort=bogus',
    expectStatus: 400,
  });

  // Final points check
  const aliceMe = await call({
    label: '22. 检查 alice 最终积分 (期望 0: -5 ask + 5 liked)',
    method: 'GET',
    path: '/api/auth/me',
    token: aliceToken,
    expectStatus: 200,
  });
  if (aliceMe.body.data.points !== 0) {
    throw new Error(`alice.points 应为 0，实际 ${aliceMe.body.data.points}`);
  }

  const bobMe = await call({
    label: '23. 检查 bob 最终积分 (期望 50: +10 answer + 10 liked + 30 accepted)',
    method: 'GET',
    path: '/api/auth/me',
    token: bobToken,
    expectStatus: 200,
  });
  if (bobMe.body.data.points !== 50) {
    throw new Error(`bob.points 应为 50，实际 ${bobMe.body.data.points}`);
  }

  console.log('\n================================');
  console.log('SMOKE TEST PASSED — 所有端点行为符合预期');
  console.log(`alice: id=${aliceId}, points=${aliceMe.body.data.points}`);
  console.log(`bob:   id=${bobId}, points=${bobMe.body.data.points}`);
  console.log('================================\n');

  await sequelize.close();
}

main().catch((err) => {
  console.error('\nSMOKE TEST FAILED');
  console.error(err);
  process.exit(1);
});
