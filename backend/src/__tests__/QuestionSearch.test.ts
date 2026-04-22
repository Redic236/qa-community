/**
 * Unit coverage for the keyword-search sanitizer. We can't exercise MySQL
 * FULLTEXT from jest (SQLite-only test env), so this focuses on the one
 * thing we MUST get right no matter the engine: the operator-stripping layer
 * between user input and the BOOLEAN MODE query.
 *
 * The SQLite LIKE fallback path is already covered by the integration tests
 * in api.test.ts (see: "q keyword filter matches title / content").
 */
import { sequelize } from '../models';

describe('QuestionService — search sanitizer', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });
  afterAll(async () => {
    await sequelize.close();
  });

  test('dialect is sqlite in tests (SQLite path is active)', () => {
    // If this ever flips, the fulltext branch would execute and MATCH AGAINST
    // would blow up under SQLite. Pin the assumption explicitly.
    expect(sequelize.getDialect()).toBe('sqlite');
  });

  test('sanitizer strips boolean operators and collapses whitespace', async () => {
    // Import lazily so Sequelize model init doesn't happen before the beforeAll sync.
    const { _forTest_sanitizeFtNeedle } = await import('../services/QuestionService');
    expect(_forTest_sanitizeFtNeedle('foo + bar')).toBe('foo   bar');
    expect(_forTest_sanitizeFtNeedle('+abc -def *xyz')).toBe('abc  def  xyz');
    expect(_forTest_sanitizeFtNeedle('"quoted" (paren) ~tilde')).toBe('quoted   paren   tilde');
    expect(_forTest_sanitizeFtNeedle('  multiple   spaces   ')).toBe('multiple   spaces');
    expect(_forTest_sanitizeFtNeedle('backslash\\test')).toBe('backslash test');
    // Pure injection attempt — all operators wiped.
    expect(_forTest_sanitizeFtNeedle('+-><()~*"@\\')).toBe('');
  });

  test('CJK characters pass through untouched (ngram parser territory)', async () => {
    const { _forTest_sanitizeFtNeedle } = await import('../services/QuestionService');
    expect(_forTest_sanitizeFtNeedle('关注微信')).toBe('关注微信');
    expect(_forTest_sanitizeFtNeedle('hello 世界')).toBe('hello 世界');
  });
});
